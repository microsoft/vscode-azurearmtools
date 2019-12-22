/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as vscode from "vscode";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { ext } from '../extensionVariables';
import { IParameterDefinition } from '../IParameterDefinition';
import * as language from "../Language";
import { IVariableDefinition } from '../VariableDefinition';

export async function sortTemplate(template: DeploymentTemplate | undefined): Promise<void> {
    if (template === undefined) {
        return;
    }
    ext.outputChannel.appendLine("Sorting template");
    await sortVariables(template);
    await sortParameters(template);
    vscode.window.showInformationMessage("Done sorting template!");
}

function sortVariables(template: DeploymentTemplate): Thenable<boolean> {
    return sortGeneric<IVariableDefinition>(
        template.topLevelScope.variableDefinitions,
        x => x.nameValue.quotedValue, x => x.span);
}

function sortParameters(template: DeploymentTemplate): Thenable<boolean> {
    return sortGeneric<IParameterDefinition>(
        template.topLevelScope.parameterDefinitions,
        x => x.nameValue.quotedValue, x => x.fullSpan);
}

function sortGeneric<T>(list: T[], sortSelector: (value: T) => string, spanSelector: (value: T) => language.Span): Thenable<boolean> {
    let promise = Promise.resolve(true);
    let textEditor = vscode.window.activeTextEditor;
    if (textEditor === undefined || list.length < 2) {
        return promise;
    }
    let document = textEditor.document;
    let selection = getSelection(spanSelector(list[0]), spanSelector(list[list.length - 1]), document);
    let orderBefore = list.map(sortSelector);
    let sorted = list.sort((a, b) => sortSelector(a).localeCompare(sortSelector(b)));
    let orderAfter = list.map(sortSelector);
    if (arraysEqual<string>(orderBefore, orderAfter)) {
        return promise;
    }
    let indentText = getIndentText(spanSelector(list[0]), document);
    let joined = sorted.map(x => getText(spanSelector(x), document)).join(`,${os.EOL}${indentText}`);
    return textEditor.edit(x => x.replace(selection, joined));
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
