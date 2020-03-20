// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { EOL } from "os";
import { CodeAction, CodeActionContext, CodeActionKind, Command, Range, Selection, TextEditor } from "vscode";
import { Json } from "../../extension.bundle";
import * as Completion from "../Completion";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { assert } from "../fixed_assert";
import { IParameterDefinition } from "../IParameterDefinition";
import { Comments } from "../JSON";
import * as language from "../Language";
import { createParameterFromTemplateParameter, defaultTabSize } from "../parameterFileGeneration";
import { ReferenceList } from "../ReferenceList";
import { IReferenceSite } from "../TemplatePositionContext";
import { indentMultilineString } from "../util/multilineStrings";
import { getVSCodePositionFromPosition, getVSCodeRangeFromSpan } from "../util/vscodePosition";
import { DeploymentParameters } from "./DeploymentParameters";
import { DocumentPositionContext } from "./DocumentPositionContext";

/**
 * Represents a position inside the snapshot of a deployment parameter file, plus all related information
 * that can be parsed and analyzed about it from that position.
 */
export class ParametersPositionContext extends DocumentPositionContext {
    // asdf pass in function to *get* deployment template
    private _associatedTemplate: DeploymentTemplate | undefined;

    private constructor(deploymentParameters: DeploymentParameters, associatedTemplate: DeploymentTemplate | undefined) {
        super(deploymentParameters);
        this._associatedTemplate = associatedTemplate;
    }

    public static fromDocumentLineAndColumnIndices(deploymentParameters: DeploymentParameters, documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        let context = new ParametersPositionContext(deploymentParameters, associatedTemplate);
        context.initFromDocumentLineAndColumnIndices(documentLineIndex, documentColumnIndex);
        return context;
    }
    public static fromDocumentCharacterIndex(deploymentParameters: DeploymentParameters, documentCharacterIndex: number, deploymentTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        let context = new ParametersPositionContext(deploymentParameters, deploymentTemplate);
        context.initFromDocumentCharacterIndex(documentCharacterIndex);
        return context;
    }

    public get document(): DeploymentParameters {
        return <DeploymentParameters>super.document;
    }

    /**
     * If this position is inside an expression, inside a reference to an interesting function/parameter/etc, then
     * return an object with information about this reference and the corresponding definition
     */
    public getReferenceSiteInfo(): IReferenceSite | undefined {
        if (!this._associatedTemplate) {
            return undefined;
        }

        for (let paramValue of this.document.parameterValues) {
            // Are we inside the name of a parameter?
            if (paramValue.nameValue.span.contains(this.documentCharacterIndex, language.Contains.extended)) {
                // Does it have an associated parameter definition in the template?
                const paramDef = this._associatedTemplate?.topLevelScope.getParameterDefinition(paramValue.nameValue.unquotedValue);
                if (paramDef) {
                    return {
                        referenceSpan: paramValue.nameValue.span,
                        definition: paramDef,
                        definitionDoc: this._associatedTemplate
                    };
                }

                break;
            }
        }

        return undefined;
    }

    // Returns undefined if references are not supported at this location.
    // Returns empty list if supported but none found
    public getReferences(): ReferenceList | undefined {
        const refInfo = this.getReferenceSiteInfo();
        if (refInfo) {
            return this.document.findReferences(refInfo.definition);
        }

        return undefined;
    }

    public getCompletionItems(): Completion.Item[] {
        let completions: Completion.Item[] = [];

        if (this.canAddPropertyHere) {
            completions.push(... this.getCompletionsForMissingParameters());
            completions.push(this.getCompletionForNewParameter());
        }

        return completions;
    }

    private getCompletionForNewParameter(): Completion.Item {
        const detail = "Insert new parameter";
        let snippet =
            // tslint:disable-next-line:prefer-template
            `"\${1:parameter1}": {` + EOL
            + `\t"value": "\${2:value}"` + EOL
            + `}`;
        const documentation = "documentation";
        const label = `"<new parameter>"`;

        return this.createParameterCompletion(
            label,
            snippet,
            Completion.CompletionKind.NewPropertyValue,
            detail,
            documentation);
    }

