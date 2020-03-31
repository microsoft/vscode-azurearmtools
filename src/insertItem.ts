/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Json, templateKeys } from "../extension.bundle";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ext } from './extensionVariables';
import { SortQuickPickItem, SortType } from "./sortTemplate";

export function getInsertItemQuickPickItems(): SortQuickPickItem[] {
    let items: SortQuickPickItem[] = [];
    items.push(new SortQuickPickItem("Function", SortType.Functions, "Insert a function"));
    items.push(new SortQuickPickItem("Output", SortType.Outputs, "Inserts an output"));
    items.push(new SortQuickPickItem("Parameter", SortType.Parameters, "Inserts a parameter"));
    items.push(new SortQuickPickItem("Resource", SortType.Resources, "Insert a resource"));
    items.push(new SortQuickPickItem("Variable", SortType.Variables, "Insert a variable"));
    return items;
}

export async function insertItem(template: DeploymentTemplate | undefined, sortType: SortType, textEditor: vscode.TextEditor): Promise<void> {
    if (!template) {
        return;
    }
    ext.outputChannel.appendLine("Insert item");
    switch (sortType) {
        case SortType.Functions:
            break;
        case SortType.Outputs:
            break;
        case SortType.Parameters:
            let rootValue = template.topLevelValue;
            if (!rootValue) {
                return;
            }
            let parameters = Json.asObjectValue(rootValue.getPropertyValue(templateKeys.parameters));
            let index = parameters?.span.afterEndIndex;
            if (index !== undefined) {
                await textEditor.edit(builder => {
                    let i: number = index!;
                    let pos = textEditor.document.positionAt(i);
                    builder.insert(pos, "Hello world!");
                });
            }
            break;
        case SortType.Resources:
            break;
        case SortType.Variables:
            break;
        default:
            vscode.window.showWarningMessage("Unknown insert item type!");
            return;
    }
    vscode.window.showInformationMessage("Done inserting item!");
}
