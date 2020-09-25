// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { CodeAction, CodeActionContext, CodeActionKind, Range, Selection, TextEditor } from "vscode";
import { Command } from "vscode-languageclient";
import { Completion, Json } from "../../../extension.bundle";
import { ext } from "../../extensionVariables";
import { Issue } from "../../language/Issue";
import { IssueKind } from "../../language/IssueKind";
import { ContainsBehavior, Span } from "../../language/Span";
import { indentMultilineString } from "../../util/multilineStrings";
import { IAddMissingParametersArgs } from "../../vscodeIntegration/commandArguments";
import { getVSCodePositionFromPosition, getVSCodeRangeFromSpan } from "../../vscodeIntegration/vscodePosition";
import { IParameterDefinition } from "./IParameterDefinition";
import { IParameterDefinitionsSource } from "./IParameterDefinitionsSource";
import { IParameterValuesSource } from "./IParameterValuesSource";
import { createParameterFromTemplateParameter, defaultTabSize } from "./parameterFileGeneration";

const EOL: string = ext.EOL;
const newParameterValueSnippetLabel = `new-parameter-value`;

export function getParameterValuesCodeActions(
    parameterValuesSource: IParameterValuesSource,
    parameterDefinitionsSource: IParameterDefinitionsSource | undefined,
    // This is the range currently being inspected
    range: Range | Selection,
    context: CodeActionContext
): (Command | CodeAction)[] {
    const actions: (Command | CodeAction)[] = [];
    const parametersProperty = parameterValuesSource.parameterValuesProperty;

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
                        parameterValuesSource.document.documentUri,
                        <IAddMissingParametersArgs>{
                            parameterValuesSource,
                            parameterDefinitionsSource
                        }
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
                        parameterValuesSource.document.documentUri,
                        <IAddMissingParametersArgs>{
                            parameterValuesSource,
                            parameterDefinitionsSource
                        }
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
    const parametersObjectValue = parameterValuesSource.parameterValuesProperty?.value?.asObjectValue;
    if (parameterValuesSource.parameterValuesProperty && parametersObjectValue) {
        // Where insert?
        // Find last non-whitespace token inside the parameters section
        const parametersProperty = parameterValuesSource.parameterValuesProperty;
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
): { insertText: string; span: Span } | undefined {
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
            new Span(
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
            span: new Span(insertIndex, 0)
        };
    }

    return undefined;
}

export function getCompletionForNewParameter(
    parameterValuesSource: IParameterValuesSource,
    documentIndex: number
): Completion.Item {
    const detail = "Insert new parameter";
    let snippet =
        // tslint:disable-next-line:prefer-template
        `"\${1:parameter1}": {` + EOL
        + `\t"value": "\${2:value}"` + EOL
        + `}`;
    const documentation = "documentation";
    const label = newParameterValueSnippetLabel;

    return createParameterCompletion(
        parameterValuesSource,
        documentIndex,
        label,
        snippet,
        Completion.CompletionKind.PropertyValueForNewProperty,
        detail,
        documentation);
}

/**
 * Get completion items for our position in the document
 */
export function getCompletionsForMissingParameters(
    parameterDefinitionsSource: IParameterDefinitionsSource,
    parameterValuesSource: IParameterValuesSource,
    documentIndex: number
): Completion.Item[] {
    const completions: Completion.Item[] = [];
    const paramsInParameterFile: string[] = parameterValuesSource.parameterValueDefinitions.map(
        pv => pv.nameValue.unquotedValue.toLowerCase());

    // For each parameter in the template
    for (let param of parameterDefinitionsSource.parameterDefinitions) {
        // Is this already in the parameter file?
        const paramNameLC = param.nameValue.unquotedValue.toLowerCase();
        if (paramsInParameterFile.includes(paramNameLC)) {
            continue;
        }

        const isRequired = !param.defaultValue;
        const label = param.nameValue.quotedValue;
        const paramText = createParameterFromTemplateParameter(parameterDefinitionsSource, param);
        let replacement = paramText;
        const documentation = `Insert a value for parameter "${param.nameValue.unquotedValue}"`;
        const detail = (isRequired ? "(required parameter)" : "(optional parameter)")
            + EOL
            + EOL
            + paramText;

        completions.push(
            createParameterCompletion(
                parameterValuesSource,
                documentIndex,
                label,
                replacement,
                Completion.CompletionKind.PropertyValueForExistingProperty,
                detail,
                documentation));
    }

    return completions;
}