    /**
     * Get completion items for our position in the document
     */
    private getCompletionsForMissingParameters(): Completion.Item[] {
        const completions: Completion.Item[] = [];
        if (this._associatedTemplate) {
            const paramsInParameterFile: string[] = this.document.parameterValues.map(
                pv => pv.nameValue.unquotedValue.toLowerCase());

            // For each parameter in the template
            for (let param of this._associatedTemplate.topLevelScope.parameterDefinitions) {
                // Is this already in the parameter file?
                const paramNameLC = param.nameValue.unquotedValue.toLowerCase();
                if (paramsInParameterFile.includes(paramNameLC)) {
                    continue;
                }

                // tslint:disable-next-line:prefer-template
                const isRequired = !param.defaultValue;
                const label = `${param.nameValue.quotedValue} ${isRequired ? "(required)" : "(optional)"}`;
                const paramText = createParameterFromTemplateParameter(this._associatedTemplate, param);
                let replacement = paramText;
                const documentation = `Insert a value for parameter '${param.nameValue.unquotedValue}' from the template file"`;
                const detail = paramText;

                completions.push(
                    this.createParameterCompletion(
                        label,
                        replacement,
                        Completion.CompletionKind.PropertyValue,
                        detail,
                        documentation));
            }
        }

        return completions;
    }

    private createParameterCompletion(
        label: string,
        replacement: string,
        kind: Completion.CompletionKind,
        detail: string,
        documentation: string
    ): Completion.Item {
        // Replacement span
        let span = this.determineCompletionSpan();

        // Comma after?
        if (this.needsCommaAfterCompletion()) {
            replacement += ',';
        }

        // Comma before?
        const commaEdit = this.createEditToAddCommaBeforeDocPosition();

        return new Completion.Item(
            label,
            replacement,
            span,
            kind,
            detail,
            documentation,
            undefined,
            commaEdit ? [commaEdit] : undefined);
    }

    private determineCompletionSpan(): language.Span {
        let span = this.emptySpanAtDocumentCharacterIndex;

        // If the completion is triggered inside double quotes, or from a trigger character of a double quotes (
        // which ends up adding '""' first, then triggering the completion inside the quotes), then
        // the insert range needs to subsume those quotes so they get deleted when the new param is inserted.
        if (this.document.documentText.charAt(this.documentCharacterIndex - 1) === '"') { //asdf
            span = span.extendLeft(1);
        }
        if (this.document.documentText.charAt(this.documentCharacterIndex) === '"') {
            span = span.extendRight(1);
        }

        return span;
    }

    private needsCommaAfterCompletion(): boolean {
        // If there are any parameters after the one being inserted, we need to add a comma after the new one
        if (this.document.parameterValues.some(p => p.fullSpan.startIndex >= this.documentCharacterIndex)) {
            return true;
        }

        return false;
    }

