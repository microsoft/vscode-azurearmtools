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
        let selection = editor.selection;
        let selectedText = editor.document.getText(selection);
        let name = await this.ui.showInputBox({ prompt: "Name of parameter?" });
        let description = await this.ui.showInputBox({ prompt: "Description? Leave empty for no description.", });
        await editor.edit(builder => builder.replace(selection, `[parameters('${name}')]`));
        await new InsertItem(this.ui).insertParameterWithDefaultValue(template, editor, context, name, selectedText, description);
        editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end), vscode.TextEditorRevealType.Default);
    }

    public async extractVariable(editor: vscode.TextEditor, template: DeploymentTemplate, context: IActionContext): Promise<void> {
        let selection = editor.selection;
        let selectedText = editor.document.getText(selection);
        let name = await this.ui.showInputBox({ prompt: "Name of variable?" });
        await editor.edit(builder => builder.replace(selection, `[variables('${name}')]`));
        await new InsertItem(this.ui).insertVariableWithValue(template, editor, context, name, selectedText);
        editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end), vscode.TextEditorRevealType.Default);
    }
}
