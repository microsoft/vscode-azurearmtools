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

export enum TemplateSectionType {
    Resources,
    Outputs,
    Parameters,
    Variables,
    Functions,
    TopLevel
}

// A map of [token starting index] to [span of all comments before that token]
type CommentsMap = Map<number, language.Span>;

export class SortQuickPickItem implements vscode.QuickPickItem {
    public label: string;
    public value: TemplateSectionType;
    public description: string;

    constructor(label: string, value: TemplateSectionType, description: string) {
        this.label = label;
        this.value = value;
        this.description = description;
    }
}

export function getQuickPickItems(): SortQuickPickItem[] {
    let items: SortQuickPickItem[] = [];
    items.push(new SortQuickPickItem("Functions", TemplateSectionType.Functions, "Sort function namespaces and functions"));
    items.push(new SortQuickPickItem("Outputs", TemplateSectionType.Outputs, "Sort outputs"));
    items.push(new SortQuickPickItem("Parameters", TemplateSectionType.Parameters, "Sort parameters for the template"));
    items.push(new SortQuickPickItem("Resources", TemplateSectionType.Resources, "Sort resources based on the name including first level of child resources"));
    items.push(new SortQuickPickItem("Variables", TemplateSectionType.Variables, "Sort variables"));
    items.push(new SortQuickPickItem("Top level", TemplateSectionType.TopLevel, "Sort top level items based on recommended order (parameters, functions, variables, resources, outputs)"));
    return items;
}

export async function sortTemplate(template: DeploymentTemplate | undefined, sectionType: TemplateSectionType, textEditor: vscode.TextEditor): Promise<void> {
    if (!template) {
        return;
    }
    ext.outputChannel.appendLine("Sorting template");
    switch (sectionType) {
        case TemplateSectionType.Functions:
            await sortFunctions(template, textEditor);
            break;
        case TemplateSectionType.Outputs:
            await sortOutputs(template, textEditor);
            break;
        case TemplateSectionType.Parameters:
            await sortParameters(template, textEditor);
            break;
        case TemplateSectionType.Resources:
            await sortResources(template, textEditor);
            break;
        case TemplateSectionType.Variables:
            await sortVariables(template, textEditor);
            break;
        case TemplateSectionType.TopLevel:
            await sortTopLevel(template, textEditor);
            break;
        default:
            vscode.window.showWarningMessage("Unknown sort type!");
            return;

    }
    vscode.window.showInformationMessage("Done sorting template!");
}

async function sortOutputs(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return;
    }
    let outputs = Json.asObjectValue(rootValue.getPropertyValue(templateKeys.outputs));
    if (outputs) {
        await sortGeneric<Json.Property>(outputs.properties, x => x.nameValue.quotedValue, x => x.span, template, textEditor);
    }
}

async function sortResources(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return;
    }
    let resources = Json.asArrayValue(rootValue.getPropertyValue(templateKeys.resources));
    if (resources) {
        await sortGenericDeep<Json.Value, Json.Value>(
            resources.elements, getResourcesFromResource, getNameFromResource, x => x.span, template, textEditor);
        await sortGeneric<Json.Value>(resources.elements, getNameFromResource, x => x.span, template, textEditor);
    }
}

async function sortTopLevel(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return;
    }
    await sortGeneric<Json.Property>(rootValue.properties, x => getTopLevelOrder(x.nameValue.quotedValue), x => x.span, template, textEditor);
}

async function sortVariables(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    await sortGeneric<IVariableDefinition>(
        template.topLevelScope.variableDefinitions,
        x => x.nameValue.quotedValue, x => x.span, template, textEditor);
}

async function sortParameters(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    await sortGeneric<IParameterDefinition>(
        template.topLevelScope.parameterDefinitions,
        x => x.nameValue.quotedValue, x => x.fullSpan, template, textEditor);
}

async function sortFunctions(template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    await sortGenericDeep<UserFunctionNamespaceDefinition, UserFunctionDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.members, x => x.nameValue.quotedValue, x => x.span, template, textEditor);
    await sortGeneric<UserFunctionNamespaceDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.nameValue.quotedValue, x => x.span, template, textEditor);
}

function createCommentsMap(tokens: Json.Token[], commentTokens: Json.Token[], lastSpan: language.Span): CommentsMap {
    let commentsMap: CommentsMap = new Map<number, language.Span>();
    let currentCommentsSpan: language.Span | undefined;
    let allTokens = tokens.concat(commentTokens);
    allTokens.sort((a, b) => a.span.startIndex - b.span.startIndex);
    allTokens.forEach((token, index) => {
        if (token.type === Json.TokenType.Comment) {
            currentCommentsSpan = !currentCommentsSpan ? token.span : token.span.union(currentCommentsSpan);
        } else {
            if (currentCommentsSpan) {
                // This token has comments before it, place comments span into map keyed with the token's starting index
                commentsMap.set(token.span.startIndex, currentCommentsSpan);
                currentCommentsSpan = undefined;
            }
        }
        if (token.span.startIndex > lastSpan.endIndex) {
            return commentsMap;
        }
    });
    return commentsMap;
}

function expandSpanToPrecedingComments(span: language.Span, comments: CommentsMap): Language.Span {
    let startIndex = span.startIndex;
    let commentSpan = comments.get(startIndex);
    // tslint:disable-next-line: strict-boolean-expressions
    if (!commentSpan) {
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

async function sortGeneric<T>(list: T[], sortSelector: (value: T) => string, spanSelector: (value: T) => language.Span, template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    if (list.length < 2) {
        return;
    }
    let document = textEditor.document;
    let lastSpan = spanSelector(list[list.length - 1]);
    let comments = createCommentsMap(template.jsonParseResult.tokens, template.jsonParseResult.commentTokens, lastSpan);
    let selectionWithComments = getSelection(expandSpanToPrecedingComments(spanSelector(list[0]), comments), expandSpanToPrecedingComments(lastSpan, comments), document);
    let indentedTexts = getIndentTexts<T>(list, x => expandSpanToPrecedingComments(spanSelector(x), comments), document);
    let orderBefore = list.map(sortSelector);
    let sorted = list.sort((a, b) => sortSelector(a).localeCompare(sortSelector(b)));
    let orderAfter = list.map(sortSelector);
    if (arraysEqual<string>(orderBefore, orderAfter)) {
        return;
    }
    let sortedTexts = sorted.map(value => getText(expandSpanToPrecedingComments(spanSelector(value), comments), document));
    let joined = joinTexts(sortedTexts, indentedTexts);
    await textEditor.edit(x => x.replace(selectionWithComments, joined));
}

async function sortGenericDeep<T, TChild>(list: T[], childSelector: (value: T) => TChild[] | undefined, sortSelector: (value: TChild) => string, spanSelector: (value: TChild) => language.Span, template: DeploymentTemplate, textEditor: vscode.TextEditor): Promise<void> {
    for (let item of list) {
        let children = childSelector(item);
        if (children) {
            await sortGeneric(children, sortSelector, spanSelector, template, textEditor);
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

// Performs shallow, reference comparison for the array entries
function arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a === b) {
        return true;
    }
    // tslint:disable-next-line: strict-boolean-expressions
    if (!a || !b) {
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
