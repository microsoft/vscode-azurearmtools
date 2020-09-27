/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { IActionContext, IAzureUserInput } from "vscode-azureextensionui";
import { DeploymentTemplateDoc } from "./DeploymentTemplateDoc";
import { InsertItem } from "./insertItem";
export class ExtractItem {
    // tslint:disable-next-line:no-empty
    constructor(private ui: IAzureUserInput) {
    }

    public async extractParameter(editor: vscode.TextEditor, template: DeploymentTemplateDoc, context: IActionContext): Promise<void> {
        let selection = this.expandSelection(editor.selection, editor.document, template, editor);
        let selectedText = editor.document.getText(selection);
        let name = await this.ui.showInputBox({ prompt: "Enter the new parameter name" });
        const leaveEmpty = "Press 'Enter' if you do not want to add a description.";
        let description = await this.ui.showInputBox({ prompt: "Description?", placeHolder: leaveEmpty });
        const insertText = `[parameters('${name}')]`;
        const texts = this.fixExtractTexts(selectedText, insertText, selection, template, editor);
        await editor.edit(builder => builder.replace(selection, texts[1]), { undoStopBefore: true, undoStopAfter: false });
        await new InsertItem(this.ui).insertParameterWithDefaultValue(template, editor, context, name, texts[0], description, { undoStopBefore: false, undoStopAfter: true });
        editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end), vscode.TextEditorRevealType.Default);
    }

    public async extractVariable(editor: vscode.TextEditor, template: DeploymentTemplateDoc, context: IActionContext): Promise<void> {
        let selection = this.expandSelection(editor.selection, editor.document, template, editor);
        let selectedText = editor.document.getText(selection);
        let name = await this.ui.showInputBox({ prompt: "Enter the new variable name" });
        let insertText = `[variables('${name}')]`;
        const texts = this.fixExtractTexts(selectedText, insertText, selection, template, editor);
        await editor.edit(builder => builder.replace(selection, texts[1]), { undoStopBefore: true, undoStopAfter: false });
        await new InsertItem(this.ui).insertVariableWithValue(template, editor, context, name, texts[0], { undoStopBefore: false, undoStopAfter: true });
        editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end), vscode.TextEditorRevealType.Default);
    }

    public fixExtractTexts(selectedText: string, insertText: string, selection: vscode.Selection, template: DeploymentTemplateDoc, editor: vscode.TextEditor): string[] {
        if (this.isInsideExpression(selection, template, editor)) {
            if (this.isText(selectedText)) {
                insertText = this.removeStartAndEnd(insertText);
                selectedText = this.removeStartAndEnd(selectedText.trim());
            } else if (this.isNumber(selectedText)) {
                insertText = this.removeStartAndEnd(insertText);
                selectedText = selectedText.trim();
            } else {
                insertText = this.removeStartAndEnd(insertText);
                selectedText = this.addSquareBrackets(selectedText);
            }
        }
        return [selectedText, insertText];
    }

    public expandSelection(selection: vscode.Selection, document: vscode.TextDocument, template: DeploymentTemplateDoc, editor: vscode.TextEditor): vscode.Selection {
        if (selection.start.character === 0) {
            return selection;
        }
        if (selection.start.character === selection.end.character) {
            let pc = template.getContextFromDocumentLineAndColumnIndexes(selection.start.line, selection.start.character, undefined);
            if (pc.jsonValue) {
                const span = pc.jsonValue.span;
                return new vscode.Selection(editor.document.positionAt(span.startIndex + 1), editor.document.positionAt(span.endIndex));
            }
        }
        const startPos = new vscode.Position(selection.anchor.line, selection.anchor.character - 1);
        const endPos = new vscode.Position(selection.end.line, selection.end.character + 1);
        const textBefore = document.getText(new vscode.Selection(startPos, selection.anchor));
        const textAfter = document.getText(new vscode.Selection(selection.end, endPos));
        if (textBefore === "[" && textAfter === "]" || textBefore === '\'' && textAfter === '\'') {
            return new vscode.Selection(startPos, endPos);
        }
        return selection;
    }

    private removeStartAndEnd(text: string): string {
        return text.substr(1, text.length - 2);
    }

    private addSquareBrackets(text: string): string {
        return `[${text}]`;
    }

    private isText(text: string): boolean {
        const regEx = /^\s*'.+'\s*$/gi;
        return regEx.test(text);
    }

    private isNumber(text: string): boolean {
        const regEx = /^\s*\d+\s*$/gi;
        return regEx.test(text);
    }

    private isInsideExpression(selection: vscode.Selection, template: DeploymentTemplateDoc, editor: vscode.TextEditor): boolean {
        let pc = template.getContextFromDocumentLineAndColumnIndexes(selection.start.line, selection.start.character, undefined);
        if (pc.jsonValue && pc.jsonValue.asStringValue) {
            let selectedText = editor.document.getText(selection);
            if (selectedText === pc.jsonValue.asStringValue.unquotedValue) {
                return false;
            }
            return template.isExpression(pc.jsonValue.asStringValue?.quotedValue);
        }
        return false;
    }
}
