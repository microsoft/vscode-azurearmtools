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

export function getItemType(): QuickPickItem<string>[] {
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
    items.push(new QuickPickItem<SortType>("Function", SortType.Functions, "Insert a function"));
    items.push(new QuickPickItem<SortType>("Output", SortType.Outputs, "Inserts an output"));
    items.push(new QuickPickItem<SortType>("Parameter", SortType.Parameters, "Inserts a parameter"));
    // items.push(new QuickPickItem<SortType>("Resource", SortType.Resources, "Insert a resource"));
    items.push(new QuickPickItem<SortType>("Variable", SortType.Variables, "Insert a variable"));
    return items;
}

export async function insertItem(template: DeploymentTemplate | undefined, sortType: SortType, textEditor: vscode.TextEditor): Promise<void> {
    if (!template) {
        return;
    }
    ext.outputChannel.appendLine("Insert item");
    switch (sortType) {
        case SortType.Functions:
            await insertFunction(template, textEditor);
            break;
        case SortType.Outputs:
            await insertOutput(template, textEditor);
            break;
        case SortType.Parameters:
            await insertParameter(template, textEditor);
            break;
        case SortType.Resources:
            break;
        case SortType.Variables:
            await insertVariable(template, textEditor);
            break;
        default:
            vscode.window.showWarningMessage("Unknown insert item type!");
            return;
    }
    vscode.window.showInformationMessage("Done inserting item!");
}

function getTemplateObjectPart(template: DeploymentTemplate, templatePart: string): Json.ObjectValue | undefined {
    let part = getTemplatePart(template, templatePart);
    return Json.asObjectValue(part);
}

function getTemplateArrayPart(template: DeploymentTemplate, templatePart: string): Json.ArrayValue | undefined {
    let part = getTemplatePart(template, templatePart);
    return Json.asArrayValue(part);
}

function getTemplatePart(template: DeploymentTemplate, templatePart: string): Json.Value | undefined {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return undefined;
    }
    return rootValue.getPropertyValue(templatePart);
}

async function insertParameter(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let parameters = getTemplateObjectPart(template, templateKeys.parameters);
    let startText = parameters?.properties.length === 0 ? '\r\n\t\t' : '\t,';
    let name = await ext.ui.showInputBox({ prompt: "Name of parameter?" });
    const parameterType = await ext.ui.showQuickPick(getItemType(), { placeHolder: 'Type of parameter?' });
    let defaultValue = await ext.ui.showInputBox({ prompt: "Default value? Leave empty for no default value", });
    let defaultValueText = defaultValue === '' ? '' : `,\r\n\t\t\t"defaultValue": "${defaultValue}"`;
    let descriptionValue = await ext.ui.showInputBox({ prompt: "Description? Leave empty for no description", });
    let descriptionValueText = descriptionValue === '' ? '' : `,\r\n\t\t\t"metadata": {\r\n\t\t\t\t"description": "${descriptionValue}"\r\n\t\t\t}`;
    let text = `${startText}"${name}": \{\r\n\t\t\t"type": "${parameterType.value}"${defaultValueText}${descriptionValueText}\r\n\t\t\}\r\n\t`;
    let index = parameters?.span.endIndex;
    await insertText(textEditor, index, text);
}

async function insertVariable(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let variables = getTemplateObjectPart(template, templateKeys.variables);
    let startText = variables?.properties.length === 0 ? '\r\n\t\t' : '\t,';
    let name = await ext.ui.showInputBox({ prompt: "Name of variable?" });
    let text = `${startText}"${name}": ""\r\n\t`;
    let index = variables?.span.endIndex;
    await insertTextAndSetCursor(textEditor, index, text);
}

