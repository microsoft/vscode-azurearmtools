/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Language } from "../extension.bundle";
import { templateKeys } from './constants';
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ext } from './extensionVariables';
import { IParameterDefinition } from './IParameterDefinition';
import * as Json from "./JSON";
import * as language from "./Language";
import { UserFunctionDefinition } from './UserFunctionDefinition';
import { UserFunctionNamespaceDefinition } from './UserFunctionNamespaceDefinition';
import { IVariableDefinition } from './VariableDefinition';

export enum SortType {
    Resources,
    Outputs,
    Parameters,
    Variables,
    Functions,
    TopLevel
}

export class SortQuickPickItem implements vscode.QuickPickItem {
    public label: string;
    public value: SortType;
    public description: string;

    constructor(label: string, value: SortType, description: string) {
        this.label = label;
        this.value = value;
        this.description = description;
    }
}

export function getQuickPickItems(): SortQuickPickItem[] {
    let items: SortQuickPickItem[] = [];
    items.push(new SortQuickPickItem("Functions", SortType.Functions, "Sort function namespaces and functions"));
    items.push(new SortQuickPickItem("Outputs", SortType.Outputs, "Sort outputs"));
    items.push(new SortQuickPickItem("Parameters", SortType.Parameters, "Sort parameters for the template"));
    items.push(new SortQuickPickItem("Resources", SortType.Resources, "Sort resources based on the name including first level of child resources"));
    items.push(new SortQuickPickItem("Variables", SortType.Variables, "Sort variables"));
    items.push(new SortQuickPickItem("Top level", SortType.TopLevel, "Sort top level items based on recommended order (parameters, functions, variables, resources, outputs)"));
    return items;
}

export async function sortTemplate(template: DeploymentTemplate | undefined, sortType: SortType): Promise<void> {
    if (!template) {
        return;
    }
    ext.outputChannel.appendLine("Sorting template");
    switch (sortType) {
        case SortType.Functions:
            await sortFunctions(template);
            break;
        case SortType.Outputs:
            await sortOutputs(template);
            break;
        case SortType.Parameters:
            await sortParameters(template);
            break;
        case SortType.Resources:
            await sortResources(template);
            break;
        case SortType.Variables:
            await sortVariables(template);
            break;
        case SortType.TopLevel:
            await sortTopLevel(template);
            break;
        default:
            vscode.window.showWarningMessage("Unknown sort type!");
            return;

    }
    vscode.window.showInformationMessage("Done sorting template!");
}

async function sortOutputs(template: DeploymentTemplate): Promise<void> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return;
    }
    let outputs = Json.asObjectValue(rootValue.getPropertyValue(templateKeys.outputs));
    if (outputs) {
        await sortGeneric<Json.Property>(outputs.properties, x => x.nameValue.quotedValue, x => x.span, template);
    }
}

async function sortResources(template: DeploymentTemplate): Promise<void> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return;
    }
    let resources = Json.asArrayValue(rootValue.getPropertyValue(templateKeys.resources));
    if (resources) {
        await sortGenericDeep<Json.Value, Json.Value>(
            resources.elements, getResourcesFromResource, getNameFromResource, x => x.span, template);
        await sortGeneric<Json.Value>(resources.elements, getNameFromResource, x => x.span, template);
    }
}

async function sortTopLevel(template: DeploymentTemplate): Promise<void> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return;
    }
    await sortGeneric<Json.Property>(rootValue.properties, x => getTopLevelOrder(x.nameValue.quotedValue), x => x.span, template);
}

async function sortVariables(template: DeploymentTemplate): Promise<void> {
    await sortGeneric<IVariableDefinition>(
        template.topLevelScope.variableDefinitions,
        x => x.nameValue.quotedValue, x => x.span, template);
}

async function sortParameters(template: DeploymentTemplate): Promise<void> {
    await sortGeneric<IParameterDefinition>(
        template.topLevelScope.parameterDefinitions,
        x => x.nameValue.quotedValue, x => x.fullSpan, template);
}

async function sortFunctions(template: DeploymentTemplate): Promise<void> {
    await sortGenericDeep<UserFunctionNamespaceDefinition, UserFunctionDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.members, x => x.nameValue.quotedValue, x => x.span, template);
    await sortGeneric<UserFunctionNamespaceDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.nameValue.quotedValue, x => x.span, template);
}

function createCommentsMap(tokens: Json.Token[], lastSpan: language.Span): { [pos: number]: language.Span } {
    let commentsMap: { [pos: number]: language.Span } = {};
    let commentsSpan: language.Span | undefined;
    tokens.forEach((token, index) => {
        if (token.type === Json.TokenType.Comment) {
            commentsSpan = !commentsSpan ? token.span : token.span.union(commentsSpan);
        } else {
            if (commentsSpan) {
                commentsMap[token.span.startIndex] = commentsSpan;
                commentsSpan = undefined;
            }
        }
        if (token.span.startIndex > lastSpan.endIndex) {
            return commentsMap;
        }
    });
    return commentsMap;
}

