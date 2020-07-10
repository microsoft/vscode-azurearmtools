// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import * as os from "os";
import { CodeAction, CodeActionContext, CodeActionKind, Range, Selection, TextEditor } from "vscode";
import { Command } from "vscode-languageclient";
import { Json } from "../../extension.bundle";
import { IParameterDefinition } from "../IParameterDefinition";
import * as language from "../Language";
import { createParameterFromTemplateParameter, defaultTabSize } from "../parameterFileGeneration";
import { indentMultilineString } from "../util/multilineStrings";
import { getVSCodePositionFromPosition, getVSCodeRangeFromSpan } from "../util/vscodePosition";
import { IParameterDefinitionsSource } from "./IParameterDefinitionsSource";
import { IParameterValuesSource } from "./IParameterValuesSource";

const EOL: string = os.EOL;

export async function getParameterValuesCodeActions(
    parameterValuesSource: IParameterValuesSource,
    parameterDefinitionsSource: IParameterDefinitionsSource | undefined,
    // This is the range currently being inspected
    range: Range | Selection,
    context: CodeActionContext
): Promise<(Command | CodeAction)[]> {
    const actions: (Command | CodeAction)[] = [];
    const parametersProperty = parameterValuesSource.parametersProperty;

    if (parametersProperty && parameterDefinitionsSource) {
        // Is the parameters property in the requested range?
        const lineIndexOfParametersProperty = parameterValuesSource.document.getDocumentPosition(parametersProperty.nameValue.span.startIndex).line;
        if (lineIndexOfParametersProperty >= range.start.line && lineIndexOfParametersProperty <= range.end.line) {
            const missingParameters: IParameterDefinition[] = getMissingParameters(parameterDefinitionsSource, parameterValuesSource, false);

            // Add missing required parameters
            if (missingParameters.some(isParameterRequired)) {
                const action = new CodeAction("Add missing required parameters", CodeActionKind.QuickFix);
                action.command = {
                    command: 'azurerm-vscode-tools.codeAction.addMissingRequiredParameters',
                    title: action.title,
                    arguments: [
                        parameterValuesSource.document.documentUri
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
                        parameterValuesSource.document.documentUri
                    ]
                };
                actions.push(action);
            }
        }
    }

    return actions;
}

function isParameterRequired(paramDef: IParameterDefinition): boolean {
    return !paramDef.defaultValue;
}

export function getMissingParameters(
    parameterDefinitionsSource: IParameterDefinitionsSource,
    parameterValuesSource: IParameterValuesSource,
    onlyRequiredParameters: boolean
): IParameterDefinition[] {
    const results: IParameterDefinition[] = [];
    for (let paramDef of parameterDefinitionsSource.parameterDefinitions) {
        const paramValue = parameterValuesSource.getParameterValue(paramDef.nameValue.unquotedValue);
        if (!paramValue) {
            results.push(paramDef);
        }
    }

    if (onlyRequiredParameters) {
        return results.filter(isParameterRequired);
    }

    return results;
}

export async function addMissingParameters(
    parameterDefinitionsSource: IParameterDefinitionsSource,
    parameterValuesSource: IParameterValuesSource,
    // An editor for the the parameter values source document
    parameterValuesSourceEditor: TextEditor,
    onlyRequiredParameters: boolean
): Promise<void> {
    // We don't currently handle the case where there is no "parameters" object

    // Find the location to insert new stuff in the parameters section
    const parameterValuesDocument = parameterValuesSource.document;
    const parametersObjectValue = parameterValuesSource.parametersProperty?.value?.asObjectValue;
    if (parameterValuesSource.parametersProperty && parametersObjectValue) {
        // Where insert?
        // Find last non-whitespace token inside the parameters section
        const parametersProperty = parameterValuesSource.parametersProperty;
        let lastTokenInParameters: Json.Token | undefined;
        for (let i = parametersProperty.span.endIndex - 1; // Start before the closing "}"
            i >= parametersProperty.span.startIndex;
            --i) {
            lastTokenInParameters = parameterValuesDocument.jsonParseResult.getTokenAtCharacterIndex(i, Json.Comments.includeCommentTokens);
            if (lastTokenInParameters) {
                break;
            }
        }
        const insertIndex: number = lastTokenInParameters
            ? lastTokenInParameters.span.afterEndIndex
            : parametersObjectValue.span.endIndex;
        const insertPosition = parameterValuesDocument.getDocumentPosition(insertIndex);

        const missingParams: IParameterDefinition[] = getMissingParameters(
            parameterDefinitionsSource,
            parameterValuesSource,
            onlyRequiredParameters);

        if (missingParams.length === 0) {
            return;
        }

        // Create insertion text
        let paramsAsText: string[] = [];
        for (let param of missingParams) {
            const paramText = createParameterFromTemplateParameter(parameterDefinitionsSource, param, defaultTabSize);
            paramsAsText.push(paramText);
        }
        let newText = paramsAsText.join(`,${EOL}`);

        // Determine indentation
        const parametersObjectIndent = parameterValuesDocument.getDocumentPosition(parametersProperty?.nameValue.span.startIndex).column;
        const lastParameter = parameterValuesSource.parameterValueDefinitions.length > 0 ? parameterValuesSource.parameterValueDefinitions[parameterValuesSource.parameterValueDefinitions.length - 1] : undefined;
        const lastParameterIndent = lastParameter ? parameterValuesDocument.getDocumentPosition(lastParameter?.fullSpan.startIndex).column : undefined;
        const newTextIndent = lastParameterIndent === undefined ? parametersObjectIndent + defaultTabSize : lastParameterIndent;
        let indentedText = indentMultilineString(newText, newTextIndent);
        let insertText = EOL + indentedText;

        // If insertion point is on the same line as the end of the parameters object, then add a newline
        // afterwards and indent it (e.g. parameters object = empty, {})
        if (parameterValuesDocument.getDocumentPosition(insertIndex).line
            === parameterValuesDocument.getDocumentPosition(parametersObjectValue.span.endIndex).line
        ) {
            insertText += EOL + ' '.repeat(defaultTabSize);
        }

        // Add comma before?
        let commaEdit = createEditToAddCommaBeforePosition(parameterValuesSource, insertIndex);
        assert(!commaEdit || commaEdit.span.endIndex <= insertIndex);
        if (commaEdit?.span.startIndex === insertIndex) {
            // vscode doesn't like both edits starting at the same location, so
            //   just add the comma directly to the string (this is the common case)
            commaEdit = undefined;
            insertText = `,${insertText}`;
        }

        await parameterValuesSourceEditor.edit(editBuilder => {

            editBuilder.insert(getVSCodePositionFromPosition(insertPosition), insertText);
            if (commaEdit) {
                editBuilder.replace(
                    getVSCodeRangeFromSpan(parameterValuesDocument, commaEdit.span),
                    commaEdit.insertText);
            }
        });
    }
}

export function createEditToAddCommaBeforePosition(
    parameterValuesSource: IParameterValuesSource,
    documentIndex: number
): { insertText: string; span: language.Span } | undefined {
    // Are there are any parameters before the one being inserted?
    const newParamIndex = parameterValuesSource.parameterValueDefinitions
        .filter(
            p => p.fullSpan.endIndex < documentIndex)
        .length;
    if (newParamIndex > 0) {
        const prevParameter = parameterValuesSource.parameterValueDefinitions[newParamIndex - 1];
        assert(prevParameter);

        // Is there already a comma after the last parameter?
        const firstIndexAfterPrev = prevParameter.fullSpan.afterEndIndex;
        const tokensBetweenParams = parameterValuesSource.document.jsonParseResult.getTokensInSpan(
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