    private createEditToAddCommaBeforeDocPosition(): { insertText: string; span: language.Span } | undefined {
        // Are there are any parameters before the one being inserted?
        const newParamIndex = this.document.parameterValues
            .filter(
                p => p.fullSpan.endIndex < this.documentCharacterIndex)
            .length;
        if (newParamIndex > 0) {
            const prevParameter = this.document.parameterValues[newParamIndex - 1];
            assert(prevParameter);

            // Is there already a comma after the last parameter?
            const firstIndexAfterPrev = prevParameter.fullSpan.afterEndIndex;
            const tokensBetweenParams = this.document.jsonParseResult.getTokensInSpan(
                new language.Span(
                    firstIndexAfterPrev,
                    this.documentCharacterIndex - firstIndexAfterPrev),
                Comments.ignoreCommentTokens
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

    // True if inside the "parameters" object, but not inside any properties
    // within it.
    public get canAddPropertyHere(): boolean {
        if (!this.document.parametersObjectValue) {
            // No "parameters" section
            return false;
        }

        const enclosingJsonValue = this.document.jsonParseResult.getValueAtCharacterIndex(
            this.documentCharacterIndex,
            language.Contains.enclosed);

        if (enclosingJsonValue !== this.document.parametersObjectValue) {
            // Directly-enclosing JSON value/object at the cursor is not the "parameters" object
            // (either it's outside it, or it's within a subvalue like an existing parameter)
            return false;
        }

        // Check if we're inside a comment
        if (!!this.document.jsonParseResult.getCommentTokenAtDocumentIndex(
            this.documentCharacterIndex,
            language.Contains.enclosed)
        ) {
            return false;
        }

        return true;
    }

    // CONSIDER: The concept of the document location location isn't applicable to this function because it requires
    //   a range of effect
    public async getCodeActions(range: Range | Selection, context: CodeActionContext): Promise<(Command | CodeAction)[]> {
        const actions: (Command | CodeAction)[] = [];
        const parametersProperty = this.document.parametersProperty;

        if (parametersProperty) {
            const lineIndex = this.document.getDocumentPosition(parametersProperty?.nameValue.span.startIndex).line;
            if (lineIndex >= range.start.line && lineIndex <= range.end.line) {
                const missingParameters: IParameterDefinition[] = this.getMissingParameters(false);

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

    private getMissingParameters(onlyRequiredParameters: boolean): IParameterDefinition[] {
        if (!this._associatedTemplate) {
            return [];
        }

        const results: IParameterDefinition[] = [];
        for (let paramDef of this._associatedTemplate?.topLevelScope.parameterDefinitions) {
            const paramValue = this.document.getParameterValue(paramDef.nameValue.unquotedValue);
            if (!paramValue) {
                results.push(paramDef);
            }
        }

        if (onlyRequiredParameters) {
            return results.filter(p => this.isParameterRequired(p));
        }

        return results;
    }

    // where does this belong?
    public static async addMissingParameters(
        editor: TextEditor,
        params: DeploymentParameters,
        template: DeploymentTemplate,
        onlyRequiredParameters: boolean
    ): Promise<void> {
        // Find the location to insert new stuff in the parameters section
        if (params.parametersProperty && params.parametersObjectValue) {
            // Where insert?
            // Find last non-whitespace token inside the parameters section
            let lastTokenInParameters: Json.Token | undefined;
            for (let i = params.parametersProperty.span.endIndex - 1; // Start before the closing "}"
                i >= params.parametersProperty.span.startIndex;
                --i) {
                lastTokenInParameters = params.jsonParseResult.getTokenAtCharacterIndex(i, Comments.includeCommentTokens);
                if (lastTokenInParameters) {
                    break;
                }
            }
            const insertIndex: number = lastTokenInParameters
                ? lastTokenInParameters.span.afterEndIndex
                : params.parametersObjectValue.span.endIndex;

            const pc = ParametersPositionContext.fromDocumentCharacterIndex(params, insertIndex, template);

            // Find missing params
            const missingParams: IParameterDefinition[] = pc.getMissingParameters(onlyRequiredParameters);
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
            const parametersObjectIndent = params.getDocumentPosition(params.parametersProperty?.nameValue.span.startIndex).column;
            const lastParameter = params.parameterValues.length > 0 ? params.parameterValues[params.parameterValues.length - 1] : undefined;
            const lastParameterIndent = lastParameter ? params.getDocumentPosition(lastParameter?.fullSpan.startIndex).column : undefined;
            const newTextIndent = lastParameterIndent === undefined ? parametersObjectIndent + defaultTabSize : lastParameterIndent;
            let indentedText = indentMultilineString(newText, newTextIndent);
            let insertText = EOL + indentedText;

            // If insertion point is on the same line as the end of the parameters object, then add a newline
            // afterwards and indent it (e.g. parameters object = empty, {})
            if (params.getDocumentPosition(insertIndex).line
                === params.getDocumentPosition(params.parametersObjectValue.span.endIndex).line
            ) {
                insertText += EOL + ' '.repeat(defaultTabSize); 5;
            }

            // Add comma before?
            let commaEdit = pc.createEditToAddCommaBeforeDocPosition();
            assert(!commaEdit || commaEdit.span.endIndex <= insertIndex);
            if (commaEdit?.span.startIndex === insertIndex) {
                // vscode doesn't like both edits starting at the same location, so
                //   just add the comma directly to the string (this is the common case)
                commaEdit = undefined;
                indentedText = `,${indentedText}`;
            }

            await editor.edit(editBuilder => {
                editBuilder.insert(getVSCodePositionFromPosition(pc.documentPosition), insertText);
                if (commaEdit) {
                    editBuilder.replace(
                        getVSCodeRangeFromSpan(params, commaEdit.span),
                        commaEdit.insertText);
                }
            });
        }
    }
}
