/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from "path";
import * as vscode from "vscode";
// tslint:disable-next-line:no-duplicate-imports
import { commands } from "vscode";
import { IAzureUserInput } from "vscode-azureextensionui";
import { Json, templateKeys } from "../extension.bundle";
import { assetsPath } from "./constants";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ext } from './extensionVariables';
import { TemplateSectionType } from "./sortTemplate";

const insertCursorText = '[]';

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

function getResourceSnippets(): vscode.QuickPickItem[] {
    let items: vscode.QuickPickItem[] = [];
    let snippetPath = path.join(assetsPath, "armsnippets.jsonc");
    let content = fse.readFileSync(snippetPath, "utf8");
    let tree = Json.parse(content);
    if (!(tree.value instanceof Json.ObjectValue)) {
        return items;
    }
    for (const property of tree.value.properties) {
        if (isResourceSnippet(property)) {
            items.push(getQuickPickItem(property.nameValue.unquotedValue));
        }
    }
    return items.sort((a, b) => a.label.localeCompare(b.label));
}

function isResourceSnippet(snippet: Json.Property): boolean {
    if (!snippet.value || !(snippet.value instanceof Json.ObjectValue)) {
        return false;
    }
    let body = snippet.value.getProperty("body");
    if (!body || !(body.value instanceof Json.ArrayValue)) {
        return false;
    }
    for (const row of body.value.elements) {
        if (!(row instanceof Json.StringValue)) {
            continue;
        }
        if (row.unquotedValue.indexOf("\"Microsoft.") >= 0) {
            return true;
        }
    }
    return false;
}

export function getQuickPickItem(label: string): vscode.QuickPickItem {
    return { label: label };
}

export function getItemTypeQuickPicks(): QuickPickItem<TemplateSectionType>[] {
    let items: QuickPickItem<TemplateSectionType>[] = [];
    items.push(new QuickPickItem<TemplateSectionType>("Function", TemplateSectionType.Functions, "Insert a function"));
    items.push(new QuickPickItem<TemplateSectionType>("Output", TemplateSectionType.Outputs, "Insert an output"));
    items.push(new QuickPickItem<TemplateSectionType>("Parameter", TemplateSectionType.Parameters, "Insert a parameter"));
    items.push(new QuickPickItem<TemplateSectionType>("Resource", TemplateSectionType.Resources, "Insert a resource"));
    items.push(new QuickPickItem<TemplateSectionType>("Variable", TemplateSectionType.Variables, "Insert a variable"));
    return items;
}

export class InsertItem {
    private ui: IAzureUserInput;

    constructor(ui: IAzureUserInput) {
        this.ui = ui;
    }

    public async insertItem(template: DeploymentTemplate | undefined, sectionType: TemplateSectionType, textEditor: vscode.TextEditor): Promise<void> {
        if (!template) {
            return;
        }
        ext.outputChannel.appendLine("Insert item");
        switch (sectionType) {
            case TemplateSectionType.Functions:
                if (await this.insertFunction(template, textEditor)) {
                    vscode.window.showInformationMessage("Please type the output of the function.");
                }
                break;
            case TemplateSectionType.Outputs:
                if (await this.insertOutput(template, textEditor)) {
                    vscode.window.showInformationMessage("Please type the the value of the output.");
                }
                break;
            case TemplateSectionType.Parameters:
                if (await this.insertParameter(template, textEditor)) {
                    vscode.window.showInformationMessage("Done inserting parameter.");
                }
                break;
            case TemplateSectionType.Resources:
                if (await this.insertResource(template, textEditor)) {
                    vscode.window.showInformationMessage("Press TAB to move between the tab stops.");
                }
                break;
            case TemplateSectionType.Variables:
                if (await this.insertVariable(template, textEditor)) {
                    vscode.window.showInformationMessage("Please type the the value of the variable.");
                }
                break;
            default:
                vscode.window.showWarningMessage("Unknown insert item type!");
                return;
        }
    }