function createParameterCompletion(
    parameterValuesSource: IParameterValuesSource,
    documentIndex: number,
    label: string,
    insertText: string,
    kind: Completion.CompletionKind,
    detail: string,
    documentation: string
): Completion.Item {
    // The completion span is the entire token at the cursor
    const document = parameterValuesSource.document;
    let token = document.getJSONTokenAtDocumentCharacterIndex(documentIndex);

    if (!token && documentIndex > 0) {
        // Also pick up the token touching the cursor on the left, if none found right at it
        token = document.getJSONTokenAtDocumentCharacterIndex(documentIndex - 1);
    }

    const span = token?.span ?? new Span(documentIndex, 0);

    // Comma after?
    if (needsCommaAfterCompletion(parameterValuesSource, documentIndex)) {
        insertText += ',';
    }

    // Comma before?
    const commaEdit = createEditToAddCommaBeforePosition(
        parameterValuesSource,
        documentIndex);

    // Use double quotes around the label if the token is a double-quoted string.
    // That way, the snippet can be used inside or outside of a string, with correct
    // filtering and insertion behavior
    if (token?.type === Json.TokenType.QuotedString) {
        if (label[0] !== '"') {
            label = `"${label}"`;
        }
    }

    return new Completion.Item({
        label,
        insertText,
        span,
        kind,
        detail,
        documentation,
        additionalEdits: commaEdit ? [commaEdit] : undefined
    });
}

function needsCommaAfterCompletion(
    parameterValuesSource: IParameterValuesSource,
    documentCharacterIndex: number
): boolean {
    // If there are any parameters after the one being inserted, we need to add a comma after the new one
    if (parameterValuesSource.parameterValueDefinitions.some(p => p.fullSpan.startIndex >= documentCharacterIndex)) {
        return true;
    }

    return false;
}

export function getPropertyValueCompletionItems(
    parameterDefinitionsSource: IParameterDefinitionsSource | undefined,
    parameterValuesSource: IParameterValuesSource,
    documentIndex: number,
    triggerCharacter: string | undefined
): Completion.Item[] {
    let completions: Completion.Item[] = [];

    if ((!triggerCharacter || triggerCharacter === '"') && canAddPropertyValueHere(parameterValuesSource, documentIndex)) {
        if (parameterDefinitionsSource) {
            completions.push(...getCompletionsForMissingParameters(parameterDefinitionsSource, parameterValuesSource, documentIndex));
        }
        completions.push(getCompletionForNewParameter(parameterValuesSource, documentIndex));
    }

    return completions;
}

// True if inside the "parameters" object, but not inside any properties
// within it.
export function canAddPropertyValueHere(
    parameterValuesSource: IParameterValuesSource,
    documentIndex: number
): boolean {
    const parametersObjectValue = parameterValuesSource.parameterValuesProperty?.value?.asObjectValue;
    if (!parametersObjectValue) {
        // No "parameters" section
        return false;
    }

    const enclosingJsonValue = parameterValuesSource.document.jsonParseResult.getValueAtCharacterIndex(
        documentIndex,
        ContainsBehavior.enclosed);

    if (enclosingJsonValue !== parametersObjectValue) {
        // Directly-enclosing JSON value/object at the cursor is not the "parameters" object
        // (either it's outside it, or it's within a subvalue like an existing parameter)
        return false;
    }

    // Check if we're inside a comment
    if (!!parameterValuesSource.document.jsonParseResult.getCommentTokenAtDocumentIndex(
        documentIndex,
        ContainsBehavior.enclosed)
    ) {
        return false;
    }

    return true;
}

export function getMissingParameterErrors(parameterValues: IParameterValuesSource, parameterDefinitions: IParameterDefinitionsSource): Issue[] {
    const missingRequiredParams: IParameterDefinition[] = getMissingParameters(
        parameterDefinitions,
        parameterValues,
        true // onlyRequiredParameters
    );
    if (missingRequiredParams.length === 0) {
        return [];
    }

    const missingParamNames = missingRequiredParams.map(param => `"${param.nameValue.unquotedValue}"`);
    const message = `The following parameters do not have values: ${missingParamNames.join(', ')}`;
    const span = parameterValues.parameterValuesProperty?.nameValue.span
        ?? (parameterValues.deploymentRootObject ? new Span(parameterValues.deploymentRootObject?.startIndex, 0) : undefined)
        ?? new Span(0, 0);
    return [new Issue(span, message, IssueKind.params_missingRequiredParam)];
}