async function insertOutput(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let outputs = getTemplateObjectPart(template, templateKeys.outputs);
    let startText = outputs?.properties.length === 0 ? '\r\n\t\t' : '\t,';
    let name = await ext.ui.showInputBox({ prompt: "Name of output?" });
    const outputType = await ext.ui.showQuickPick(getItemType(), { placeHolder: 'Type of output?' });
    let text = `${startText}"${name}": \{\r\n\t\t\t"type": "${outputType.value}",\r\n\t\t\t"value": ""\r\n\t\t\}\r\n\t`;
    let index = outputs?.span.endIndex;
    await insertTextAndSetCursor(textEditor, index, text);
}

async function insertFunction(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let functions = getTemplateArrayPart(template, templateKeys.functions);
    let index: number = 0;
    let text: string;
    let namespaceName: string = "";
    if (functions?.length === 0) {
        namespaceName = await ext.ui.showInputBox({ prompt: "Name of namespace?" });
        index = functions?.span.endIndex;
    } else {
        let namespace = Json.asObjectValue(functions?.elements[0]);
        let members2 = namespace?.getPropertyValue("members");
        index = members2?.span.endIndex! - 4;
    }
    let functionName = await ext.ui.showInputBox({ prompt: "Name of function?" });
    let functionDef = await getFunction();
    if (namespaceName !== '') {
        let members: any = {};
        members[functionName] = functionDef;
        let namespace = {
            namespace: namespaceName,
            members: members
        };
        text = JSON.stringify(namespace, null, '\t');
        let indentedText = indent(`\r\n${text}\r\n`, 2);
        await insertTextAndSetCursor(textEditor, index, indentedText + '\t');
    } else {
        text = JSON.stringify(functionDef, null, '\t');
        let indentedText = indent(`"${functionName}": ${text}\r\n`, 4);
        await insertTextAndSetCursor(textEditor, index, `,\r\n${indentedText}\t`);
    }
}
async function getFunction(): Promise<any> {
    const outputType = await ext.ui.showQuickPick(getItemType(), { placeHolder: 'Type of function output?' });
    let parameters = await getFunctionParameters();
    let functionDef = {
        parameters: parameters,
        output: {
            type: outputType.value,
            value: ""
        }
    };
    return functionDef;
}
async function getFunctionParameters(): Promise<any[]> {
    let parameterName: string;
    let parameters = [];
    do {
        parameterName = await ext.ui.showInputBox({ prompt: "Name of parameter? Leave empty for no more parameters" });
        if (parameterName !== '') {
            const parameterType = await ext.ui.showQuickPick(getItemType(), { placeHolder: `Type of parameter ${parameterName}?` });
            parameters.push({
                name: parameterName,
                type: parameterType.value
            });
        }

    } while (parameterName !== '');
    return parameters;
}

async function insertText(textEditor: vscode.TextEditor, index: number | undefined, text: string): Promise<void> {
    if (index !== undefined) {
        await textEditor.edit(builder => {
            let i: number = index!;
            let pos = textEditor.document.positionAt(i);
            builder.insert(pos, text);
        });
    }
}

async function insertTextAndSetCursor(textEditor: vscode.TextEditor, index: number | undefined, text: string): Promise<void> {
    await insertText(textEditor, index, text);
    let cursorPos = text.indexOf('""');
    let pos = textEditor.document.positionAt(index! + cursorPos - 1);
    let newSelection = new vscode.Selection(pos, pos);
    textEditor.selection = newSelection;
    textEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.Default);
}

/**
 * Indents the given string
 * @param {string} str  The string to be indented.
 * @param {number} numOfIndents  The amount of indentations to place at the
 *     beginning of each line of the string.
 * @param {number=} opt_spacesPerIndent  Optional.  If specified, this should be
 *     the number of spaces to be used for each tab that would ordinarily be
 *     used to indent the text.  These amount of spaces will also be used to
 *     replace any tab characters that already exist within the string.
 * @return {string}  The new string with each line beginning with the desired
 *     amount of indentation.
 */
function indent(str: string, numOfIndents: number) {
    str = str.replace(/^(?=.)/gm, new Array(numOfIndents + 1).join('\t'));
    return str;
}