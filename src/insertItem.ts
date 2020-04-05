/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { commands } from "vscode";
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

export function getResourceSnippets(): vscode.QuickPickItem[] {
    let items: vscode.QuickPickItem[] = [];
    items.push(getQuickPickItem("Nested Deployment"));
    items.push(getQuickPickItem("App Service Plan (Server Farm)"));
    items.push(getQuickPickItem("Application Insights for Web Apps"));
    items.push(getQuickPickItem("Application Security Group"));
    items.push(getQuickPickItem("Automation Account"));
    items.push(getQuickPickItem("Automation Certificate"));
    items.push(getQuickPickItem("Automation Credential"));
    items.push(getQuickPickItem("Automation Job Schedule"));
    items.push(getQuickPickItem("Automation Runbook"));
    items.push(getQuickPickItem("Automation Schedule"));
    items.push(getQuickPickItem("Automation Variable"));
    items.push(getQuickPickItem("Automation Module"));
    items.push(getQuickPickItem("Availability Set"));
    items.push(getQuickPickItem("Azure Firewall"));
    items.push(getQuickPickItem("Container Group"));
    items.push(getQuickPickItem("Container Registry"));
    items.push(getQuickPickItem("Cosmos DB Database Account"));
    items.push(getQuickPickItem("Cosmos DB SQL Database"));
    items.push(getQuickPickItem("Cosmos DB Mongo Database"));
    items.push(getQuickPickItem("Cosmos DB Gremlin Database"));
    items.push(getQuickPickItem("Cosmos DB Cassandra Namespace"));
    items.push(getQuickPickItem("Cosmos DB Cassandra Table"));
    items.push(getQuickPickItem("Cosmos DB SQL Container"));
    items.push(getQuickPickItem("Cosmos DB Gremlin Graph"));
    items.push(getQuickPickItem("Cosmos DB Table Storage Table"));
    items.push(getQuickPickItem("Data Lake Store Account"));
    items.push(getQuickPickItem("DNS Record"));
    items.push(getQuickPickItem("DNS Zone"));
    items.push(getQuickPickItem("Function"));
    items.push(getQuickPickItem("KeyVault"));
    items.push(getQuickPickItem("KeyVault Secret"));
    items.push(getQuickPickItem("Kubernetes Service Cluster"));
    items.push(getQuickPickItem("Linux VM Custom Script"));
    items.push(getQuickPickItem("Load Balancer External"));
    items.push(getQuickPickItem("Load Balancer Internal"));
    items.push(getQuickPickItem("Log Analytics Solution"));
    items.push(getQuickPickItem("Log Analytics Workspace"));
    items.push(getQuickPickItem("Logic App"));
    items.push(getQuickPickItem("Logic App Connector"));
    items.push(getQuickPickItem("Managed Identity (User Assigned)"));
    items.push(getQuickPickItem("Media Services"));
    items.push(getQuickPickItem("MySQL Database"));
    items.push(getQuickPickItem("Network Interface"));
    items.push(getQuickPickItem("Network Security Group"));
    items.push(getQuickPickItem("Network Security Group Rule"));
    items.push(getQuickPickItem("Public IP Address"));
    items.push(getQuickPickItem("Public IP Prefix"));
    items.push(getQuickPickItem("Recovery Service Vault"));
    items.push(getQuickPickItem("Redis Cache"));
    items.push(getQuickPickItem("Route Table"));
    items.push(getQuickPickItem("Route Table Route"));
    items.push(getQuickPickItem("SQL Database"));
    items.push(getQuickPickItem("SQL Database Import"));
    items.push(getQuickPickItem("SQL Server"));
    items.push(getQuickPickItem("Storage Account"));
    items.push(getQuickPickItem("Traffic Manager Profile"));
    items.push(getQuickPickItem("Ubuntu Virtual Machine"));
    items.push(getQuickPickItem("Virtual Network"));
    items.push(getQuickPickItem("VPN Local Network Gateway"));
    items.push(getQuickPickItem("VPN Virtual Network Gateway"));
    items.push(getQuickPickItem("VPN Virtual Network Connection"));
    items.push(getQuickPickItem("Web App"));
    items.push(getQuickPickItem("Web Deploy for Web App"));
    items.push(getQuickPickItem("Windows Virtual Machine"));
    items.push(getQuickPickItem("Windows VM Custom Script"));
    items.push(getQuickPickItem("Windows VM Diagnostics Extension"));
    items.push(getQuickPickItem("Windows VM DSC PowerShell Script"));
    return items;
}
export function getQuickPickItem(label: string): vscode.QuickPickItem {
    return { label: label };
}
export function getInsertItemType(): QuickPickItem<SortType>[] {
    let items: QuickPickItem<SortType>[] = [];
    items.push(new QuickPickItem<SortType>("Function", SortType.Functions, "Insert a function"));
    items.push(new QuickPickItem<SortType>("Output", SortType.Outputs, "Inserts an output"));
    items.push(new QuickPickItem<SortType>("Parameter", SortType.Parameters, "Inserts a parameter"));
    items.push(new QuickPickItem<SortType>("Resource", SortType.Resources, "Insert a resource"));
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
            await insertResource(template, textEditor);
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
    if (!parameters) {
        return;
    }
    let startText = '\t\t';
    let index = parameters.span.endIndex;
    let endText = "\r\n\t";
    if (parameters.properties.length > 0) {
        startText = ",";
        index -= 3;
        endText = '\t';
    }
    let name = await ext.ui.showInputBox({ prompt: "Name of parameter?" });
    const parameterType = await ext.ui.showQuickPick(getItemType(), { placeHolder: 'Type of parameter?' });
    let parameter: any = {
        type: parameterType.value
    };
    let defaultValue = await ext.ui.showInputBox({ prompt: "Default value? Leave empty for no default value", });
    if (defaultValue !== '') {
        parameter.defaultValue = defaultValue;
    }
    let descriptionValue = await ext.ui.showInputBox({ prompt: "Description? Leave empty for no description", });
    if (descriptionValue !== '') {
        parameter.metadata = {
            description: descriptionValue
        };
    }
    let text = JSON.stringify(parameter, null, '\t');
    let indentedText = indent(`\r\n"${name}": ${text}`, 2);
    await insertText(textEditor, index, `${startText}${indentedText}${endText}`);
}

