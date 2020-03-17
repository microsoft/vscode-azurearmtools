/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import * as Completion from '../Completion';
import { DeploymentDoc } from '../DeploymentDoc';
import { assertNever } from './assertNever';
import { getVSCodeRangeFromSpan } from './vscodePosition';

interface ICompletionActivated {
    completionKind: string;
    snippetName: string;
}

export function toVsCodeCompletionItem(deploymentFile: DeploymentDoc, item: Completion.Item): vscode.CompletionItem {
    const insertRange: vscode.Range = getVSCodeRangeFromSpan(deploymentFile, item.insertSpan);

    const vscodeItem = new vscode.CompletionItem(item.label);
    vscodeItem.range = insertRange;
    vscodeItem.insertText = new vscode.SnippetString(item.insertText);
    vscodeItem.detail = item.detail;
    vscodeItem.documentation = item.documention;

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

        case Completion.CompletionKind.PropertyValue:
            vscodeItem.kind = vscode.CompletionItemKind.Variable; //asdf
            break;

        case Completion.CompletionKind.NewPropertyValue:
            vscodeItem.kind = vscode.CompletionItemKind.Variable; //asdf
            break;

        default:
            assertNever(item.kind);
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
