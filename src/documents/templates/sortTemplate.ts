/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { templateKeys } from '../../../common';
import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import { assertNever } from "../../util/assertNever";
import { IParameterDefinition } from "../parameters/IParameterDefinition";
import { DeploymentTemplateDoc } from "./DeploymentTemplateDoc";
import { TemplateSectionType } from "./TemplateSectionType";
import { UserFunctionDefinition } from './UserFunctionDefinition';
import { UserFunctionNamespaceDefinition } from './UserFunctionNamespaceDefinition';
import { IVariableDefinition } from './VariableDefinition';

// A map of [token starting index] to [span of all comments before that token]
type CommentsMap = Map<number, Span>;

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

export async function sortTemplate(template: DeploymentTemplateDoc | undefined, sectionType: TemplateSectionType, textEditor: vscode.TextEditor): Promise<void> {
    if (!template) {
        return;
    }
    switch (sectionType) {
        case TemplateSectionType.Functions:
            await showSortingResultMessage(() => sortFunctions(template, textEditor), "Functions");
            break;
        case TemplateSectionType.Outputs:
            await showSortingResultMessage(() => sortOutputs(template, textEditor), "Outputs");
            break;
        case TemplateSectionType.Parameters:
            await showSortingResultMessage(() => sortParameters(template, textEditor), "Parameters");
            break;
        case TemplateSectionType.Resources:
            await showSortingResultMessage(() => sortResources(template, textEditor), "Resources");
            break;
        case TemplateSectionType.Variables:
            await showSortingResultMessage(() => sortVariables(template, textEditor), "Variables");
            break;
        case TemplateSectionType.TopLevel:
            await showSortingResultMessage(() => sortTopLevel(template, textEditor), "Top-level items");
            break;
        default:
            assertNever(sectionType);
    }
}

/**
 * Shows an information message on the result of the sorting.
 * Could be "Resources section was sorted" or "Nothing in resources needed sorting"
 * @param sortAction The action that is invoked to do the sorting
 * @param part The part of the template (example: Resources)
 * @returns A promise of void
 */
async function showSortingResultMessage(sortAction: () => Promise<boolean>, part: string): Promise<void> {
    let didSorting = await sortAction();
    let message = didSorting ? `"${part}" section was sorted` : `Nothing in "${part.toLowerCase()}" needed sorting`;
    vscode.window.showInformationMessage(message);
}

/**
 * Sorts the outputs.
 * @param template The template to be sorted
 * @param textEditor The current text editor
 * @returns True if order was changed when sorting, otherwise false
 */
async function sortOutputs(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor): Promise<boolean> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return false;
    }
    let outputs = Json.asObjectValue(rootValue.getPropertyValue(templateKeys.outputs));
    if (outputs) {
        return await sortGeneric<Json.Property>(outputs.properties, x => x.nameValue.quotedValue, x => x.span, template, textEditor);
    }
    return false;
}

/**
 * Sorts the resources and first level of their sub resources.
 * @param  template The deployment template to be sorted
 * @param textEditor The current text editor
 * @returns True if the order was changed when sorting, otherwise false
 */
async function sortResources(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor): Promise<boolean> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return false;
    }
    let resources = Json.asArrayValue(rootValue.getPropertyValue(templateKeys.resources));
    if (resources) {
        let didSort1 = await sortGenericDeep<Json.Value, Json.Value>(
            resources.elements, getResourcesFromResource, getNameFromResource, x => x.span, template, textEditor);
        let didSort2 = await sortGeneric<Json.Value>(resources.elements, getNameFromResource, x => x.span, template, textEditor);
        return didSort1 || didSort2;
    }
    return false;
}

/**
 * Sorts the top-level items (parameters, variables, functions, resources and outputs).
 * @param template The deployment template to be sorted
 * @param textEditor The current text editor
 * @returns True if order was changed after sorting, otherwise false
 */
async function sortTopLevel(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor): Promise<boolean> {
    let rootValue = template.topLevelValue;
    if (!rootValue) {
        return false;
    }
    return await sortGeneric<Json.Property>(rootValue.properties, x => getTopLevelOrder(x.nameValue.quotedValue), x => x.span, template, textEditor);
}