async function insertVariable(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let variables = getTemplateObjectPart(template, templateKeys.variables);
    if (!variables) {
        return;
    }
    let startText = variables.properties.length === 0 ? '\r\n\t\t' : '\t,';
    let name = await ext.ui.showInputBox({ prompt: "Name of variable?" });
    let text = `${startText}"${name}": ""\r\n\t`;
    let index = variables.span.endIndex;
    await insertTextAndSetCursor(textEditor, index, text);
}

async function insertOutput(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let outputs = getTemplateObjectPart(template, templateKeys.outputs);
    if (!outputs) {
        return;
    }
    let startText = outputs.properties.length === 0 ? '\r\n\t\t' : '\t,';
    let name = await ext.ui.showInputBox({ prompt: "Name of output?" });
    const outputType = await ext.ui.showQuickPick(getItemType(), { placeHolder: 'Type of output?' });
    let text = `${startText}"${name}": \{\r\n\t\t\t"type": "${outputType.value}",\r\n\t\t\t"value": ""\r\n\t\t\}\r\n\t`;
    let index = outputs.span.endIndex;
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

async function insertResource(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let resources = getTemplateArrayPart(template, templateKeys.resources);
    if (!resources) {
        return;
    }
    const resource = await ext.ui.showQuickPick(getResourceSnippets(), { placeHolder: 'What resource do you want to insert?' });
    let index = resources.span.endIndex;
    let text = "\r\n\t\t";
    if (resources.elements.length > 0) {
        let lastIndex = resources.elements.length - 1;
        index = resources.elements[lastIndex].span.afterEndIndex;
        text = `,${text}`;
    }
    await insertText(textEditor, index, text);
    let pos = textEditor.document.positionAt(index + text.length);
    let newSelection = new vscode.Selection(pos, pos);
    textEditor.selection = newSelection;
    await commands.executeCommand('editor.action.insertSnippet', { name: resource.label });
    textEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.Default);
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

async function insertText(textEditor: vscode.TextEditor, index: number, text: string): Promise<void> {
    await textEditor.edit(builder => {
        let i: number = index;
        let pos = textEditor.document.positionAt(i);
        builder.insert(pos, text);
        textEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.Default);
    });
}

async function insertTextAndSetCursor(textEditor: vscode.TextEditor, index: number, text: string): Promise<void> {
    await insertText(textEditor, index, text);
    let cursorPos = text.indexOf('""');
    let pos = textEditor.document.positionAt(index + cursorPos - 1);
    let newSelection = new vscode.Selection(pos, pos);
    textEditor.selection = newSelection;
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
