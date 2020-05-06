// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { CodeAction, CodeActionContext, CodeActionKind, Command, Range, Selection, SnippetString, TextEditor, Uri } from "vscode";
import { WhichParams } from '../../extension.bundle';
import { CachedValue } from "../CachedValue";
import { templateKeys } from "../constants";
import { DeploymentDocument } from "../DeploymentDocument";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { INamedDefinition } from "../INamedDefinition";
import { IParameterDefinition } from "../IParameterDefinition";
import * as Json from "../JSON";
import * as language from "../Language";
import { ContentKind, createParametersFromTemplateParameters } from "../parameterFileGeneration";
import { ReferenceList } from "../ReferenceList";
import { isParametersSchema } from "../schemas";
import { formatText, prependToEachLine } from '../util/multilineStrings';
import { getVSCodePositionFromPosition, getVSCodeRangeFromSpan } from "../util/vscodePosition";
import { ParametersPositionContext } from "./ParametersPositionContext";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

/**
 * Represents a deployment parameter file
 */
export class DeploymentParameters extends DeploymentDocument {
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

    public findReferencesToDefinition(definition: INamedDefinition): ReferenceList {
        const results: ReferenceList = new ReferenceList(definition.definitionKind);

        // The only reference possible in the parameter file is the parameter's value definition
        if (definition.nameValue) {
            const paramValue = this.getParameterValue(definition.nameValue.unquotedValue);
            if (paramValue) {
                results.add({ document: this, span: paramValue.nameValue.unquotedSpan });
            }
        }
        return results;
    }

