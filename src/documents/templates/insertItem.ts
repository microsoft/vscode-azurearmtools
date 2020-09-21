/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import * as vscode from "vscode";
// tslint:disable-next-line:no-duplicate-imports
import { commands } from "vscode";
import { IActionContext, IAzureQuickPickItem, IAzureUserInput } from "vscode-azureextensionui";
import { Json, templateKeys } from "../../../extension.bundle";
import { ext } from "../../extensionVariables";
import { ISnippet } from "../../snippets/ISnippet";
import { KnownContexts } from "../../snippets/KnownContexts";
import { assertNever } from '../../util/assertNever';
import { DeploymentTemplateDoc } from "./DeploymentTemplateDoc";
import { TemplateSectionType } from "./TemplateSectionType";

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
type ItemType = "string" | "securestring" | "int" | "bool" | "bool" | "object" | "secureobject" | "array";

export function getItemType(): QuickPickItem<ItemType>[] {
    let items: QuickPickItem<ItemType>[] = [];
    items.push(new QuickPickItem<ItemType>("String", "string", "A string"));
    items.push(new QuickPickItem<ItemType>("Secure string", "securestring", "A secure string"));
    items.push(new QuickPickItem<ItemType>("Int", "int", "An integer"));
    items.push(new QuickPickItem<ItemType>("Bool", "bool", "A boolean"));
    items.push(new QuickPickItem<ItemType>("Object", "object", "An object"));
    items.push(new QuickPickItem<ItemType>("Secure object", "secureobject", "A secure object"));
    items.push(new QuickPickItem<ItemType>("Array", "array", "An array"));
    return items;
}

async function getResourceSnippets(): Promise<IAzureQuickPickItem<ISnippet>[]> {
    let items: IAzureQuickPickItem<ISnippet>[] = [];
    const snippets = await ext.snippetManager.value.getSnippets(KnownContexts.resources);
    for (const snippet of snippets) {
        items.push({
            label: snippet.name,
            data: snippet
        });
    }
    return items.sort((a, b) => a.label.localeCompare(b.label));
}

