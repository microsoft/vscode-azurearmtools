/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import { TextDocument, window } from 'vscode';
import * as os from 'os';
import * as vscode from "vscode";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { ext } from '../extensionVariables';
import * as Json from "../JSON";

export async function sortTemplate(template: DeploymentTemplate | undefined): Promise<void> {
    if (template === undefined) {
        return;
    }
    ext.outputChannel.appendLine("Sorting template");
    let variables = template.topLevelScope.variableDefinitions;
    let start = variables[0].span.startIndex;
    let end = variables[variables.length - 1].span.afterEndIndex;
    let textEditor = vscode.window.activeTextEditor;
    if (textEditor === undefined) {
        return;
    }
    let document = textEditor.document;
    if (document === undefined) {
        return;
    }
    let position = document.positionAt(start);
    if (position === undefined) {
        return;
    }
    let sorted = variables.sort((a, b) => a.nameValue.quotedValue.localeCompare(b.nameValue.quotedValue));
    let startPosition = document.positionAt(start);
    let startOfLine = new vscode.Position(startPosition.line, 0);
    let selection = new vscode.Selection(document.positionAt(start), document.positionAt(end));
    let indentText = document.getText(new vscode.Range(startOfLine, startPosition)).replace(/\S/g, ' ');
    let joined = sorted.map(x => `${x.nameValue.quotedValue}: ${toString(x.value)}`).join(`,${os.EOL}${indentText}`);
    textEditor.edit(x => x.replace(selection, joined));
    vscode.window.showInformationMessage("Done sorting template!");
}

function toString(value: Json.Value | null): String {
    if (value === null) {
        return "null";
    }
    if (value.valueKind === Json.ValueKind.StringValue) {
        return `"${value.toFriendlyString()}"`;
    }
    return value.toFriendlyString();
}
