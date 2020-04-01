/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Json, templateKeys } from "../extension.bundle";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ext } from './extensionVariables';
import { SortType } from "./sortTemplate";

export class QuickPickItem<T> implements vscode.QuickPickItem {
    public label: string;
    public value: T;
    public description: string;

    constructor(label: string, value: T, description: string) {
        this.label = label;
        this.value = value;
        this.description = description;
    }
}

export function getParameterType(): QuickPickItem<string>[] {
    let items: QuickPickItem<string>[] = [];
    items.push(new QuickPickItem<string>("String", "string", "A string"));
    items.push(new QuickPickItem<string>("Secure string", "securestring", "A secure string"));
    items.push(new QuickPickItem<string>("Int", "int", "An integer"));
    items.push(new QuickPickItem<string>("Bool", "bool", "A boolean"));
    items.push(new QuickPickItem<string>("Object", "object", "An object"));
    items.push(new QuickPickItem<string>("Secure object", "secureobject", "A secure object"));
    items.push(new QuickPickItem<string>("Array", "array", "An array"));
    return items;
}

export function getInsertItemType(): QuickPickItem<SortType>[] {
    let items: QuickPickItem<SortType>[] = [];
    // items.push(new QuickPickItem<SortType>("Function", SortType.Functions, "Insert a function"));
    // items.push(new QuickPickItem<SortType>("Output", SortType.Outputs, "Inserts an output"));
    items.push(new QuickPickItem<SortType>("Parameter", SortType.Parameters, "Inserts a parameter"));
    // items.push(new QuickPickItem<SortType>("Resource", SortType.Resources, "Insert a resource"));
    // items.push(new QuickPickItem<SortType>("Variable", SortType.Variables, "Insert a variable"));
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
            let name = await ext.ui.showInputBox({ prompt: "Name of parameter?" });
            const parameterType = await ext.ui.showQuickPick(getParameterType(), { placeHolder: 'Type of parameter?' });
            let defaultValue = await ext.ui.showInputBox({ prompt: "Default value? Leave empty for no default value", });
            let defaultValueText = defaultValue === '' ? '' : `,\r\n\t\t\t"defaultValue": "${defaultValue}"`;
            let descriptionValue = await ext.ui.showInputBox({ prompt: "Description? Leave empty for no description", });
            let descriptionValueText = descriptionValue === '' ? '' : `,\r\n\t\t\t"metadata": {\r\n\t\t\t\t"description": "${descriptionValue}"\r\n\t\t\t}`;
            let index = parameters?.span.endIndex;

            if (index !== undefined) {
                await textEditor.edit(builder => {
                    let i: number = index!;
                    let pos = textEditor.document.positionAt(i);
                    builder.insert(pos, `\t,"${name}": \{\r\n\t\t\t"type": "${parameterType.value}"${defaultValueText}${descriptionValueText}\r\n\t\t\}\r\n\t`);
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