    private getTemplateObjectPart(template: DeploymentTemplate, templatePart: string): Json.ObjectValue | undefined {
        let part = this.getTemplatePart(template, templatePart);
        return Json.asObjectValue(part);
    }

    private getTemplateArrayPart(template: DeploymentTemplate, templatePart: string): Json.ArrayValue | undefined {
        let part = this.getTemplatePart(template, templatePart);
        return Json.asArrayValue(part);
    }

    private getTemplatePart(template: DeploymentTemplate, templatePart: string): Json.Value | undefined {
        let rootValue = template.topLevelValue;
        if (!rootValue) {
            return undefined;
        }
        return rootValue.getPropertyValue(templatePart);
    }

    private async insertParameter(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<boolean> {
        let name = await this.ui.showInputBox({ prompt: "Name of parameter?" });
        const parameterType = await this.ui.showQuickPick(getItemType(), { placeHolder: 'Type of parameter?' });
        let parameter: Parameter = {
            type: parameterType.value
        };
        let defaultValue = await this.ui.showInputBox({ prompt: "Default value? Leave empty for no default value.", });
        if (defaultValue !== '') {
            parameter.defaultValue = defaultValue;
        }
        let description = await this.ui.showInputBox({ prompt: "Description? Leave empty for no description.", });
        if (description !== '') {
            parameter.metadata = {
                description: description
            };
        }
        return await this.insertInObject(template, textEditor, templateKeys.parameters, parameter, name);
    }

    // tslint:disable-next-line:no-any
    private async insertInObject(template: DeploymentTemplate, textEditor: vscode.TextEditor, part: string, data: any, name: string): Promise<boolean> {
        let templatePart = this.getTemplateObjectPart(template, part);
        if (!templatePart) {
            let topLevel = template.topLevelValue;
            if (!topLevel) {
                vscode.window.showErrorMessage('Invalid ARM template!');
                return false;
            }
            // tslint:disable-next-line:no-any
            let subPart: any = {};
            // tslint:disable-next-line:no-unsafe-any
            subPart[name] = data;
            await this.insertInObjectInternal(topLevel, textEditor, subPart, part, 1);
        } else {
            await this.insertInObjectInternal(templatePart, textEditor, data, name);
        }
        return true;
    }

    // tslint:disable-next-line:no-any
    private async insertInObjectInternal(templatePart: Json.ObjectValue, textEditor: vscode.TextEditor, data: any, name: string, indentLevel: number = 2): Promise<number> {
        let isFirstItem = templatePart.properties.length === 0;
        let startText = isFirstItem ? '' : ',';
        let index = isFirstItem ? templatePart.span.endIndex : templatePart.properties[templatePart.properties.length - 1].span.afterEndIndex;
        let tabs = '\t'.repeat(indentLevel - 1);
        let endText = isFirstItem ? `\r\n${tabs}` : ``;
        let text = typeof (data) === 'object' ? JSON.stringify(data, null, '\t') : `"${data}"`;
        let indentedText = this.indent(`\r\n"${name}": ${text}`, indentLevel);
        return await this.insertText(textEditor, index, `${startText}${indentedText}${endText}`);
    }

    private async insertVariable(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<boolean> {
        let name = await this.ui.showInputBox({ prompt: "Name of variable?" });
        return await this.insertInObject(template, textEditor, templateKeys.variables, insertCursorText, name);
    }

    private async insertOutput(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<boolean> {
        let name = await this.ui.showInputBox({ prompt: "Name of output?" });
        const outputType = await this.ui.showQuickPick(getItemType(), { placeHolder: 'Type of output?' });
        let output: Output = {
            type: outputType.value,
            value: insertCursorText.replace(/"/g, '')
        };
        return await this.insertInObject(template, textEditor, templateKeys.outputs, output, name);
    }
    private async insertFunctionAsTopLevel(topLevel: Json.ObjectValue | undefined, textEditor: vscode.TextEditor): Promise<boolean> {
        if (!topLevel) {
            vscode.window.showErrorMessage('Invalid ARM template!');
            return false;
        }
        let functions = [await this.getFunctionNamespace()];
        await this.insertInObjectInternal(topLevel, textEditor, functions, "functions", 1);
        return true;
    }

    private async insertFunctionAsNamespace(functions: Json.ArrayValue, textEditor: vscode.TextEditor): Promise<boolean> {
        let namespace = await this.getFunctionNamespace();
        await this.insertInArray(functions, textEditor, namespace);
        return true;
    }

    private async insertFunctionAsMembers(namespace: Json.ObjectValue, textEditor: vscode.TextEditor): Promise<void> {
        let functionName = await this.ui.showInputBox({ prompt: "Name of function?" });
        let functionDef = await this.getFunction();
        // tslint:disable-next-line:no-any
        let members: any = {};
        // tslint:disable-next-line:no-unsafe-any
        members[functionName] = functionDef;
        await this.insertInObjectInternal(namespace, textEditor, members, 'members', 3);
    }

    private async insertFunctionAsFunction(members: Json.ObjectValue, textEditor: vscode.TextEditor): Promise<void> {
        let functionName = await this.ui.showInputBox({ prompt: "Name of function?" });
        let functionDef = await this.getFunction();
        await this.insertInObjectInternal(members, textEditor, functionDef, functionName, 4);
    }

    private async insertFunction(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<boolean> {
        let functions = this.getTemplateArrayPart(template, templateKeys.functions);
        if (!functions) {
            // tslint:disable-next-line:no-unsafe-any
            return await this.insertFunctionAsTopLevel(template.topLevelValue, textEditor);
        }
        if (functions.length === 0) {
            return await this.insertFunctionAsNamespace(functions, textEditor);
        }
        let namespace = Json.asObjectValue(functions.elements[0]);
        if (!namespace) {
            vscode.window.showErrorMessage('The first namespace in functions is not an object!');
            return false;
        }
        let members = namespace.getPropertyValue("members");
        if (!members) {
            await this.insertFunctionAsMembers(namespace, textEditor);
            return true;
        }
        let membersObject = Json.asObjectValue(members);
        if (!membersObject) {
            vscode.window.showErrorMessage('The first namespace in functions does not have members as an object!');
            return false;
        }
        await this.insertFunctionAsFunction(membersObject, textEditor);
        return true;
    }

    private async insertResource(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<boolean> {
        let resources = this.getTemplateArrayPart(template, templateKeys.resources);
        let pos: vscode.Position;
        let index: number;
        let text = "\r\n\t\t\r\n\t";
        if (!resources) {
            if (!template.topLevelValue) {
                vscode.window.showErrorMessage("Invalid ARM template!");
                return false;
            }
            // tslint:disable-next-line:no-any
            let subPart: any = [];
            index = await this.insertInObjectInternal(template.topLevelValue, textEditor, subPart, "resources", 1);
            pos = textEditor.selection.active;
        } else {
            index = resources.span.endIndex;
            if (resources.elements.length > 0) {
                let lastIndex = resources.elements.length - 1;
                index = resources.elements[lastIndex].span.afterEndIndex;
                text = `,\r\n\t\t`;
            }
        }
        const resource = await this.ui.showQuickPick(getResourceSnippets(), { placeHolder: 'What resource do you want to insert?' });
        await this.insertText(textEditor, index, text, false);
        let range = new vscode.Range(textEditor.document.positionAt(index), textEditor.document.positionAt(index + this.formatText(text, textEditor).length));
        let insertedText = textEditor.document.getText(range);
        let lookFor = this.formatText('\t\t', textEditor);
        let cursorPos = insertedText.indexOf(lookFor);
        pos = textEditor.document.positionAt(index + cursorPos + lookFor.length);
        let newSelection = new vscode.Selection(pos, pos);
        textEditor.selection = newSelection;
        await commands.executeCommand('editor.action.insertSnippet', { name: resource.label });
        textEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.Default);
        return true;
    }

    private async getFunction(): Promise<Function> {
        const outputType = await this.ui.showQuickPick(getItemType(), { placeHolder: 'Type of function output?' });
        let parameters = await this.getFunctionParameters();
        let functionDef = {
            parameters: parameters,
            output: {
                type: outputType.value,
                value: insertCursorText
            }
        };
        return functionDef;
    }

    private async getFunctionParameters(): Promise<FunctionParameter[]> {
        let parameterName: string;
        let parameters = [];
        do {
            parameterName = await this.ui.showInputBox({ prompt: "Name of parameter? Leave empty for no more parameters" });
            if (parameterName !== '') {
                const parameterType = await this.ui.showQuickPick(getItemType(), { placeHolder: `Type of parameter ${parameterName}?` });
                parameters.push({
                    name: parameterName,
                    type: parameterType.value
                });
            }

        } while (parameterName !== '');
        return parameters;
    }

    // tslint:disable-next-line:no-any
    private async insertInArray(templatePart: Json.ArrayValue, textEditor: vscode.TextEditor, data: any): Promise<void> {
        let index = templatePart.span.endIndex;
        let text = JSON.stringify(data, null, '\t');
        let indentedText = this.indent(`\r\n${text}\r\n`, 2);
        await this.insertText(textEditor, index, `${indentedText}\t`, true);
    }

    private async getFunctionNamespace(): Promise<FunctionNameSpace> {
        let namespaceName = await this.ui.showInputBox({ prompt: "Name of namespace?" });
        let namespace = {
            namespace: namespaceName,
            members: await this.getFunctionMembers()
        };
        return namespace;
    }

    // tslint:disable-next-line:no-any
    private async getFunctionMembers(): Promise<any> {
        let functionName = await this.ui.showInputBox({ prompt: "Name of function?" });
        let functionDef = await this.getFunction();
        // tslint:disable-next-line:no-any
        let members: any = {};
        // tslint:disable-next-line:no-unsafe-any
        members[functionName] = functionDef;
        return members;
    }

    private async insertText(textEditor: vscode.TextEditor, index: number, text: string, setCursor: boolean = false): Promise<number> {
        text = this.formatText(text, textEditor);
        let pos = textEditor.document.positionAt(index);
        await textEditor.edit(builder => builder.insert(pos, text));
        textEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.Default);
        if (text.lastIndexOf(insertCursorText) >= 0) {
            let insertedText = textEditor.document.getText(new vscode.Range(pos, textEditor.document.positionAt(index + text.length)));
            let cursorPos = insertedText.lastIndexOf(insertCursorText);
            let newIndex = index + cursorPos + insertCursorText.length / 2;
            let pos2 = textEditor.document.positionAt(newIndex);
            textEditor.selection = new vscode.Selection(pos2, pos2);
            return newIndex;
        }
        return 0;
    }

    private formatText(text: string, textEditor: vscode.TextEditor): string {
        if (textEditor.options.insertSpaces === true) {
            text = text.replace(/\t/g, ' '.repeat(Number(textEditor.options.tabSize)));
        } else {
            text = text.replace(/ {4}/g, '\t');
        }
        if (textEditor.document.eol === vscode.EndOfLine.LF) {
            text = text.replace(/\r\n/g, '\n');
        }
        return text;
    }

    /**
     * Indents the given string
     * @param str  The string to be indented.
     * @param numOfIndents  The amount of indentations to place at the
     *     beginning of each line of the string.
     * @return   The new string with each line beginning with the desired
     *     amount of indentation.
     */
    private indent(str: string, numOfIndents: number): string {
        // tslint:disable-next-line:prefer-array-literal
        str = str.replace(/^(?=.)/gm, new Array(numOfIndents + 1).join('\t'));
        return str;
    }
}

interface ParameterMetaData {
    description: string;
}

interface Parameter {
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
    defaultValue?: string;
    metadata?: ParameterMetaData;
}

interface Output {
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
    value: string;
}

interface Function {
    parameters: Parameter[];
    output: Output;
}

interface FunctionParameter {
    name: string;
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
}

interface FunctionNameSpace {
    namespace: string;
    // tslint:disable-next-line:no-any
    members: any[];
}
