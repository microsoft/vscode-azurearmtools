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
import { DeploymentTemplateDoc, ExtractItem } from '../../extension.bundle';
import { getActionContext } from '../support/getActionContext';
import { getCodeActionContext } from '../support/getCodeActionContext';
import { getTempFilePath } from '../support/getTempFilePath';

suite("ExtractItem", async (): Promise<void> => {
    let testUserInput: TestUserInput = new TestUserInput(vscode);
    async function runExtractParameterTests(startTemplate: string, expectedTemplate: string, selectedText: string, codeActionsCount: number = 2): Promise<void> {
        await runExtractItemTests(startTemplate, expectedTemplate, selectedText, codeActionsCount, async (extractItem, template, editor) => await extractItem.extractParameter(editor, template, getActionContext()));
    }

    async function runExtractVariableTests(startTemplate: string, expectedTemplate: string, selectedText: string, codeActionsCount: number = 2): Promise<void> {
        await runExtractItemTests(startTemplate, expectedTemplate, selectedText, codeActionsCount, async (extractItem, template, editor) => await extractItem.extractVariable(editor, template, getActionContext()));
    }

    async function runExtractItemTests(startTemplate: string, expectedTemplate: string, selectedText: string, codeActionsCount: number, action: (extractItem: ExtractItem, deploymentTemplate: DeploymentTemplateDoc, textEditor: vscode.TextEditor) => Promise<void>): Promise<void> {
        const tempPath = getTempFilePath(`insertItem`, '.azrm');
        fse.writeFileSync(tempPath, startTemplate);
        let document = await vscode.workspace.openTextDocument(tempPath);
        let textEditor = await vscode.window.showTextDocument(document);
        let extractItem = new ExtractItem(testUserInput);
        let deploymentTemplate = new DeploymentTemplateDoc(document.getText(), document.uri);
        let text = document.getText(undefined);
        let index = text.indexOf(selectedText);
        let position = document.positionAt(index);
        let position2 = document.positionAt(index + selectedText.length);
        textEditor.selection = new vscode.Selection(position, position2);
        let codeActions = deploymentTemplate.getCodeActions(undefined, textEditor.selection, getCodeActionContext());
        assert.equal(codeActions.length, codeActionsCount, `GetCodeAction should return ${codeActionsCount}`);
        if (codeActionsCount > 0) {
            await action(extractItem, deploymentTemplate, textEditor);
            const docTextAfterInsertion = document.getText();
            assert.equal(docTextAfterInsertion, expectedTemplate, "extractVaraiable should perform expected result");
        }
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
                await runExtractParameterTests(baseTemplate, storageNameTemplate, "StorageV2");
            });
        });
        test('[resourceGroup().location]', async () => {
            await testUserInput.runWithInputs(["location", "Location of resource"], async () => {
                await runExtractParameterTests(baseTemplate, locationTemplate, "[resourceGroup().location]");
            });
        });
        test('resourceGroup().location', async () => {
            await testUserInput.runWithInputs(["location", "Location of resource"], async () => {
                await runExtractParameterTests(baseTemplate, locationTemplate, "resourceGroup().location");
            });
        });
        test('[parameters(\'location\')] should not generate code action', async () => {
            await runExtractParameterTests(locationTemplate, '', "[parameters('location')]", 0);
        });
        test('[parameters(\'location\')] should not generate code action', async () => {
            await runExtractParameterTests(locationTemplate, '', "parameters('location')", 0);
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
                await runExtractVariableTests(baseTemplate, storageKindTemplate, "StorageV2");
            });
        });
        test('[resourceGroup().location]', async () => {
            await testUserInput.runWithInputs(["location"], async () => {
                await runExtractVariableTests(baseTemplate, locationTemplate, "[resourceGroup().location]");
            });
        });
        test('resourceGroup().location', async () => {
            await testUserInput.runWithInputs(["location"], async () => {
                await runExtractVariableTests(baseTemplate, locationTemplate, "resourceGroup().location");
            });
        });
        test('[variables(\'location\')] should not generate code action', async () => {
            await runExtractParameterTests(locationTemplate, '', "[variables('location')]", 0);
        });
        test('variables(\'location\') should not generate code action', async () => {
            await runExtractParameterTests(locationTemplate, '', "variables('location')", 0);
        });
    });
});
