// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { EOL } from "os";
import { CodeAction, CodeActionContext, CodeActionKind, Command, Range, Selection, TextEditor, Uri } from "vscode";
import { CachedValue } from "../CachedValue";
import { templateKeys } from "../constants";
import { DeploymentDoc } from "../DeploymentDoc";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { INamedDefinition } from "../INamedDefinition";
import { IParameterDefinition } from "../IParameterDefinition";
import * as Json from "../JSON";
import * as language from "../Language";
import { createParameterFromTemplateParameter, defaultTabSize } from "../parameterFileGeneration";
import { ReferenceList } from "../ReferenceList";
import { isParametersSchema } from "../schemas";
import { indentMultilineString } from "../util/multilineStrings";
import { getVSCodePositionFromPosition, getVSCodeRangeFromSpan } from "../util/vscodePosition";
import { ParametersPositionContext } from "./ParametersPositionContext";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

/**
 * Represents a deployment parameter file
 */
export class DeploymentParameters extends DeploymentDoc {
    private _parameterValueDefinitions: CachedValue<ParameterValueDefinition[]> = new CachedValue<ParameterValueDefinition[]>();
    private _parametersProperty: CachedValue<Json.Property | undefined> = new CachedValue<Json.Property | undefined>();

    /**
     * Create a new DeploymentParameters instance
     *
     * @param _documentText The string text of the document.
     * @param _documentId A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(documentText: string, documentId: Uri) {
        super(documentText, documentId);
    }

    public hasParametersUri(): boolean {
        return isParametersSchema(this.schemaUri);
    }

    // case-insensitive
    public getParameterValue(parameterName: string): ParameterValueDefinition | undefined {
        // Number of parameters generally small, not worth creating a case-insensitive dictionary
        const parameterNameLC = parameterName.toLowerCase();
        for (let param of this.parameterValues) {
            if (param.nameValue.unquotedValue.toLowerCase() === parameterNameLC) {
                return param;
            }
        }

        return undefined;
    }

    public get parameterValues(): ParameterValueDefinition[] {
        return this._parameterValueDefinitions.getOrCacheValue(() => {
            const parameterDefinitions: ParameterValueDefinition[] = [];

            // tslint:disable-next-line: strict-boolean-expressions
            for (const parameter of this.parametersObjectValue?.properties || []) {
                parameterDefinitions.push(new ParameterValueDefinition(parameter));
            }

            return parameterDefinitions;
        });
    }

    public get parametersProperty(): Json.Property | undefined {
        return this._parametersProperty.getOrCacheValue(() => {
            return this.topLevelValue?.getProperty(templateKeys.parameters);
        });
    }

    public get parametersObjectValue(): Json.ObjectValue | undefined {
        return Json.asObjectValue(this.parametersProperty?.value);
    }

    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentLineAndColumnIndices(this, documentLineIndex, documentColumnIndex, associatedTemplate);
    }

    public getContextFromDocumentCharacterIndex(documentCharacterIndex: number, associatedDocument: DeploymentTemplate | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentCharacterIndex(this, documentCharacterIndex, associatedDocument);
    }

    public findReferences(definition: INamedDefinition): ReferenceList {
        const results: ReferenceList = new ReferenceList(definition.definitionKind);

        // The only reference possible is the definition itself (from the template file)
        if (definition.nameValue) {
            results.add(definition.nameValue.unquotedSpan);
        }
        return results;
    }

    public async getCodeActions(
        associatedDocument: DeploymentDoc | undefined,
        range: Range | Selection,
        context: CodeActionContext
    ): Promise<(Command | CodeAction)[]> {
        assert(!associatedDocument || associatedDocument instanceof DeploymentTemplate, "Associated document is of the wrong type");
        const template: DeploymentTemplate | undefined = <DeploymentTemplate | undefined>associatedDocument;

        const actions: (Command | CodeAction)[] = [];
        const parametersProperty = this.parametersProperty;

        if (parametersProperty) {
            const lineIndex = this.getDocumentPosition(parametersProperty?.nameValue.span.startIndex).line;
            if (lineIndex >= range.start.line && lineIndex <= range.end.line) {
                const missingParameters: IParameterDefinition[] = this.getMissingParameters(template, false);

                // Add all missing parameters
                if (missingParameters.length > 0) {
                    const action = new CodeAction("Add all missing parameters", CodeActionKind.QuickFix);
                    action.command = {
                        command: 'azurerm-vscode-tools.codeAction.addAllMissingParameters',
                        title: action.title
                        // arguments: [
                        //     this.document.documentId
                        // ]
                    };
                    actions.push(action);
                }

                // Add missing required parameters
                if (missingParameters.some(p => this.isParameterRequired(p))) {
                    const action = new CodeAction("Add missing required parameters", CodeActionKind.QuickFix);
                    action.command = {
                        command: 'azurerm-vscode-tools.codeAction.addMissingRequiredParameters',
                        title: action.title
                        // arguments: [
                        //     this.document.documentId
                        // ]
                    };
                    actions.push(action);
                }
            }
        }

        return actions;
    }

    private isParameterRequired(paramDef: IParameterDefinition): boolean {
        return !paramDef.defaultValue;
    }

    private getMissingParameters(template: DeploymentTemplate | undefined, onlyRequiredParameters: boolean): IParameterDefinition[] {
        if (!template) {
            return [];
        }

        const results: IParameterDefinition[] = [];
        for (let paramDef of template.topLevelScope.parameterDefinitions) {
            const paramValue = this.getParameterValue(paramDef.nameValue.unquotedValue);
            if (!paramValue) {
                results.push(paramDef);
            }
        }

        if (onlyRequiredParameters) {
            return results.filter(p => this.isParameterRequired(p));
        }

        return results;
    }

    public async addMissingParameters(
        editor: TextEditor,
        template: DeploymentTemplate,
        onlyRequiredParameters: boolean
    ): Promise<void> {
        // Find the location to insert new stuff in the parameters section
        if (this.parametersProperty && this.parametersObjectValue) {
            // Where insert?
            // Find last non-whitespace token inside the parameters section
            let lastTokenInParameters: Json.Token | undefined;
            for (let i = this.parametersProperty.span.endIndex - 1; // Start before the closing "}"
                i >= this.parametersProperty.span.startIndex;
                --i) {
                lastTokenInParameters = this.jsonParseResult.getTokenAtCharacterIndex(i, Json.Comments.includeCommentTokens);
                if (lastTokenInParameters) {
                    break;
                }
            }
            const insertIndex: number = lastTokenInParameters
                ? lastTokenInParameters.span.afterEndIndex
                : this.parametersObjectValue.span.endIndex;
            const insertPosition = this.getDocumentPosition(insertIndex);

            // Find missing params
            const missingParams: IParameterDefinition[] = this.getMissingParameters(template, onlyRequiredParameters);
            if (missingParams.length === 0) {
                return;
            }

            // Create insertion text
            let paramsAsText: string[] = [];
            for (let param of missingParams) {
                const paramText = createParameterFromTemplateParameter(template, param, defaultTabSize);
                paramsAsText.push(paramText);
            }
            let newText = paramsAsText.join(`,${EOL}`);

            // Determine indentation
            const parametersObjectIndent = this.getDocumentPosition(this.parametersProperty?.nameValue.span.startIndex).column;
            const lastParameter = this.parameterValues.length > 0 ? this.parameterValues[this.parameterValues.length - 1] : undefined;
            const lastParameterIndent = lastParameter ? this.getDocumentPosition(lastParameter?.fullSpan.startIndex).column : undefined;
            const newTextIndent = lastParameterIndent === undefined ? parametersObjectIndent + defaultTabSize : lastParameterIndent;
            let indentedText = indentMultilineString(newText, newTextIndent);
            let insertText = EOL + indentedText;

            // If insertion point is on the same line as the end of the parameters object, then add a newline
            // afterwards and indent it (e.g. parameters object = empty, {})
            if (this.getDocumentPosition(insertIndex).line
                === this.getDocumentPosition(this.parametersObjectValue.span.endIndex).line
            ) {
                insertText += EOL + ' '.repeat(defaultTabSize);
            }

            // Add comma before?
            let commaEdit = this.createEditToAddCommaBeforePosition(insertIndex);
            assert(!commaEdit || commaEdit.span.endIndex <= insertIndex);
            if (commaEdit?.span.startIndex === insertIndex) {
                // vscode doesn't like both edits starting at the same location, so
                //   just add the comma directly to the string (this is the common case)
                commaEdit = undefined;
                insertText = `,${insertText}`;
            }

            await editor.edit(editBuilder => {

                editBuilder.insert(getVSCodePositionFromPosition(insertPosition), insertText);
                if (commaEdit) {
                    editBuilder.replace(
                        getVSCodeRangeFromSpan(this, commaEdit.span),
                        commaEdit.insertText);
                }
            });
        }
    }

    public createEditToAddCommaBeforePosition(documentIndex: number): { insertText: string; span: language.Span } | undefined {
        // Are there are any parameters before the one being inserted?
        const newParamIndex = this.parameterValues
            .filter(
                p => p.fullSpan.endIndex < documentIndex)
            .length;
        if (newParamIndex > 0) {
            const prevParameter = this.parameterValues[newParamIndex - 1];
            assert(prevParameter);

            // Is there already a comma after the last parameter?
            const firstIndexAfterPrev = prevParameter.fullSpan.afterEndIndex;
            const tokensBetweenParams = this.jsonParseResult.getTokensInSpan(
                new language.Span(
                    firstIndexAfterPrev,
                    documentIndex - firstIndexAfterPrev),
                Json.Comments.ignoreCommentTokens
            );
            if (tokensBetweenParams.some(t => t.type === Json.TokenType.Comma)) {
                // ... yes
                return undefined;
            }

            // Insert a new comma right after last item's full span
            const insertIndex = prevParameter.fullSpan.afterEndIndex;
            return {
                insertText: ',',
                span: new language.Span(insertIndex, 0)
            };
        }

        return undefined;
    }

    public get errorsPromise(): Promise<language.Issue[]> {
        return getErrors();

        async function getErrors(): Promise<language.Issue[]> {
            return [];
        }
    }
}
