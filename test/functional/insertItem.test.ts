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
import { DeploymentTemplate } from '../../src/DeploymentTemplate';
import { InsertItem } from '../../src/insertItem';
import { SortType } from '../../src/sortTemplate';
import { getTempFilePath } from "../support/getTempFilePath";

suite("InsertItem", async (): Promise<void> => {
    const parameterCommand = 'azurerm-vscode-tools.insertParameter';
    const variableCommand = 'azurerm-vscode-tools.insertVariable';
    const command = 'azurerm-vscode-tools.insertItem';
    const resourceCommand = 'azurerm-vscode-tools.insertResource';
    const outputCommand = 'azurerm-vscode-tools.insertOutput';
    const functionCommand = 'azurerm-vscode-tools.insertFunction';

    const emptyTemplate = `{
        "variables": {}
    }`;

    async function testInsertItem(command: string, template: String, expected: String): Promise<void> {
        const tempPath = getTempFilePath(`insertItem`, '.azrm');

        fse.writeFileSync(tempPath, template);

        let doc = await workspace.openTextDocument(tempPath);
        await window.showTextDocument(doc);

        // InsertItem
        let ui = new MockUserInput();
        let insertItem = new InsertItem(ui);
        let document = window.activeTextEditor!.document;
        let deploymentTemplate = new DeploymentTemplate(document.getText(), document.uri.toString());
        await insertItem.insertItem(deploymentTemplate, SortType.Variables, window.activeTextEditor!);
        // await commands.executeCommand(command, null, null, null, { hello: 'World!' });

        const docTextAfterInsertion = window.activeTextEditor!.document.getText();
        assert.deepStrictEqual(docTextAfterInsertion, expected);
    }

    test("Variables", async () => {
        await testInsertItem(
            command, emptyTemplate,
            `{
                "variables": {
                    "variable1": "[]"
                }
            }`);
    });
});

class MockUserInput implements IAzureUserInput {
    public async showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options: import("vscode-azureextensionui").IAzureQuickPickOptions): Promise<T> {
        let result = await items;
        return result[0];
    }

    public async showInputBox(options: vscode.InputBoxOptions): Promise<string> {
        return "Hello World";
    }

    public async showWarningMessage<T extends vscode.MessageItem>(message: string, options: import("vscode-azureextensionui").IAzureMessageOptions, ...items: T[]): Promise<T> {
        return items[0];
    }

    public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        return [vscode.Uri.file("c:\\some\\path")];
    }
}
