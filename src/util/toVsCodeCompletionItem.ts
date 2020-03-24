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

interface ICompletionActivated {
    completionKind: string;
    snippetName: string;
}

export function toVsCodeCompletionItem(deploymentFile: DeploymentDocument, item: Completion.Item): vscode.CompletionItem {
    const insertRange: vscode.Range = getVSCodeRangeFromSpan(deploymentFile, item.insertSpan);

    const vscodeItem = new vscode.CompletionItem(item.label);
    vscodeItem.range = insertRange;
    vscodeItem.insertText = new vscode.SnippetString(item.insertText);
    vscodeItem.detail = item.detail;
    vscodeItem.documentation = item.documention;
    vscodeItem.sortText = item.sortText;
    vscodeItem.commitCharacters = item.commitCharacters;

    switch (item.kind) {
        case Completion.CompletionKind.Function:
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

        case Completion.CompletionKind.DpPropertyValue:
            vscodeItem.kind = vscode.CompletionItemKind.Property;
            break;

        case Completion.CompletionKind.DpNewPropertyValue:
            vscodeItem.kind = vscode.CompletionItemKind.Snippet;
            break;

        case Completion.CompletionKind.DtDependsOn:
            vscodeItem.kind = vscode.CompletionItemKind.Reference; //asdf
            break;

        case Completion.CompletionKind.DtDependsOn2:
            vscodeItem.kind = vscode.CompletionItemKind.Snippet; //asdf
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
    vscodeItem.command = {
        command: "azurerm-vscode-tools.completion-activated",
        title: "completion activated", // won't ever be shown to the user
        arguments: [
            {
                snippetName: item.snippetName,
                completionKind: item.kind
            }
        ]
    };

    return vscodeItem;
}

export function onCompletionActivated(actionContext: IActionContext, args: object): void {
    const options = <ICompletionActivated>args ?? {};
    actionContext.telemetry.properties.snippetName = options.snippetName;
    actionContext.telemetry.properties.completionKind = options.completionKind;
}
