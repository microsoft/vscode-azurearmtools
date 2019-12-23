/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as vscode from "vscode";
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
    let rootValue = Json.asObjectValue(template.getJSONValueAtDocumentCharacterIndex(1));
    if (rootValue !== null) {
        await sortResources(template, rootValue);
        await sortOutputs(template, rootValue);
    }
    await sortParameters(template);
    await sortVariables(template);
    await sortFunctions(template);
    vscode.window.showInformationMessage("Done sorting template!");
}

async function sortOutputs(template: DeploymentTemplate, rootValue: Json.ObjectValue): Promise<void> {
    let outputs = Json.asObjectValue(rootValue.getPropertyValue(templateKeys.outputs));
    if (outputs !== null) {
        await sortGeneric<Json.Property>(outputs.properties, x => x.nameValue.quotedValue, x => x.span);
    }
}

async function sortResources(template: DeploymentTemplate, rootValue: Json.ObjectValue): Promise<void> {
    let resources = Json.asArrayValue(rootValue.getPropertyValue(templateKeys.resources));
    if (resources !== null) {
        await sortGeneric<Json.Value>(resources.elements, getNameFromResource, x => x.span);
        await sortGenericDeep<Json.Value, Json.Value>(resources.elements, getResourcesFromResource,
            getNameFromResource, x => x.span);
    }
}

async function sortVariables(template: DeploymentTemplate): Promise<void> {
    await sortGeneric<IVariableDefinition>(
        template.topLevelScope.variableDefinitions,
        x => x.nameValue.quotedValue, x => x.span);
}

async function sortParameters(template: DeploymentTemplate): Promise<void> {
    await sortGeneric<IParameterDefinition>(
        template.topLevelScope.parameterDefinitions,
        x => x.nameValue.quotedValue, x => x.fullSpan);
}

async function sortFunctions(template: DeploymentTemplate): Promise<void> {
    await sortGeneric<UserFunctionNamespaceDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.nameValue.quotedValue, x => x.span);

    await sortGenericDeep<UserFunctionNamespaceDefinition, UserFunctionDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.members, x => x.nameValue.quotedValue, x => x.span);
}

async function sortGeneric<T>(list: T[], sortSelector: (value: T) => string, spanSelector: (value: T) => language.Span): Promise<void> {
    let textEditor = vscode.window.activeTextEditor;
    if (textEditor === undefined || list.length < 2) {
        return;
    }
    let document = textEditor.document;
    let selection = getSelection(spanSelector(list[0]), spanSelector(list[list.length - 1]), document);
    let orderBefore = list.map(sortSelector);
    let sorted = list.sort((a, b) => sortSelector(a).localeCompare(sortSelector(b)));
    let orderAfter = list.map(sortSelector);
    if (arraysEqual<string>(orderBefore, orderAfter)) {
        return;
    }
    let indentText = getIndentText(spanSelector(list[0]), document);
    let joined = sorted.map(x => getText(spanSelector(x), document)).join(`,${os.EOL}${indentText}`);
    await textEditor.edit(x => x.replace(selection, joined));
}

async function sortGenericDeep<T, TChild>(list: T[], childSelector: (value: T) => TChild[] | null, sortSelector: (value: TChild) => string, spanSelector: (value: TChild) => language.Span): Promise<void> {
    for (let item of list) {
        let children = childSelector(item);
        if (children !== null) {
            await sortGeneric(children, sortSelector, spanSelector);
        }
    }
}

function getNameFromResource(value: Json.Value): string {
    let objectValue = Json.asObjectValue(value);
    if (objectValue === null) {
        return "";
    }
    let nameProperty = objectValue.getPropertyValue("name");
    if (nameProperty === null) {
        return "";
    }
    let name = nameProperty.toFriendlyString();
    return name;
}

function getResourcesFromResource(value: Json.Property): Json.Value[] | null {
    let objectValue = Json.asObjectValue(value);
    if (objectValue === null) {
        return null;
    }
    let resources = Json.asArrayValue(objectValue.getPropertyValue("resources"));
    if (resources === null) {
        return null;
    }
    return resources.elements;
}

function getIndentText(span: language.Span, document: vscode.TextDocument): String {
    let start = span.startIndex;
    let startPosition = document.positionAt(start);
    let startOfLine = new vscode.Position(startPosition.line, 0);
    let indentText = document.getText(new vscode.Range(startOfLine, startPosition)).replace(/\S/g, ' ');
    return indentText;
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
