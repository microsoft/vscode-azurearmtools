/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { IActionContext, IAzureUserInput } from "vscode-azureextensionui";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { InsertItem } from "./insertItem";
export class ExtractItem {
    // tslint:disable-next-line:no-empty
    constructor(private ui: IAzureUserInput) {
    }

    public async extractParameter(editor: vscode.TextEditor, template: DeploymentTemplate, context: IActionContext): Promise<void> {
        let selection = this.expandSelectionToSquareBrackets(editor.selection, editor.document);
        let selectedText = editor.document.getText(selection);
        let name = await this.ui.showInputBox({ prompt: "Name of parameter?" });
        const leaveEmpty = "Press 'Enter' if you do not want to add a description.";
        let description = await this.ui.showInputBox({ prompt: "Description?", placeHolder: leaveEmpty });
        await editor.edit(builder => builder.replace(selection, `[parameters('${name}')]`));
        await new InsertItem(this.ui).insertParameterWithDefaultValue(template, editor, context, name, selectedText, description);
        editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end), vscode.TextEditorRevealType.Default);
    }

    public async extractVariable(editor: vscode.TextEditor, template: DeploymentTemplate, context: IActionContext): Promise<void> {
        let selection = this.expandSelectionToSquareBrackets(editor.selection, editor.document);
        let selectedText = editor.document.getText(selection);
        let name = await this.ui.showInputBox({ prompt: "Name of variable?" });
        await editor.edit(builder => builder.replace(selection, `[variables('${name}')]`));
        await new InsertItem(this.ui).insertVariableWithValue(template, editor, context, name, selectedText);
        editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end), vscode.TextEditorRevealType.Default);
    }

    private expandSelectionToSquareBrackets(selection: vscode.Selection, document: vscode.TextDocument): vscode.Selection {
        if (selection.start.character === 0) {
            return selection;
        }
        const startPos = new vscode.Position(selection.anchor.line, selection.anchor.character - 1);
        const endPos = new vscode.Position(selection.end.line, selection.end.character + 1);
        let beforeStartSelection = new vscode.Selection(startPos, selection.anchor);
        let afterEndSelection = new vscode.Selection(selection.end, endPos);
        if (document.getText(beforeStartSelection) === "[" && document.getText(afterEndSelection) === "]") {
            return new vscode.Selection(startPos, endPos);
        }
        return selection;
    }
}