function expandSpan(span: language.Span, comments: { [pos: number]: language.Span }): Language.Span {
    let startIndex = span.startIndex;
    let commentSpan = comments[startIndex];
    if (commentSpan === undefined) {
        return span;
    }
    return commentSpan.union(span);
}

function getTopLevelOrder(key: string): string {
    if (!key) {
        return "9";
    }
    switch (key.toLocaleLowerCase().replace(/\"/gi, "")) {
        case "$schema":
            return "0";
        case "contentversion":
            return "1";
        case "apiprofile":
            return "2";
        case "parameters":
            return "3";
        case "functions":
            return "4";
        case "variables":
            return "5";
        case "resources":
            return "6";
        case "outputs":
            return "7";
        default:
            return "9";
    }
}

async function sortGeneric<T>(list: T[], sortSelector: (value: T) => string, spanSelector: (value: T) => language.Span, template: DeploymentTemplate): Promise<void> {
    let textEditor = vscode.window.activeTextEditor;
    if (!textEditor || list.length < 2) {
        return;
    }
    let document = textEditor.document;
    let lastSpan = spanSelector(list[list.length - 1]);
    let comments = createCommentsMap(template.jsonParseResult.tokens, lastSpan);
    let selection = getSelection(expandSpan(spanSelector(list[0]), comments), expandSpan(lastSpan, comments), document);
    let intendentTexts = getIndentTexts<T>(list, x => expandSpan(spanSelector(x), comments), document);
    let orderBefore = list.map(sortSelector);
    let sorted = list.sort((a, b) => sortSelector(a).localeCompare(sortSelector(b)));
    let orderAfter = list.map(sortSelector);
    if (arraysEqual<string>(orderBefore, orderAfter)) {
        return;
    }
    let sortedTexts = sorted.map(value => getText(expandSpan(spanSelector(value), comments), document));
    let joined = joinTexts(sortedTexts, intendentTexts);
    await textEditor.edit(x => x.replace(selection, joined));
}

async function sortGenericDeep<T, TChild>(list: T[], childSelector: (value: T) => TChild[] | undefined, sortSelector: (value: TChild) => string, spanSelector: (value: TChild) => language.Span, template: DeploymentTemplate): Promise<void> {
    for (let item of list) {
        let children = childSelector(item);
        if (children) {
            await sortGeneric(children, sortSelector, spanSelector, template);
        }
    }
}

function getNameFromResource(value: Json.Value): string {
    let objectValue = Json.asObjectValue(value);
    if (!objectValue) {
        return "";
    }
    let nameProperty = objectValue.getPropertyValue("name");
    if (!nameProperty) {
        return "";
    }
    let name = nameProperty.toFriendlyString();
    return name;
}

function getResourcesFromResource(value: Json.Value): Json.Value[] | undefined {
    let objectValue = Json.asObjectValue(value);
    if (!objectValue) {
        return undefined;
    }
    let resources = Json.asArrayValue(objectValue.getPropertyValue("resources"));
    if (!resources) {
        return undefined;
    }
    return resources.elements;
}

function joinTexts(texts: String[], intendentTexts: String[]): string {
    let output: string = "";
    for (let index = 0; index < texts.length - 1; index++) {
        output = `${output}${texts[index]}${intendentTexts[index]}`;
    }
    output = `${output}${texts[texts.length - 1]}`;
    return output;
}

function getIndentTexts<T>(list: T[], spanSelector: (value: T) => language.Span, document: vscode.TextDocument): String[] {
    let indentTexts: String[] = [];
    for (let index = 0; index < list.length - 1; index++) {
        let span1 = spanSelector(list[index]);
        let span2 = spanSelector(list[index + 1]);
        let intendentText = document.getText(new vscode.Range(document.positionAt(span1.afterEndIndex), document.positionAt(span2.startIndex)));
        indentTexts.push(intendentText);
    }
    return indentTexts;
}

function getRange(span: language.Span, document: vscode.TextDocument): vscode.Range {
    return new vscode.Range(document.positionAt(span.startIndex), document.positionAt(span.afterEndIndex));
}

function getText(span: language.Span, document: vscode.TextDocument): String {
    let range = getRange(span, document);
    let text = document.getText(range);
    return text;
}

function getSelection(start: language.Span, end: language.Span, document: vscode.TextDocument): vscode.Selection {
    let startIndex = start.startIndex;
    let endIndex = end.afterEndIndex;
    let selection = new vscode.Selection(document.positionAt(startIndex), document.positionAt(endIndex));
    return selection;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a === b) {
        return true;
    }
    if (a == null || b == null) {
        return false;
    }
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
