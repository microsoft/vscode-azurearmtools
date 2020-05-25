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
import { TestUserInput } from 'vscode-azureextensiondev';
import { DeploymentTemplate, ExtractItem } from '../../extension.bundle';
import { getActionContext } from '../support/getActionContext';
import { getTempFilePath } from '../support/getTempFilePath';

suite("ExtractItem", async (): Promise<void> => {
    let testUserInput: TestUserInput = new TestUserInput(vscode);
    async function createExtractParameterTests(startTemplate: string, expectedTemplate: string, selectedText: string): Promise<void> {
        const tempPath = getTempFilePath(`insertItem`, '.azrm');
        fse.writeFileSync(tempPath, startTemplate);
        let document = await vscode.workspace.openTextDocument(tempPath);
        let textEditor = await vscode.window.showTextDocument(document);
        let extractItem = new ExtractItem(testUserInput);
        let deploymentTemplate = new DeploymentTemplate(document.getText(), document.uri);
        let text = document.getText(undefined);
        let index = text.indexOf(selectedText);
        let position = document.positionAt(index);
        let position2 = document.positionAt(index + selectedText.length);
        textEditor.selection = new vscode.Selection(position, position2);
        await extractItem.extractParameter(textEditor, deploymentTemplate, getActionContext());
        const docTextAfterInsertion = document.getText();
        assert.equal(docTextAfterInsertion, expectedTemplate);
    }

    async function createExtractVariableTests(startTemplate: string, expectedTemplate: string, selectedText: string): Promise<void> {
        const tempPath = getTempFilePath(`insertItem`, '.azrm');
        fse.writeFileSync(tempPath, startTemplate);
        let document = await vscode.workspace.openTextDocument(tempPath);
        let textEditor = await vscode.window.showTextDocument(document);
        let extractItem = new ExtractItem(testUserInput);
        let deploymentTemplate = new DeploymentTemplate(document.getText(), document.uri);
        let text = document.getText(undefined);
        let index = text.indexOf(selectedText);
        let position = document.positionAt(index);
        let position2 = document.positionAt(index + selectedText.length);
        textEditor.selection = new vscode.Selection(position, position2);
        await extractItem.extractVariable(textEditor, deploymentTemplate, getActionContext());
        const docTextAfterInsertion = document.getText();
        assert.equal(docTextAfterInsertion, expectedTemplate);
    }

    suite("ExtractParameter", () => {
        const baseTemplate =
            `{
    "parameters": {},
    "resources": [
        {
            "name": "storageaccount1",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[resourceGroup().location]",
            "kind": "StorageV2",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        const storageNameTemplate =
            `{
    "parameters": {
        "param1": {
            "type": "string",
            "defaultValue": "storageaccount1",
            "metadata": {
                "description": "Description"
            }
        }
    },
    "resources": [
        {
            "name": "[parameters('param1')]",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[resourceGroup().location]",
            "kind": "StorageV2",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        const locationTemplate =
            `{
    "parameters": {
        "param1": {
            "type": "string",
            "defaultValue": "[resourceGroup().location]",
            "metadata": {
                "description": "Description"
            }
        }
    },
    "resources": [
        {
            "name": "storageaccount1",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[parameters('param1')]",
            "kind": "StorageV2",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        test('Storageaccount1', async () => {
            await testUserInput.runWithInputs(["param1", "Description"], async () => {
                await createExtractParameterTests(baseTemplate, storageNameTemplate, "storageaccount1");
            });
        });
        test('[resourceGroup().location]', async () => {
            await testUserInput.runWithInputs(["param1", "Description"], async () => {
                await createExtractParameterTests(baseTemplate, locationTemplate, "[resourceGroup().location]");
            });
        });
    });
    suite("ExtractVariable", () => {
        const baseTemplate =
            `{
    "variables": {},
    "resources": [
        {
            "name": "storageaccount1",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[resourceGroup().location]",
            "kind": "StorageV2",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        const storageNameTemplate =
            `{
    "variables": {
        "var1": "storageaccount1"
    },
    "resources": [
        {
            "name": "[variables('var1')]",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[resourceGroup().location]",
            "kind": "StorageV2",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        const locationTemplate =
            `{
    "variables": {
        "var1": "[resourceGroup().location]"
    },
    "resources": [
        {
            "name": "storageaccount1",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[variables('var1')]",
            "kind": "StorageV2",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        test('Storageaccount1', async () => {
            await testUserInput.runWithInputs(["var1"], async () => {
                await createExtractVariableTests(baseTemplate, storageNameTemplate, "storageaccount1");
            });
        });
        test('[resourceGroup().location]', async () => {
            await testUserInput.runWithInputs(["var1"], async () => {
                await createExtractVariableTests(baseTemplate, locationTemplate, "[resourceGroup().location]");
            });
        });
    });
});
