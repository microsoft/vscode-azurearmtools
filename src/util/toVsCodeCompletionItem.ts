/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as Completion from '../Completion';
import { DeploymentFile } from '../DeploymentFile';
import { assert } from "../fixed_assert";
import { getVSCodeRangeFromSpan } from './vscodePosition';

export function toVsCodeCompletionItem(deploymentFile: DeploymentFile, item: Completion.Item): vscode.CompletionItem {
    const insertRange: vscode.Range = getVSCodeRangeFromSpan(deploymentFile, item.insertSpan);

    const vscodeItem = new vscode.CompletionItem(item.name);
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
            assert.fail(`Unrecognized Completion.Type: ${item.kind}`);
            break;
    }

    return vscodeItem;
}
