/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import * as Completion from '../Completion';
import { DeploymentDocument } from '../DeploymentDocument';
import { assertNever } from './assertNever';
import { getVSCodeRangeFromSpan } from './vscodePosition';

export function toVsCodeCompletionItem(deploymentFile: DeploymentDocument, item: Completion.Item): vscode.CompletionItem {
    const range: vscode.Range = getVSCodeRangeFromSpan(deploymentFile, item.span);

    const vscodeItem = new vscode.CompletionItem(item.label);
    vscodeItem.range = range;
    const insertText = item.insertText;
    vscodeItem.insertText = new vscode.SnippetString(insertText);
    vscodeItem.detail = item.detail;
    vscodeItem.documentation = item.documention;
    vscodeItem.commitCharacters = item.commitCharacters;
    vscodeItem.preselect = item.preselect;

    let sortPriorityPrefix: string;
    switch (item.priority) {
        case Completion.CompletionPriority.low:
            sortPriorityPrefix = `${String.fromCharCode(255)}-`;
            break;
        case Completion.CompletionPriority.high:
            sortPriorityPrefix = `${String.fromCharCode(1)}-`;
            break;
        case Completion.CompletionPriority.normal:
            sortPriorityPrefix = '';
            break;
        default:
            assertNever(item.priority);
    }

    // Add priority string to start of sortText, use label if no sortText
    vscodeItem.sortText = `${sortPriorityPrefix}${item.sortText ?? item.label}`;

    switch (item.kind) {
        case Completion.CompletionKind.Function:
        case Completion.CompletionKind.UserFunction:
            vscodeItem.kind = vscode.CompletionItemKind.Function;
            break;

        case Completion.CompletionKind.Parameter:
        case Completion.CompletionKind.Variable:
            vscodeItem.kind = vscode.CompletionItemKind.Variable;
            break;

        case Completion.CompletionKind.Property:
            vscodeItem.kind = vscode.CompletionItemKind.Field;
            break;

        case Completion.CompletionKind.Namespace:
            vscodeItem.kind = vscode.CompletionItemKind.Unit;
            break;

        case Completion.CompletionKind.PropertyValueForExistingProperty:
            vscodeItem.kind = vscode.CompletionItemKind.Property;
            break;

        case Completion.CompletionKind.PropertyValueForNewProperty:
            vscodeItem.kind = vscode.CompletionItemKind.Snippet;
            break;

        case Completion.CompletionKind.ResourceIdResTypeParameter:
        case Completion.CompletionKind.ResourceIdResNameParameter:
            vscodeItem.kind = vscode.CompletionItemKind.Reference;
            break;

        case Completion.CompletionKind.Snippet:
            vscodeItem.kind = vscode.CompletionItemKind.Snippet;
            break;

        default:
            assertNever(item.kind);
    }

    if (item.additionalEdits) {
        vscodeItem.additionalTextEdits = item.additionalEdits.map(
            e => new vscode.TextEdit(
                getVSCodeRangeFromSpan(deploymentFile, e.span),
                e.insertText
            )
        );
    }

    // Add a command to let us know when activated so we can send telemetry
    const telemetryArgs: { [key: string]: string | undefined } = {
        snippet: item.snippetName,
        kind: item.kind,
        function: item.kind === Completion.CompletionKind.Function ? item.label : undefined
    };
    for (let key of Object.getOwnPropertyNames(item.telemetryProperties ?? {})) {
        telemetryArgs[key] = item.telemetryProperties?.[key];
    }
    vscodeItem.command = {
        command: "azurerm-vscode-tools.completion-activated",
        title: "completion activated", // won't ever be shown to the user
        arguments: [
            telemetryArgs
        ]
    };

    return vscodeItem;
}

export function onCompletionActivated(actionContext: IActionContext, telemetryProperties: { [key: string]: string }): void {
    Object.assign(actionContext.telemetry.properties, telemetryProperties ?? {});
}
