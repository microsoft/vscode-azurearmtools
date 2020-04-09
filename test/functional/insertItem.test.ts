// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as vscode from "vscode";
import { window, workspace } from "vscode";
import { IAzureUserInput } from 'vscode-azureextensionui';
import { DeploymentTemplate, InsertItem, SortType } from '../../extension.bundle';
import { getTempFilePath } from "../support/getTempFilePath";

suite("InsertItem", async (): Promise<void> => {
    function assertTemplate(actual: String, expected: String, textEditor: vscode.TextEditor): void {
        if (textEditor.options.insertSpaces === true) {
            expected = expected.replace(/    /g, ' '.repeat(Number(textEditor.options.tabSize)));
        } else {
            expected = expected.replace(/    /g, '\t');
        }
        if (textEditor.document.eol === vscode.EndOfLine.CRLF) {
            expected = expected.replace(/\n/g, '\r\n');
        }
        assert.equal(actual, expected);
    }

    const emptyTemplate =
        `{
    "variables": {}
}`;

    async function testInsertItem(template: string, expected: String): Promise<void> {
        test("Tabs CRLF", async () => {
            await testInsertItemWithSettings(template, expected, false, 4, true);
        });
        test("Spaces CRLF", async () => {
            await testInsertItemWithSettings(template, expected, true, 4, true);
        });
        test("Spaces (2) CRLF", async () => {
            await testInsertItemWithSettings(template, expected, true, 2, true);
        });
        test("Spaces LF", async () => {
            await testInsertItemWithSettings(template, expected, true, 4, false);
        });
        test("Tabs LF", async () => {
            await testInsertItemWithSettings(template, expected, false, 4, false);
        });
        test("Spaces (2) LF", async () => {
            await testInsertItemWithSettings(template, expected, true, 2, false);
        });
    }

    async function testInsertItemWithSettings(template: string, expected: String, insertSpaces: boolean, tabSize: number, eolAsCRLF: boolean): Promise<void> {
        if (eolAsCRLF) {
            template = template.replace(/\n/g, '\r\n');
        }
        if (insertSpaces && tabSize != 4) {
            template = template.replace(/    /g, ' '.repeat(tabSize));
        }
        const tempPath = getTempFilePath(`insertItem`, '.azrm');
        fse.writeFileSync(tempPath, template);
        let document = await workspace.openTextDocument(tempPath);
        let textEditor = await window.showTextDocument(document);
        let ui = new MockUserInput(["variable1"]);
        let insertItem = new InsertItem(ui);
        let deploymentTemplate = new DeploymentTemplate(document.getText(), document.uri.toString());
        await insertItem.insertItem(deploymentTemplate, SortType.Variables, textEditor);
        await textEditor.edit(builder => builder.insert(textEditor.selection.active, "resourceGroup()"));
        const docTextAfterInsertion = document.getText();
        assertTemplate(docTextAfterInsertion, expected, textEditor);
    }

    suite("Variables", async () => {
        await testInsertItem(emptyTemplate,
            `{
    "variables": {
        "variable1": "[resourceGroup()]"
    }
}`
        );
    });
});

class MockUserInput implements IAzureUserInput {
    private showInputBoxTexts: string[] = [];
    constructor(showInputBox: string[]) {
        this.showInputBoxTexts = showInputBox;
    }
    public async showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options: import("vscode-azureextensionui").IAzureQuickPickOptions): Promise<T> {
        let result = await items;
        return result[0];
    }

    public async showInputBox(options: vscode.InputBoxOptions): Promise<string> {
        return this.showInputBoxTexts.pop()!;
    }

    public async showWarningMessage<T extends vscode.MessageItem>(message: string, options: import("vscode-azureextensionui").IAzureMessageOptions, ...items: T[]): Promise<T> {
        return items[0];
    }

    public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        return [vscode.Uri.file("c:\\some\\path")];
    }
}