export function getQuickPickItem(label: string, snippet: ISnippet): IAzureQuickPickItem<ISnippet> {
    return { label: label, data: snippet };
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

    public async insertItem(template: DeploymentTemplateDoc | undefined, sectionType: TemplateSectionType, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        if (!template) {
            return;
        }
        switch (sectionType) {
            case TemplateSectionType.Functions:
                await this.insertFunction(template, textEditor, context);
                vscode.window.showInformationMessage("Please type the output of the function.");
                break;
            case TemplateSectionType.Outputs:
                await this.insertOutput(template, textEditor, context);
                vscode.window.showInformationMessage("Please type the value of the output.");
                break;
            case TemplateSectionType.Parameters:
                await this.insertParameter(template, textEditor, context);
                vscode.window.showInformationMessage("Done inserting parameter.");
                break;
            case TemplateSectionType.Resources:
                await this.insertResource(template, textEditor, context);
                vscode.window.showInformationMessage("Press TAB to move between the tab stops.");
                break;
            case TemplateSectionType.Variables:
                await this.insertVariable(template, textEditor, context);
                vscode.window.showInformationMessage("Please type the value of the variable.");
                break;
            case TemplateSectionType.TopLevel:
                assert.fail("Unknown insert item type!");
            default:
                assertNever(sectionType);
        }
    }

    private getTemplateObjectPart(template: DeploymentTemplateDoc, templatePart: string): Json.ObjectValue | undefined {
        return this.getTemplatePart(template, templatePart)?.asObjectValue;
    }

    private getTemplateArrayPart(template: DeploymentTemplateDoc, templatePart: string): Json.ArrayValue | undefined {
        return this.getTemplatePart(template, templatePart)?.asArrayValue;
    }

    private getTemplatePart(template: DeploymentTemplateDoc, templatePart: string): Json.Value | undefined {
        return template.topLevelValue?.getPropertyValue(templatePart);
    }

    private async insertParameter(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        let name = await this.ui.showInputBox({ prompt: "Name of parameter?" });
        const parameterType = await this.ui.showQuickPick(getItemType(), { placeHolder: 'Type of parameter?' });
        let parameter: Parameter = {
            type: parameterType.value
        };
        let defaultValue = await this.ui.showInputBox({ prompt: "Default value? Leave empty for no default value.", });
        if (defaultValue) {
            parameter.defaultValue = this.getDefaultValue(defaultValue, parameterType.value, context);
        }
        let description = await this.ui.showInputBox({ prompt: "Description? Leave empty for no description.", });
        if (description) {
            parameter.metadata = {
                description: description
            };
        }
        await this.insertInObject({
            template,
            textEditor,
            part: templateKeys.parameters,
            data: parameter,
            name,
            context,
            setCursor: false
        });
    }

    private throwExpectedError(message: string, context: IActionContext, suppressReportIssue: boolean = true): void {
        context.errorHandling.suppressReportIssue = suppressReportIssue;
        throw new Error(message);
    }

    private getDefaultValue(defaultValue: string, parameterType: ItemType, context: IActionContext): string | number | boolean | unknown | {} | [] {
        switch (parameterType) {
            case "int":
                let intValue = Number(defaultValue);
                if (isNaN(intValue)) {
                    this.throwExpectedError("Invalid integer!", context);
                }
                return intValue;
            case "array":
                try {
                    return JSON.parse(defaultValue);
                } catch (error) {
                    this.throwExpectedError("Invalid array!", context);
                }
                break;
            case "object":
            case "secureobject":
                try {
                    return JSON.parse(defaultValue);
                } catch (error) {
                    this.throwExpectedError("Invalid object!", context);
                }
                break;
            case "bool":
                switch (defaultValue) {
                    case "true":
                        return true;
                    case "false":
                        return false;
                    default:
                        this.throwExpectedError("Invalid boolean!", context);
                }
                break;
            case "string":
            case "securestring":
                return defaultValue;
            default:
                assertNever(parameterType);
        }
    }

    private async insertInObject(
        { template,
            textEditor,
            part,
            data,
            name,
            context,
            setCursor = true
        }: {
            template: DeploymentTemplateDoc;
            textEditor: vscode.TextEditor;
            part: string;
            data: Data | unknown;
            name: string;
            context: IActionContext;
            setCursor?: boolean;
        }): Promise<void> {
        let templatePart = this.getTemplateObjectPart(template, part);
        if (!templatePart) {
            let topLevel = template.topLevelValue;
            if (!topLevel) {
                context.errorHandling.suppressReportIssue = true;
                throw new Error("Invalid ARM template!");
            }
            let subPart: Data = {};
            subPart[name] = data;
            await this.insertInObjectHelper({
                templatePart: topLevel,
                textEditor,
                data: subPart,
                name: part,
                indentLevel: 1,
                setCursor
            });
        } else {
            await this.insertInObjectHelper({
                templatePart,
                textEditor,
                data,
                name,
                indentLevel: undefined,
                setCursor
            });
        }
    }

    /**
     * Insert data into an template object (parameters, variables and outputs).
     * @returns The document index of the cursor after the text has been inserted.
     */
    // tslint:disable-next-line:no-any
    private async insertInObjectHelper(
        { templatePart,
            textEditor,
            data,
            name,
            indentLevel = 2,
            setCursor = true
        }: {
            templatePart: Json.ObjectValue;
            textEditor: vscode.TextEditor;
            // tslint:disable-next-line:no-any
            data: any;
            name: string;
            indentLevel?: number;
            setCursor?: boolean;
        }): Promise<number> {
        let isFirstItem = templatePart.properties.length === 0;
        let startText = isFirstItem ? '' : ',';
        let index = isFirstItem ? templatePart.span.endIndex :
            templatePart.properties[templatePart.properties.length - 1].span.afterEndIndex;
        let tabs = '\t'.repeat(indentLevel - 1);
        let endText = isFirstItem ? `\r\n${tabs}` : ``;
        let text = typeof (data) === 'object' ? JSON.stringify(data, null, '\t') : `"${data}"`;
        let indentedText = this.indent(`\r\n"${name}": ${text}`, indentLevel);
        return await this.insertText(textEditor, index, `${startText}${indentedText}${endText}`, setCursor);
    }

    private async insertVariable(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        let name = await this.ui.showInputBox({ prompt: "Name of variable?" });
        await this.insertInObject({
            template,
            textEditor,
            part: templateKeys.variables,
            data: insertCursorText,
            name,
            context
        });
    }

    private async insertOutput(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        let name = await this.ui.showInputBox({ prompt: "Name of output?" });
        const outputType = await this.ui.showQuickPick(getItemType(), { placeHolder: 'Type of output?' });
        let output: Output = {
            type: outputType.value,
            value: insertCursorText.replace(/"/g, '')
        };
        await this.insertInObject({
            template,
            textEditor,
            part: templateKeys.outputs,
            data: output,
            name,
            context
        });
    }
    private async insertFunctionAsTopLevel(topLevel: Json.ObjectValue | undefined, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        if (!topLevel) {
            context.errorHandling.suppressReportIssue = true;
            throw new Error("Invalid ARM template!");
        }
        let functions = [await this.getFunctionNamespace()];
        await this.insertInObjectHelper({
            templatePart: topLevel,
            textEditor,
            data: functions,
            name: templateKeys.functions,
            indentLevel: 1
        });
    }

    private async insertFunctionAsNamespace(functions: Json.ArrayValue, textEditor: vscode.TextEditor): Promise<void> {
        let namespace = await this.getFunctionNamespace();
        await this.insertInArray(functions, textEditor, namespace);
    }

    private async insertFunctionAsMembers(namespace: Json.ObjectValue, textEditor: vscode.TextEditor): Promise<void> {
        let functionName = await this.ui.showInputBox({ prompt: "Name of function?" });
        let functionDef = await this.getFunction();
        // tslint:disable-next-line:no-any
        let members: any = {};
        // tslint:disable-next-line:no-unsafe-any
        members[functionName] = functionDef;
        await this.insertInObjectHelper({
            templatePart: namespace,
            textEditor,
            data: members,
            name: templateKeys.userFunctionMembers,
            indentLevel: 3
        });
    }

    private async insertFunctionAsFunction(members: Json.ObjectValue, textEditor: vscode.TextEditor): Promise<void> {
        let functionName = await this.ui.showInputBox({ prompt: "Name of function?" });
        let functionDef = await this.getFunction();
        await this.insertInObjectHelper({
            templatePart: members,
            textEditor,
            data: functionDef,
            name: functionName,
            indentLevel: 4
        });
    }

    private async insertFunction(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        let functions = this.getTemplateArrayPart(template, templateKeys.functions);
        if (!functions) {
            // tslint:disable-next-line:no-unsafe-any
            await this.insertFunctionAsTopLevel(template.topLevelValue, textEditor, context);
            return;
        }
        if (functions.length === 0) {
            await this.insertFunctionAsNamespace(functions, textEditor);
            return;
        }
        let namespace = Json.asObjectValue(functions.elements[0]);
        if (!namespace) {
            context.errorHandling.suppressReportIssue = true;
            throw new Error("The first namespace in functions is not an object!");
        }
        let members = namespace.getPropertyValue(templateKeys.userFunctionMembers);
        if (!members) {
            await this.insertFunctionAsMembers(namespace, textEditor);
            return;
        }
        let membersObject = Json.asObjectValue(members);
        if (!membersObject) {
            context.errorHandling.suppressReportIssue = true;
            throw new Error("The first namespace in functions does not have members as an object!");
        }
        await this.insertFunctionAsFunction(membersObject, textEditor);
        return;
    }

    private async insertResource(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        let resources = this.getTemplateArrayPart(template, templateKeys.resources);
        let index: number;
        let prepend = "\r\n\t\t\r\n\t";
        if (!resources) {
            if (!template.topLevelValue) {
                context.errorHandling.suppressReportIssue = true;
                throw new Error("Invalid ARM template!");
            }
            // tslint:disable-next-line:no-any
            let subPart: any = [];
            index = await this.insertInObjectHelper({
                templatePart: template.topLevelValue,
                textEditor,
                data: subPart,
                name: templateKeys.resources,
                indentLevel: 1
            });
        } else {
            index = resources.span.endIndex;
            if (resources.elements.length > 0) {
                let lastIndex = resources.elements.length - 1;
                index = resources.elements[lastIndex].span.afterEndIndex;
                prepend = `,\r\n\t\t`;
            }
        }
        const resource = await this.ui.showQuickPick(await getResourceSnippets(), { placeHolder: 'What resource do you want to insert?' });
        await this.insertText(textEditor, index, prepend);
        let newCursorPosition = this.getCursorPositionForInsertResource(textEditor, index, prepend);
        textEditor.selection = new vscode.Selection(newCursorPosition, newCursorPosition);
        await commands.executeCommand('editor.action.insertSnippet', { snippet: resource.data.insertText });
        textEditor.revealRange(new vscode.Range(newCursorPosition, newCursorPosition), vscode.TextEditorRevealType.AtTop);
    }

    private getCursorPositionForInsertResource(textEditor: vscode.TextEditor, index: number, prepend: string): vscode.Position {
        let prependRange = new vscode.Range(textEditor.document.positionAt(index), textEditor.document.positionAt(index + this.formatText(prepend, textEditor).length));
        let prependFromDocument = textEditor.document.getText(prependRange);
        let lookFor = this.formatText('\t\t', textEditor);
        let cursorPos = prependFromDocument.indexOf(lookFor);
        return textEditor.document.positionAt(index + cursorPos + lookFor.length);
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
            const msg = parameters.length === 0 ? "Name of first parameter?" : "Name of next parameter?";
            const leaveEmpty = "Press 'Enter' if there are no more parameters.";
            parameterName = await this.ui.showInputBox({ prompt: msg, placeHolder: leaveEmpty });
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
        await this.insertText(textEditor, index, `${indentedText}\t`);
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

    /**
     * Insert text into the document.
     * @param textEditor The text editor to insert the text into.
     * @param index The document index where to insert the text.
     * @param text The text to be inserted.
     * @returns The document index of the cursor after the text has been inserted.
     */
    private async insertText(textEditor: vscode.TextEditor, index: number, text: string, setCursor: boolean = true): Promise<number> {
        text = this.formatText(text, textEditor);
        let pos = textEditor.document.positionAt(index);
        await textEditor.edit(builder => builder.insert(pos, text));
        let endPos = textEditor.document.positionAt(index + text.length);
        textEditor.revealRange(new vscode.Range(pos, endPos), vscode.TextEditorRevealType.Default);
        if (setCursor && text.lastIndexOf(insertCursorText) >= 0) {
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
        return text;
    }

    /**
     * Indents the given string
     * @param str  The string to be indented.
     * @param numOfTabs  The amount of indentations to place at the
     *     beginning of each line of the string.
     * @return   The new string with each line beginning with the desired
     *     amount of indentation.
     */
    private indent(str: string, numOfTabs: number): string {
        // tslint:disable-next-line:prefer-array-literal
        str = str.replace(/^(?=.)/gm, '\t'.repeat(numOfTabs));
        return str;
    }
}

interface ParameterMetaData {
    description: string;
}

interface Parameter extends Data {
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
    defaultValue?: string | number | boolean | unknown | {} | [];
    metadata?: ParameterMetaData;
}

interface Output extends Data {
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
    value: string;
}

interface Function extends Data {
    parameters: Parameter[];
    output: Output;
}

interface FunctionParameter extends Data {
    name: string;
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
}

interface FunctionNameSpace {
    namespace: string;
    // tslint:disable-next-line:no-any
    members: any[];
}

type Data = { [key: string]: unknown };
