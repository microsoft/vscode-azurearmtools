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

let previousSettings = {
    insertSpaces: <boolean | undefined>undefined,
    tabSize: <string | number | undefined>undefined,
    eol: <string | undefined>undefined,
};

namespace configKeys {
    export const editor = 'editor';
    export const insertSpaces = 'insertSpaces';
    export const tabSize = 'tabSize';
}

suite("InsertItem", async (): Promise<void> => {
    function assertTemplate(actual: String, expected: String, textEditor: vscode.TextEditor) {
        let spaces = textEditor.options.insertSpaces;
        let tabs = textEditor.options.tabSize;
        let eol = textEditor.document.eol;
        if (spaces === true) {
            expected = expected.replace(/\t/g, ' '.repeat(Number(tabs)));
        }
        if (eol === vscode.EndOfLine.CRLF) {
            expected = expected.replace(/\n/g, '\r\n');
        }
        assert.equal(actual.replace(/\t/g, '    '), expected);
    }

    const emptyTemplate =
        `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [],
    "variables": {}
}`;

    async function testInsertItem(template: String, expected: String): Promise<void> {
        test("Tabs CRLF", async () => {
            await testInsertItemWithSettings(template, expected, false, 4, true);
        });
        test("Spaces CRLF", async () => {
            await testInsertItemWithSettings(template, expected, true, 4, true);
        });
        test("Spaces LF", async () => {
            await testInsertItemWithSettings(template, expected, true, 4, false);
        });
        test("Tabs LF", async () => {
            await testInsertItemWithSettings(template, expected, false, 4, false);
        });
    }

    async function testInsertItemWithSettings(template: String, expected: String, insertSpaces: boolean, tabSize: number, eolAsCRLF: boolean): Promise<void> {
        let config = vscode.workspace.getConfiguration(configKeys.editor);
        config.update(configKeys.insertSpaces, insertSpaces, vscode.ConfigurationTarget.Global);
        config.update(configKeys.tabSize, tabSize, vscode.ConfigurationTarget.Global);
        if (eolAsCRLF) {
            template = template.replace(/\n/g, '\r\n');
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

    // beforeEach(() => {
    //     let config = vscode.workspace.getConfiguration(configKeys.editor);
    //     previousSettings.insertSpaces = config.get(configKeys.insertSpaces);
    //     previousSettings.tabSize = config.get(configKeys.tabSize);
    // });

    // afterEach(() => {
    //     let config = vscode.workspace.getConfiguration(configKeys.editor);
    //     config.update(configKeys.insertSpaces, previousSettings.insertSpaces, vscode.ConfigurationTarget.Global);
    //     config.update(configKeys.tabSize, previousSettings.tabSize, vscode.ConfigurationTarget.Global);
    // });

    suite("Variables", async () => {
        await testInsertItem(emptyTemplate,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [],
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
