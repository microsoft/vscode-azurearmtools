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
import { ObjectValue } from "../../language/json/JSON";
import { ISnippet } from "../../snippets/ISnippet";
import { KnownContexts } from "../../snippets/KnownContexts";
import { assertNever } from '../../util/assertNever';
import { DeploymentTemplateDoc } from "./DeploymentTemplateDoc";
import { TemplateSectionType } from "./TemplateSectionType";

const insertCursorText = '[]';

const invalidTemplateMessage = `The ARM template file appears to be invalid.  If you need to, you can add contents for a new template by typing "arm!" and selecting the desired snippet.`;

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
    const items: QuickPickItem<ItemType>[] = [];
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
    const items: IAzureQuickPickItem<ISnippet>[] = [];
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
    const items: QuickPickItem<TemplateSectionType>[] = [];
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
                await this.insertFunction(template.topLevelValue, textEditor, context);
                void vscode.window.showInformationMessage("Please type the output of the function.");
                break;
            case TemplateSectionType.Outputs:
                await this.insertOutput(template.topLevelValue, textEditor, context);
                void vscode.window.showInformationMessage("Please type the value of the output.");
                break;
            case TemplateSectionType.Parameters:
                await this.insertParameter(template.topLevelValue, textEditor, context);
                void vscode.window.showInformationMessage("Done inserting parameter.");
                break;
            case TemplateSectionType.Resources:
                await this.insertResource(template.topLevelValue, textEditor, context);
                void vscode.window.showInformationMessage("Press TAB to move between the tab stops.");
                break;
            case TemplateSectionType.Variables:
                await this.insertVariable(template.topLevelValue, textEditor, context);
                void vscode.window.showInformationMessage("Please type the value of the variable.");
                break;
            case TemplateSectionType.TopLevel:
                assert.fail("Unknown insert item type!");
            default:
                assertNever(sectionType);
        }
    }

    private getTemplateObjectPart(templateTopLevel: ObjectValue | undefined, templatePart: string): Json.ObjectValue | undefined {
        return this.getTemplatePart(templateTopLevel, templatePart)?.asObjectValue;
    }

    private getTemplateArrayPart(templateTopLevel: ObjectValue | undefined, templatePart: string): Json.ArrayValue | undefined {
        return this.getTemplatePart(templateTopLevel, templatePart)?.asArrayValue;
    }

    private getTemplatePart(templateTopLevel: ObjectValue | undefined, templatePart: string): Json.Value | undefined {
        return templateTopLevel?.getPropertyValue(templatePart);
    }

    public async insertParameterWithDefaultValue(templateTopLevel: ObjectValue | undefined, textEditor: vscode.TextEditor, context: IActionContext, name: string, value: string, description: string, options?: { undoStopBefore: boolean; undoStopAfter: boolean }): Promise<string> {
        const parameter: Parameter = {
            type: "string",
            defaultValue: value
        };
        if (description) {
            parameter.metadata = {
                description: description
            };
        }
        await this.insertInObject({
            templateTopLevel,
            textEditor,
            part: templateKeys.parameters,
            data: parameter,
            name,
            context,
            setCursor: false,
            reveal: false,
            options: options
        });
        return name;
    }

    private async insertParameter(templateTopLevel: ObjectValue | undefined, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        const name = await this.ui.showInputBox({ prompt: "Name of parameter?" });
        const parameterType = await this.ui.showQuickPick(getItemType(), { placeHolder: 'Type of parameter?' });
        const parameter: Parameter = {
            type: parameterType.value
        };
        const defaultValue = await this.ui.showInputBox({ prompt: "Default value? Leave empty for no default value.", });
        if (defaultValue) {
            parameter.defaultValue = this.getDefaultValue(defaultValue, parameterType.value, context);
        }
        const description = await this.ui.showInputBox({ prompt: "Description? Leave empty for no description.", });
        if (description) {
            parameter.metadata = {
                description: description
            };
        }
        await this.insertInObject({
            templateTopLevel,
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
                const intValue = Number(defaultValue);
                if (isNaN(intValue)) {
                    this.throwExpectedError("Please enter a valid integer value", context);
                }
                return intValue;
            case "array":
                try {
                    return JSON.parse(defaultValue);
                } catch (error) {
                    this.throwExpectedError("Please enter a valid array value", context);
                }
                break;
            case "object":
            case "secureobject":
                try {
                    return JSON.parse(defaultValue);
                } catch (error) {
                    this.throwExpectedError("Please enter a valid object value", context);
                }
                break;
            case "bool":
                switch (defaultValue) {
                    case "true":
                        return true;
                    case "false":
                        return false;
                    default:
                        this.throwExpectedError("Please enter 'true' or 'false'", context);
                }
                break;
            case "string":
            case "securestring":
                return defaultValue;
            default:
                assertNever(parameterType);
        }
    }

    public async insertInObject(
        { templateTopLevel,
            textEditor,
            part,
            data,
            name,
            context,
            setCursor = true,
            reveal = true,
            options = { undoStopBefore: true, undoStopAfter: true }
        }: {
            templateTopLevel: ObjectValue | undefined;
            textEditor: vscode.TextEditor;
            part: string;
            data: Data | unknown;
            name: string;
            context: IActionContext;
            setCursor?: boolean;
            reveal?: boolean;
            options?: { undoStopBefore: boolean; undoStopAfter: boolean };
        }): Promise<void> {
        const templatePart = this.getTemplateObjectPart(templateTopLevel, part);
        if (!templatePart) {
            if (!templateTopLevel) {
                context.errorHandling.suppressReportIssue = true;
                throw new Error(invalidTemplateMessage);
            }
            const subPart: Data = {};
            subPart[name] = data;
            await this.insertInObjectHelper({
                templatePart: templateTopLevel,
                textEditor,
                data: subPart,
                name: part,
                setCursor,
                reveal,
                options
            });
        } else {
            await this.insertInObjectHelper({
                templatePart,
                textEditor,
                data,
                name,
                setCursor,
                reveal,
                options
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
            setCursor = true,
            reveal = true,
            options = { undoStopBefore: true, undoStopAfter: true }
        }: {
            templatePart: Json.ObjectValue; // The parent to place the new text into
            textEditor: vscode.TextEditor;
            // tslint:disable-next-line:no-any
            data: any;
            name: string;
            setCursor?: boolean;
            reveal?: boolean;
            options?: { undoStopBefore: boolean; undoStopAfter: boolean };
        }): Promise<number> {
        const isFirstItem = templatePart.properties.length === 0;
        const startText = isFirstItem ? '' : ',';

        // Figure out the indenting level based on existing text
        const templatePartStartPos = textEditor.document.positionAt(templatePart.span.startIndex);
        const templatePartStartLine = textEditor.document.lineAt(templatePartStartPos.line);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Will always match at least empty string
        const templatePartInitialWhitespace: string = templatePartStartLine.text.match(/^\s*/)![0];
        let spacesPerTab = Math.max(1, Number(textEditor.options.tabSize) ?? 1);
        const templatePartIndentColumn = templatePartInitialWhitespace.replace(/\t/g, ' '.repeat(spacesPerTab)).length;
        spacesPerTab = Number.isSafeInteger(spacesPerTab) ? spacesPerTab : 1;
        const templatePartIndentLevel = Math.max(0, Math.floor(templatePartIndentColumn / spacesPerTab));
        const textIndentLevel = templatePartIndentLevel + 1;

        const insertIndex = isFirstItem ?
            templatePart.span.endIndex :
            templatePart.properties[templatePart.properties.length - 1].span.afterEndIndex;

        const endTabs = '\t'.repeat(textIndentLevel - 1);
        const endText = isFirstItem ? `\r\n${endTabs}` : ``;

        const text = typeof (data) === 'object' ? JSON.stringify(data, null, '\t') : `"${data}"`;
        const indentedText = this.indent(`\r\n"${name}": ${text}`, textIndentLevel);
        return await this.insertText(textEditor, insertIndex, `${startText}${indentedText}${endText}`, setCursor, reveal, options);
    }

    private async insertVariable(templateTopLevel: ObjectValue | undefined, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        const name = await this.ui.showInputBox({ prompt: "Name of variable?" });
        await this.insertInObject({
            templateTopLevel,
            textEditor,
            part: templateKeys.variables,
            data: insertCursorText,
            name,
            context
        });
    }

    public async insertVariableWithValue(templateTopLevel: ObjectValue | undefined, textEditor: vscode.TextEditor, context: IActionContext, name: string, value: string, options?: { undoStopBefore: boolean; undoStopAfter: boolean }): Promise<void> {
        await this.insertInObject({
            templateTopLevel,
            textEditor,
            part: templateKeys.variables,
            data: value,
            name,
            context,
            setCursor: false,
            reveal: false,
            options: options
        });
    }

    private async insertOutput(templateTopLevel: ObjectValue | undefined, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        const name = await this.ui.showInputBox({ prompt: "Name of output?" });
        const outputType = await this.ui.showQuickPick(getItemType(), { placeHolder: 'Type of output?' });
        const output: Output = {
            type: outputType.value,
            value: insertCursorText.replace(/"/g, '')
        };
        await this.insertInObject({
            templateTopLevel,
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
            throw new Error(invalidTemplateMessage);
        }
        const functions = [await this.getFunctionNamespace()];
        await this.insertInObjectHelper({
            templatePart: topLevel,
            textEditor,
            data: functions,
            name: templateKeys.functions,
        });
    }

    private async insertFunctionAsNamespace(functions: Json.ArrayValue, textEditor: vscode.TextEditor): Promise<void> {
        const namespace = await this.getFunctionNamespace();
        await this.insertInArray(functions, textEditor, namespace);
    }

    private async insertFunctionAsMembers(namespace: Json.ObjectValue, textEditor: vscode.TextEditor): Promise<void> {
        const functionName = await this.ui.showInputBox({ prompt: "Name of function?" });
        const functionDef = await this.getFunction();
        // tslint:disable-next-line:no-any
        const members: any = {};
        // tslint:disable-next-line:no-unsafe-any
        members[functionName] = functionDef;
        await this.insertInObjectHelper({
            templatePart: namespace,
            textEditor,
            data: members,
            name: templateKeys.userFunctionMembers,
        });
    }

    private async insertFunctionAsFunction(members: Json.ObjectValue, textEditor: vscode.TextEditor): Promise<void> {
        const functionName = await this.ui.showInputBox({ prompt: "Name of function?" });
        const functionDef = await this.getFunction();
        await this.insertInObjectHelper({
            templatePart: members,
            textEditor,
            data: functionDef,
            name: functionName,
        });
    }

    private async insertFunction(templateTopLevel: ObjectValue | undefined, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        const functions = this.getTemplateArrayPart(templateTopLevel, templateKeys.functions);
        if (!functions) {
            // tslint:disable-next-line:no-unsafe-any
            await this.insertFunctionAsTopLevel(templateTopLevel, textEditor, context);
            return;
        }
        if (functions.length === 0) {
            await this.insertFunctionAsNamespace(functions, textEditor);
            return;
        }
        const namespace = Json.asObjectValue(functions.elements[0]);
        if (!namespace) {
            context.errorHandling.suppressReportIssue = true;
            throw new Error(`The first namespace in "functions" is not an object`);
        }
        const members = namespace.getPropertyValue(templateKeys.userFunctionMembers);
        if (!members) {
            await this.insertFunctionAsMembers(namespace, textEditor);
            return;
        }
        const membersObject = Json.asObjectValue(members);
        if (!membersObject) {
            context.errorHandling.suppressReportIssue = true;
            throw new Error(`The first namespace in "functions" does not have members as an object!`);
        }
        await this.insertFunctionAsFunction(membersObject, textEditor);
        return;
    }

    private async insertResource(templateTopLevel: ObjectValue | undefined, textEditor: vscode.TextEditor, context: IActionContext): Promise<void> {
        const resources = this.getTemplateArrayPart(templateTopLevel, templateKeys.resources);
        let index: number;
        let prepend = "\r\n\t\t\r\n\t";
        if (!resources) {
            if (!templateTopLevel) {
                context.errorHandling.suppressReportIssue = true;
                throw new Error(invalidTemplateMessage);
            }
            // tslint:disable-next-line:no-any
            const subPart: any = [];
            index = await this.insertInObjectHelper({
                templatePart: templateTopLevel,
                textEditor,
                data: subPart,
                name: templateKeys.resources,
            });
        } else {
            index = resources.span.endIndex;
            if (resources.elements.length > 0) {
                const lastIndex = resources.elements.length - 1;
                index = resources.elements[lastIndex].span.afterEndIndex;
                prepend = `,\r\n\t\t`;
            }
        }
        const resource = await this.ui.showQuickPick(await getResourceSnippets(), { placeHolder: 'What resource do you want to insert?' });
        await this.insertText(textEditor, index, prepend);
        const newCursorPosition = this.getCursorPositionForInsertResource(textEditor, index, prepend);
        textEditor.selection = new vscode.Selection(newCursorPosition, newCursorPosition);
        await commands.executeCommand('editor.action.insertSnippet', { snippet: resource.data.insertText });
        textEditor.revealRange(new vscode.Range(newCursorPosition, newCursorPosition), vscode.TextEditorRevealType.AtTop);
    }

    private getCursorPositionForInsertResource(textEditor: vscode.TextEditor, index: number, prepend: string): vscode.Position {
        const prependRange = new vscode.Range(textEditor.document.positionAt(index), textEditor.document.positionAt(index + this.formatText(prepend, textEditor).length));
        const prependFromDocument = textEditor.document.getText(prependRange);
        const lookFor = this.formatText('\t\t', textEditor);
        const cursorPos = prependFromDocument.indexOf(lookFor);
        return textEditor.document.positionAt(index + cursorPos + lookFor.length);
    }

    private async getFunction(): Promise<Function> {
        const outputType = await this.ui.showQuickPick(getItemType(), { placeHolder: 'Type of function output?' });
        const parameters = await this.getFunctionParameters();
        const functionDef = {
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
        const parameters = [];
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
        const index = templatePart.span.endIndex;
        const text = JSON.stringify(data, null, '\t');
        const indentedText = this.indent(`\r\n${text}\r\n`, 2);
        await this.insertText(textEditor, index, `${indentedText}\t`);
    }

    private async getFunctionNamespace(): Promise<FunctionNameSpace> {
        const namespaceName = await this.ui.showInputBox({ prompt: "Name of namespace?" });
        const namespace = {
            namespace: namespaceName,
            members: await this.getFunctionMembers()
        };
        return namespace;
    }

    // tslint:disable-next-line:no-any
    private async getFunctionMembers(): Promise<any> {
        const functionName = await this.ui.showInputBox({ prompt: "Name of function?" });
        const functionDef = await this.getFunction();
        // tslint:disable-next-line:no-any
        const members: any = {};
        // tslint:disable-next-line:no-unsafe-any
        members[functionName] = functionDef;
        return members;
    }

    /**
     * Insert text into the document.
     * @param textEditor The text editor to insert the text into.
     * @param index The document index where to insert the text.
     * @param text The text to be inserted.
     * @param setCursor If the cursor should be set
     * @param options If undostops should be created before and after the edit
     * @returns The document index of the cursor after the text has been inserted.
     */
    private async insertText(textEditor: vscode.TextEditor, index: number, text: string, setCursor: boolean = true, reveal: boolean = true, options?: { undoStopBefore: boolean; undoStopAfter: boolean }): Promise<number> {
        text = this.formatText(text, textEditor);
        const pos = textEditor.document.positionAt(index);
        await textEditor.edit(builder => builder.insert(pos, text), options);
        if (reveal) {
            const endPos = textEditor.document.positionAt(index + text.length);
            textEditor.revealRange(new vscode.Range(pos, endPos), vscode.TextEditorRevealType.Default);
        }
        if (setCursor && text.lastIndexOf(insertCursorText) >= 0) {
            const insertedText = textEditor.document.getText(new vscode.Range(pos, textEditor.document.positionAt(index + text.length)));
            const cursorPos = insertedText.lastIndexOf(insertCursorText);
            const newIndex = index + cursorPos + insertCursorText.length / 2;
            const pos2 = textEditor.document.positionAt(newIndex);
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
