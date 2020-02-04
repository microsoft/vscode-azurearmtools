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

export async function sortTemplate(template: DeploymentTemplate | undefined): Promise<void> {
    if (template === undefined) {
        return;
    }
    ext.outputChannel.appendLine("Sorting template");
    let comments = createCommentsMap(template.jsonParseResult.tokens);
    let rootValue = Json.asObjectValue(template.getJSONValueAtDocumentCharacterIndex(1));
    if (rootValue !== undefined) {
        await sortResources(template, rootValue, comments);
        await sortOutputs(template, rootValue, comments);
    }
    await sortParameters(template, comments);
    await sortVariables(template, comments);
    await sortFunctions(template, comments);
    vscode.window.showInformationMessage("Done sorting template!");
}

async function sortOutputs(template: DeploymentTemplate, rootValue: Json.ObjectValue, comments: { [pos: number]: language.Span }): Promise<void> {
    let outputs = Json.asObjectValue(rootValue.getPropertyValue(templateKeys.outputs));
    if (outputs !== undefined) {
        await sortGeneric<Json.Property>(outputs.properties, x => x.nameValue.quotedValue, x => expandSpan(x.span, comments));
    }
}

async function sortResources(template: DeploymentTemplate, rootValue: Json.ObjectValue, comments: { [pos: number]: language.Span }): Promise<void> {
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