    public async getCodeActions(
        associatedDocument: DeploymentDocument | undefined,
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
                const missingParameters: IParameterDefinition[] = this.getMissingParameters(template, WhichParams.all);

                // Add missing required parameters
                if (missingParameters.some(p => this.isParameterRequired(p))) {
                    const action = new CodeAction("Add missing required parameters", CodeActionKind.QuickFix);
                    action.command = {
                        command: 'azurerm-vscode-tools.codeAction.addMissingRequiredParameters',
                        title: action.title,
                        arguments: [
                            this.documentId
                        ]
                    };
                    actions.push(action);
                }

                // Add all missing parameters
                if (missingParameters.length > 0) {
                    const action = new CodeAction("Add all missing parameters", CodeActionKind.QuickFix);
                    action.command = {
                        command: 'azurerm-vscode-tools.codeAction.addAllMissingParameters',
                        title: action.title,
                        arguments: [
                            this.documentId
                        ]
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

    private getMissingParameters(template: DeploymentTemplate | undefined, whichParams: WhichParams): IParameterDefinition[] {
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

        if (whichParams === WhichParams.required) {
            return results.filter(p => this.isParameterRequired(p));
        }

        return results;
    }

    // tslint:disable-next-line: max-func-body-length asdf
    public async addMissingParameters(
        editor: TextEditor,
        template: DeploymentTemplate,
        whichParams: WhichParams
    ): Promise<void> {
        // Find missing params
        const missingParams: IParameterDefinition[] = this.getMissingParameters(template, whichParams);
        if (missingParams.length === 0) {
            return;
        }

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
            let insertIndex: number = lastTokenInParameters
                ? lastTokenInParameters.span.afterEndIndex
                : this.parametersObjectValue.span.endIndex;
            let insertPosition = this.getDocumentPosition(insertIndex);

            // Need comma before?
            let commaEdit = this.createEditToAddCommaBeforePosition(insertIndex);
            assert(!commaEdit || commaEdit.span.endIndex <= insertIndex);

            // // Need comma before? asdf
            // const commaEdit = this.createEditToAddCommaBeforePosition(insertIndex);
            // assert(!commaEdit || commaEdit.span.endIndex <= insertIndex);
            // if (commaEdit) {
            //     await editor.edit(_ => commaEdit);

            //     //asdf
            //     // // vscode doesn't like both edits starting at the same location, so
            //     // //   just add the comma directly to the string (this is the common case)
            //     // commaEdit = undefined;
            //     // insertText = `,${insertText}`;
            // }

            // Insert newline if not on a blank line, and move insertion point to the new line
            if (!editor.document.lineAt(insertPosition.line).isEmptyOrWhitespace) {
                const insertVsCodePosition = getVSCodePositionFromPosition(insertPosition);
                editor.selection = new Selection(insertVsCodePosition, insertVsCodePosition);
                await editor.edit(
                    edit => {
                        // Note: vscode will automatically convert \n as necessary
                        edit.insert(insertVsCodePosition, '\n');
                    },
                    {
                        undoStopBefore: true,
                        undoStopAfter: false
                    });
                insertPosition = new language.Position(editor.selection.anchor.line, editor.selection.anchor.character);
                insertIndex = this.getDocumentCharacterIndex(insertPosition.line, insertPosition.column);
            }

            // Move to start of current line
            editor.selection = new Selection(
                editor.selection.anchor.line, 0,
                editor.selection.anchor.line, 0);

            // Create insertion text
            const paramsAsText = createParametersFromTemplateParameters(
                template,
                missingParams,
                ContentKind.snippet,
                { insertSpaces: false, tabSize: 4 } // vscode handles converting tabs for snippets
            );

            // Indent two levels, since it's inside the "parameters" property object
            let insertText = prependToEachLine(paramsAsText, '\t\t');

            // If insertion point is still not empty, add a newline and indentation after the insert
            //   text to move the existing text onto a separate line
            if (!editor.document.lineAt(insertPosition.line).isEmptyOrWhitespace) {
                // Note: vscode will automatically convert \n as necessary
                // tslint:disable-next-line: prefer-template
                insertText += '\n\t'; //asdf //asdf testpoint
            }

            //asdf
            // // If insertion point is on the same line as the end of the parameters object, then add a newline
            // // afterwards and indent it (e.g. parameters object = empty, {})
            // if (this.getDocumentPosition(insertIndex).line
            //     === this.getDocumentPosition(this.parametersObjectValue.span.endIndex).line
            // ) {
            //     // Note: vscode will automatically convert \n as necessary
            //     // tslint:disable-next-line: prefer-template
            //     insertText += '\n\t'; //asdf //asdf testpoint
            // }

            if (commaEdit?.span.startIndex === insertIndex) {
                // vscode doesn't like both edits starting at the same location, so
                //   just add the comma directly to the string (this is the common case)
                commaEdit = undefined;
                insertText = `,${insertText}`;
            }

            if (commaEdit) {
                await editor.edit(editBuilder => {
                    editBuilder.replace(
                        // tslint:disable-next-line: no-non-null-assertion
                        getVSCodeRangeFromSpan(this, commaEdit!.span),
                        // tslint:disable-next-line: no-non-null-assertion
                        commaEdit!.insertText);
                });
            }

            //asdfconst startOfInsertLine = new language.Position(insertPosition.line, 0);
            //insertText = insertText.trimLeft(); //asdf
            //insertPosition = new language.Position(insertPosition.line, <number>editor.options.tabSize * 2); //asdf
            insertText = formatText(insertText, editor);
            await editor.insertSnippet(new SnippetString(insertText), getVSCodePositionFromPosition(insertPosition), {
                undoStopBefore: false,
                undoStopAfter: true
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

    public async getErrorsCore(associatedTemplate: DeploymentTemplate | undefined): Promise<language.Issue[]> {
        const missingRequiredParams: IParameterDefinition[] = this.getMissingParameters(associatedTemplate, WhichParams.required);
        if (missingRequiredParams.length === 0) {
            return [];
        }

        const missingParamNames = missingRequiredParams.map(param => `"${param.nameValue.unquotedValue}"`);
        const message = `The following parameters do not have default values and require a value in the parameter file: ${missingParamNames.join(', ')}`;
        const span = this.parametersProperty?.nameValue.span ?? new language.Span(0, 0);
        return [new language.Issue(span, message, language.IssueKind.params_missingRequiredParam)];
    }

    public getWarnings(): language.Issue[] {
        return [];
    }
}
