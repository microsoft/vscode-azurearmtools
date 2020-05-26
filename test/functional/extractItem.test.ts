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
    const baseTemplate =
        `{
    "parameters": {},
    "variables": {},
    "resources": [
        {
            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
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

    suite("ExtractParameter", () => {

        const storageNameTemplate =
            `{
    "parameters": {
        "storageKind": {
            "type": "string",
            "defaultValue": "StorageV2",
            "metadata": {
                "description": "Kind of storage"
            }
        }
    },
    "variables": {},
    "resources": [
        {
            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[resourceGroup().location]",
            "kind": "[parameters('storageKind')]",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        const locationTemplate =
            `{
    "parameters": {
        "location": {
            "type": "string",
            "defaultValue": "[resourceGroup().location]",
            "metadata": {
                "description": "Location of resource"
            }
        }
    },
    "variables": {},
    "resources": [
        {
            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[parameters('location')]",
            "kind": "StorageV2",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        test('StorageKind', async () => {
            await testUserInput.runWithInputs(["storageKind", "Kind of storage"], async () => {
                await createExtractParameterTests(baseTemplate, storageNameTemplate, "StorageV2");
            });
        });
        test('[resourceGroup().location]', async () => {
            await testUserInput.runWithInputs(["location", "Location of resource"], async () => {
                await createExtractParameterTests(baseTemplate, locationTemplate, "[resourceGroup().location]");
            });
        });
    });
    suite("ExtractVariable", () => {
        const storageKindTemplate =
            `{
    "parameters": {},
    "variables": {
        "storageKind": "StorageV2"
    },
    "resources": [
        {
            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[resourceGroup().location]",
            "kind": "[variables('storageKind')]",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        const locationTemplate =
            `{
    "parameters": {},
    "variables": {
        "location": "[resourceGroup().location]"
    },
    "resources": [
        {
            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "2019-06-01",
            "location": "[variables('location')]",
            "kind": "StorageV2",
            "sku": {
                "name": "Premium_LRS"
            }
        }
    ]
}`;
        test('Storageaccount1', async () => {
            await testUserInput.runWithInputs(["storageKind"], async () => {
                await createExtractVariableTests(baseTemplate, storageKindTemplate, "StorageV2");
            });
        });
        test('[resourceGroup().location]', async () => {
            await testUserInput.runWithInputs(["location"], async () => {
                await createExtractVariableTests(baseTemplate, locationTemplate, "[resourceGroup().location]");
            });
        });
    });
});