/**
 * Sort the variables.
 * @param template The deployment template to be sorted
 * @param textEditor The current text editor
 * @returns True if order was changed after sorting, otherwise false
 */
async function sortVariables(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor): Promise<boolean> {
    return await sortGeneric<IVariableDefinition>(
        template.topLevelScope.variableDefinitions,
        x => x.nameValue.quotedValue, x => x.span, template, textEditor);
}

/**
 * Sorts the parameters.
 * @param template The deployment template to be sorted
 * @param textEditor The current text editor
 * @returns True if order was changed after sorting, otherwise false
 */
async function sortParameters(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor): Promise<boolean> {
    return await sortGeneric<IParameterDefinition>(
        template.topLevelScope.parameterDefinitionsSource.parameterDefinitions,
        x => x.nameValue.quotedValue, x => x.fullSpan, template, textEditor);
}

/**
 * Sorts the functions and namespaces.
 * @param template The deployment template to be sorted
 * @param textEditor The current text editor
 * @returns True if order was changed after sorting, otherwise false
 */
async function sortFunctions(template: DeploymentTemplateDoc, textEditor: vscode.TextEditor): Promise<boolean> {
    let didSort1 = await sortGenericDeep<UserFunctionNamespaceDefinition, UserFunctionDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.members, x => x.nameValue.quotedValue, x => x.span, template, textEditor);
    let didSort2 = await sortGeneric<UserFunctionNamespaceDefinition>(
        template.topLevelScope.namespaceDefinitions,
        x => x.nameValue.quotedValue, x => x.span, template, textEditor);
    return didSort1 || didSort2;
}

function createCommentsMap(tokens: Json.Token[], commentTokens: Json.Token[], lastSpan: Span): CommentsMap {
    let commentsMap: CommentsMap = new Map<number, Span>();
    let currentCommentsSpan: Span | undefined;
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

function expandSpanToPrecedingComments(span: Span, comments: CommentsMap): Span {
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

async function sortGeneric<T>(list: T[], sortSelector: (value: T) => string, spanSelector: (value: T) => Span, template: DeploymentTemplateDoc, textEditor: vscode.TextEditor): Promise<boolean> {
    if (list.length < 2) {
        return false;
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
        return false;
    }
    let sortedTexts = sorted.map(value => getText(expandSpanToPrecedingComments(spanSelector(value), comments), document));
    let joined = joinTexts(sortedTexts, indentedTexts);
    await textEditor.edit(x => x.replace(selectionWithComments, joined));
    return true;
}

async function sortGenericDeep<T, TChild>(list: T[], childSelector: (value: T) => TChild[] | undefined, sortSelector: (value: TChild) => string, spanSelector: (value: TChild) => Span, template: DeploymentTemplateDoc, textEditor: vscode.TextEditor): Promise<boolean> {
    let didSorting = false;
    for (let item of list) {
        let children = childSelector(item);
        if (children) {
            if (await sortGeneric(children, sortSelector, spanSelector, template, textEditor)) {
                didSorting = true;
            }
        }
    }
    return didSorting;
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
    let name = nameProperty.toShortFriendlyString();
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

function getIndentTexts<T>(list: T[], spanSelector: (value: T) => Span, document: vscode.TextDocument): String[] {
    let indentTexts: String[] = [];
    for (let index = 0; index < list.length - 1; index++) {
        let span1 = spanSelector(list[index]);
        let span2 = spanSelector(list[index + 1]);
        let intendentText = document.getText(new vscode.Range(document.positionAt(span1.afterEndIndex), document.positionAt(span2.startIndex)));
        indentTexts.push(intendentText);
    }
    return indentTexts;
}

function getRange(span: Span, document: vscode.TextDocument): vscode.Range {
    return new vscode.Range(document.positionAt(span.startIndex), document.positionAt(span.afterEndIndex));
}

function getText(span: Span, document: vscode.TextDocument): String {
    let range = getRange(span, document);
    let text = document.getText(range);
    return text;
}

function getSelection(start: Span, end: Span, document: vscode.TextDocument): vscode.Selection {
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
