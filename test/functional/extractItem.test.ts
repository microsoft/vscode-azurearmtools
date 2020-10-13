// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion object-literal-key-quotes

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as vscode from "vscode";
import { TestUserInput } from 'vscode-azureextensiondev';
import { DeploymentTemplateDoc, ExtractItem } from '../../extension.bundle';
import { IPartialDeploymentTemplate } from '../support/diagnostics';
import { getActionContext } from '../support/getActionContext';
import { getCodeActionContext } from '../support/getCodeActionContext';
import { getTempFilePath } from '../support/getTempFilePath';
import { stringify } from '../support/stringify';

suite("ExtractItem", async (): Promise<void> => {
    let testUserInput: TestUserInput = new TestUserInput(vscode);
    async function runExtractParameterTest(startTemplate: string | IPartialDeploymentTemplate, selectedText: string, testInputs: (string | RegExp)[], codeActionsCount: number = 2, expectedTemplate?: string | IPartialDeploymentTemplate): Promise<void> {
        await runExtractItemTest(startTemplate, selectedText, testInputs, codeActionsCount, expectedTemplate, async (extractItem, template, editor) => await extractItem.extractParameter(editor, template, getActionContext()));
    }

    async function runExtractVariableTest(startTemplate: string | IPartialDeploymentTemplate, selectedText: string, testInputs: (string | RegExp)[], codeActionsCount: number = 2, expectedTemplate?: string | IPartialDeploymentTemplate): Promise<void> {
        await runExtractItemTest(startTemplate, selectedText, testInputs, codeActionsCount, expectedTemplate, async (extractItem, template, editor) => await extractItem.extractVariable(editor, template, getActionContext()));
    }

    async function runExtractItemTest(startTemplate: string | IPartialDeploymentTemplate, selectedText: string, testInputs: (string | RegExp)[], codeActionsCount: number, expectedTemplate: string | IPartialDeploymentTemplate | undefined, doExtract: (extractItem: ExtractItem, deploymentTemplate: DeploymentTemplateDoc, textEditor: vscode.TextEditor) => Promise<void>): Promise<void> {
        await testUserInput.runWithInputs(testInputs, async () => {
            const tempPath = getTempFilePath(`insertItem`, '.azrm');
            if (typeof startTemplate !== 'string') {
                startTemplate = stringify(startTemplate);
            }
            if (expectedTemplate && typeof expectedTemplate !== 'string') {
                expectedTemplate = stringify(expectedTemplate);
            }

            fse.writeFileSync(tempPath, startTemplate);
            let document = await vscode.workspace.openTextDocument(tempPath);
            let textEditor = await vscode.window.showTextDocument(document);
            let extractItem = new ExtractItem(testUserInput);
            let deploymentTemplate = new DeploymentTemplateDoc(document.getText(), document.uri);
            let text = document.getText(undefined);
            let index = text.indexOf(selectedText);
            let position = document.positionAt(index);
            let endPosition = document.positionAt(index + selectedText.length);
            textEditor.selection = new vscode.Selection(position, endPosition);
            let codeActions = deploymentTemplate.getCodeActions(undefined, textEditor.selection, getCodeActionContext());
            assert.equal(codeActions.length, codeActionsCount, `GetCodeAction should return ${codeActionsCount}`);
            if (codeActionsCount > 0) {
                await doExtract(extractItem, deploymentTemplate, textEditor);
                const docTextAfterInsertion = document.getText();
                assert.equal(docTextAfterInsertion, expectedTemplate, "extractVaraiable should perform expected result");
            }
        });
    }

    const baseTemplate = {
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
    };

    ///////////////// Extract parameters

    suite("ExtractParameter", () => {

        test('StorageKind', async () => {
            const expected = {
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
            };
            await runExtractParameterTest(baseTemplate, "StorageV2", ["storageKind", "Kind of storage"], 2, expected);
        });

        suite("Extract to location parameter", () => {
            const expected = {
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
            };
            test('[resourceGroup().location]', async () => {
                await runExtractParameterTest(baseTemplate, "[resourceGroup().location]", ["location", "Location of resource"], 2, expected);
            });
            test('resourceGroup().location', async () => {
                await runExtractParameterTest(baseTemplate, "resourceGroup().location", ["location", "Location of resource"], 2, expected);
            });
        });

        suite("Don't extract variable or parameter references", () => {
            const template = {
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
            };
            test('[parameters(\'location\')] should not generate code action', async () => {
                await runExtractParameterTest(template, "[parameters('location')]", [], 0);
            });
            test('[parameters(\'location\')] should not generate code action', async () => {
                await runExtractParameterTest(template, "parameters('location')", [], 0);
            });
        });

        test('No existing params', async () => {
            await runExtractParameterTest(
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "2019-06-01"
                        }
                    ]
                },
                "2019-06-01",
                ["p1", "description"],
                2,
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "[parameters('p1')]"
                        }
                    ],
                    "parameters": {
                        "p1": {
                            "type": "string",
                            "defaultValue": "2019-06-01",
                            "metadata": {
                                "description": "description"
                            }
                        }
                    }
                }
            );
        });

        test('One existing param', async () => {
            await runExtractParameterTest(
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "2019-06-01"
                        }
                    ],
                    "parameters": {
                        "p1": {
                            "type": "string"
                        }
                    }
                },
                "2019-06-01",
                ["p2", "description"],
                2,
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "[parameters('p2')]"
                        }
                    ],
                    "parameters": {
                        "p1": {
                            "type": "string"
                        },
                        "p2": {
                            "type": "string",
                            "defaultValue": "2019-06-01",
                            "metadata": {
                                "description": "description"
                            }
                        }
                    }
                }
            );
        });

        test('ENTER for no description', async () => {
            await runExtractParameterTest(
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "2019-06-01"
                        }
                    ],
                    "parameters": {
                        "p1": {
                            "type": "string"
                        }
                    }
                },
                "2019-06-01",
                ["p2", ""],
                2,
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "[parameters('p2')]"
                        }
                    ],
                    "parameters": {
                        "p1": {
                            "type": "string"
                        },
                        "p2": {
                            "type": "string",
                            "defaultValue": "2019-06-01"
                        }
                    }
                }
            );
        });
    });

    ///////////////// Extract variables

    suite("ExtractVariable", () => {
        test('Storageaccount1', async () => {
            const expected = {
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
            };
            await runExtractVariableTest(baseTemplate, "StorageV2", ["storageKind"], 2, expected);
        });

        suite("Extract to location variable", () => {

            const expected = {
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
            };
            test('[resourceGroup().location]', async () => {
                await runExtractVariableTest(baseTemplate, "[resourceGroup().location]", ["location"], 2, expected);
            });
            test('resourceGroup().location', async () => {
                await runExtractVariableTest(baseTemplate, "resourceGroup().location", ["location"], 2, expected);
            });
        });

        suite("Don't extract variable or parameter references", () => {
            const baseTemplate2 = {
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
            };
            test('[variables(\'location\')] should not generate code action', async () => {
                await runExtractVariableTest(baseTemplate2, "[variables('location')]", [], 0);
            });
            test('variables(\'location\') should not generate code action', async () => {
                await runExtractVariableTest(baseTemplate2, "variables('location')", [], 0);
            });
        });

        test('No existing vars', async () => {
            await runExtractVariableTest(
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "2019-06-01"
                        }
                    ]
                },
                "2019-06-01",
                ["v1"],
                2,
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "[variables('v1')]"
                        }
                    ],
                    "variables": {
                        "v1": "2019-06-01"
                    }
                }
            );
        });

        test('One existing var', async () => {
            await runExtractVariableTest(
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "2019-06-01"
                        }
                    ],
                    "variables": {
                        "v1": "v1"
                    }
                },
                "2019-06-01",
                ["v2"],
                2,
                {
                    "resources": [
                        {
                            "name": "[concat(resourceGroup().id, 'storageid', 123)]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "[variables('v2')]"
                        }
                    ],
                    "variables": {
                        "v1": "v1",
                        "v2": "2019-06-01"
                    }
                }
            );
        });
    });
});
