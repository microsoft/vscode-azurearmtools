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
    Functions
}

export class SortQuickPickItem implements vscode.QuickPickItem {
    public label: string;
    public value: SortType;

    constructor(label: string, value: SortType) {
        this.label = label;
        this.value = value;
    }

}

export function getQuickPickItems(): SortQuickPickItem[] {
    let items: SortQuickPickItem[] = [];
    items.push(new SortQuickPickItem("Functions", SortType.Functions));
    items.push(new SortQuickPickItem("Outputs", SortType.Outputs));
    items.push(new SortQuickPickItem("Parameters", SortType.Parameters));
    items.push(new SortQuickPickItem("Resources", SortType.Resources));
    items.push(new SortQuickPickItem("Variables", SortType.Variables));
    return items;
}

export async function sortTemplate(template: DeploymentTemplate | undefined, sortType: SortType): Promise<void> {
    if (template === undefined) {
        return;
    }
    ext.outputChannel.appendLine("Sorting template");
    let comments = createCommentsMap(template.jsonParseResult.tokens);
    switch (sortType) {
        case SortType.Functions:
            await sortFunctions(template, comments);
            break;
        case SortType.Outputs:
            await sortOutputs(template, comments);
            break;
        case SortType.Parameters:
            await sortParameters(template, comments);
            break;
        case SortType.Resources:
            await sortResources(template, comments);
            break;
        case SortType.Variables:
            await sortVariables(template, comments);
            break;
        default:
            vscode.window.showWarningMessage("Unknown sort type!");

    }
    vscode.window.showInformationMessage("Done sorting template!");
}

async function sortOutputs(template: DeploymentTemplate, comments: { [pos: number]: language.Span }): Promise<void> {
    let rootValue = Json.asObjectValue(template.getJSONValueAtDocumentCharacterIndex(1));
    if (rootValue === undefined) {
        return;
    }
    let outputs = Json.asObjectValue(rootValue.getPropertyValue(templateKeys.outputs));
    if (outputs !== undefined) {
        await sortGeneric<Json.Property>(outputs.properties, x => x.nameValue.quotedValue, x => expandSpan(x.span, comments));
    }
}

async function sortResources(template: DeploymentTemplate, comments: { [pos: number]: language.Span }): Promise<void> {
    let rootValue = Json.asObjectValue(template.getJSONValueAtDocumentCharacterIndex(1));
    if (rootValue === undefined) {
        return;
    }
    let resources = Json.asArrayValue(rootValue.getPropertyValue(templateKeys.resources));
    if (resources !== undefined) {
        await sortGenericDeep<Json.Value, Json.Value>(
            resources.elements, getResourcesFromResource, getNameFromResource, x => expandSpan(x.span, comments));
        await sortGeneric<Json.Value>(resources.elements, getNameFromResource, x => expandSpan(x.span, comments));
    }
}

async function sortVariables(template: DeploymentTemplate, comments: { [pos: number]: language.Span }): Promise<void> {
    await sortGeneric<IVariableDefinition>(
        template.topLevelScope.variableDefinitions,
        x => x.nameValue.quotedValue, x => expandSpan(x.span, comments));
}

function createCommentsMap(tokens: Json.Token[]): { [pos: number]: language.Span } {
    let commentsMap: { [pos: number]: language.Span } = {};
    tokens.forEach((value, index) => {
        if (value.type === 12) {
            if (index < tokens.length - 1) {
                let span = tokens[index + 1].span;
                commentsMap[span.startIndex] = value.span;
            }
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

async function sortParameters(template: DeploymentTemplate, comments: { [pos: number]: language.Span }): Promise<void> {
    await sortGeneric<IParameterDefinition>(
        template.topLevelScope.parameterDefinitions,
        x => x.nameValue.quotedValue, x => expandSpan(x.fullSpan, comments));
}

async function sortFunctions(template: DeploymentTemplate, comments: { [pos: number]: language.Span }): Promise<void> {
    await sortGenericDeep<UserFunctionNamespaceDefinition, UserFunctionDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.members, x => x.nameValue.quotedValue, x => expandSpan(x.span, comments));
    await sortGeneric<UserFunctionNamespaceDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.nameValue.quotedValue, x => expandSpan(x.span, comments));
}

async function sortGeneric<T>(list: T[], sortSelector: (value: T) => string, spanSelector: (value: T) => language.Span): Promise<void> {
    let textEditor = vscode.window.activeTextEditor;
    if (textEditor === undefined || list.length < 2) {
        return;
    }
    let document = textEditor.document;
    let selection = getSelection(spanSelector(list[0]), spanSelector(list[list.length - 1]), document);
    let intendentTexts = getIndentTexts<T>(list, spanSelector, document);
    let orderBefore = list.map(sortSelector);
    let sorted = list.sort((a, b) => sortSelector(a).localeCompare(sortSelector(b)));
    let orderAfter = list.map(sortSelector);
    if (arraysEqual<string>(orderBefore, orderAfter)) {
        return;
    }
    let sortedTexts = sorted.map((value, i) => getText(spanSelector(value), document));
    let joined = joinTexts(sortedTexts, intendentTexts);
    await textEditor.edit(x => x.replace(selection, joined));
}

async function sortGenericDeep<T, TChild>(list: T[], childSelector: (value: T) => TChild[] | undefined, sortSelector: (value: TChild) => string, spanSelector: (value: TChild) => language.Span): Promise<void> {
    for (let item of list) {
        let children = childSelector(item);
        if (children !== undefined) {
            await sortGeneric(children, sortSelector, spanSelector);
        }
    }
}

function getNameFromResource(value: Json.Value): string {
    let objectValue = Json.asObjectValue(value);
    if (objectValue === undefined) {
        return "";
    }
    let nameProperty = objectValue.getPropertyValue("name");
    if (nameProperty === undefined) {
        return "";
    }
    let name = nameProperty.toFriendlyString();
    return name;
}

function getResourcesFromResource(value: Json.Value): Json.Value[] | undefined {
    let objectValue = Json.asObjectValue(value);
    if (objectValue === undefined) {
        return undefined;
    }
    let resources = Json.asArrayValue(objectValue.getPropertyValue("resources"));
    if (resources === undefined) {
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
