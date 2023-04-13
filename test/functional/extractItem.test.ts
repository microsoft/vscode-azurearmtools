// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as vscode from "vscode";
import { TestUserInput } from 'vscode-azureextensiondev';
import { DeploymentTemplateDoc, ExtractItem } from '../../extension.bundle';
import { assertEx } from '../support/assertEx';
import { IPartialDeploymentTemplate } from '../support/diagnostics';
import { getActionContext } from '../support/getActionContext';
import { getEmptyCodeActionContext } from '../support/getEmptyCodeActionContext';
import { getTempFilePath } from '../support/getTempFilePath';
import { stringify } from '../support/stringify';

suite("ExtractItem", async (): Promise<void> => {
    const testUserInput: TestUserInput = new TestUserInput(vscode);
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
            const document = await vscode.workspace.openTextDocument(tempPath);
            const textEditor = await vscode.window.showTextDocument(document);
            const extractItem = new ExtractItem(testUserInput);
            const deploymentTemplate = new DeploymentTemplateDoc(document.getText(), document.uri, 0);
            const text = document.getText(undefined);
            const index = text.indexOf(selectedText);
            assert(index >= 0, `Couldn't find selected text "${selectedText}"`);
            const position = document.positionAt(index);
            const endPosition = document.positionAt(index + selectedText.length);
            textEditor.selection = new vscode.Selection(position, endPosition);
            const codeActions = deploymentTemplate.getCodeActions(undefined, textEditor.selection, getEmptyCodeActionContext());
            assert.strictEqual(codeActions.length, codeActionsCount, `GetCodeAction should return ${codeActionsCount}`);
            if (codeActionsCount > 0) {
                await doExtract(extractItem, deploymentTemplate, textEditor);
                const docTextAfterInsertion = document.getText();
                assertEx.strictEqual(docTextAfterInsertion, expectedTemplate, {}, "extractVaraiable should perform expected result");
            }
        });
    }

    const baseTemplate = {
        parameters: {},
        variables: {},
        resources: [
            {
                name: "[concat(resourceGroup().id, 'storageid', 123)]",
                type: "Microsoft.Storage/storageAccounts",
                apiVersion: "2019-06-01",
                location: "[resourceGroup().location]",
                kind: "StorageV2",
                sku: {
                    name: "Premium_LRS"
                }
            }
        ]
    };

    ///////////////// Extract parameters

    suite("ExtractParameter", () => {

        test('StorageKind', async () => {
            const expected = {
                parameters: {
                    storageKind: {
                        type: "string",
                        defaultValue: "StorageV2",
                        metadata: {
                            description: "Kind of storage"
                        }
                    }
                },
                variables: {},
                resources: [
                    {
                        name: "[concat(resourceGroup().id, 'storageid', 123)]",
                        type: "Microsoft.Storage/storageAccounts",
                        apiVersion: "2019-06-01",
                        location: "[resourceGroup().location]",
                        kind: "[parameters('storageKind')]",
                        sku: {
                            name: "Premium_LRS"
                        }
                    }
                ]
            };
            await runExtractParameterTest(baseTemplate, "StorageV2", ["storageKind", "Kind of storage"], 2, expected);
        });

        suite("Extract to location parameter", () => {
            const expected = {
                parameters: {
                    location: {
                        type: "string",
                        defaultValue: "[resourceGroup().location]",
                        metadata: {
                            description: "Location of resource"
                        }
                    }
                },
                variables: {},
                resources: [
                    {
                        name: "[concat(resourceGroup().id, 'storageid', 123)]",
                        type: "Microsoft.Storage/storageAccounts",
                        apiVersion: "2019-06-01",
                        location: "[parameters('location')]",
                        kind: "StorageV2",
                        sku: {
                            name: "Premium_LRS"
                        }
                    }
                ]
            };
            test('full expression with square brackets', async () => {
                await runExtractParameterTest(baseTemplate, "[resourceGroup().location]", ["location", "Location of resource"], 2, expected);
            });
            test('full expression without square brackets', async () => {
                await runExtractParameterTest(baseTemplate, "resourceGroup().location", ["location", "Location of resource"], 2, expected);
            });
        });

        suite("Don't extract variable or parameter references", () => {
            const template = {
                resources: [
                    {
                        name: "[concat(resourceGroup().id, 'storageid', 123)]",
                        type: "Microsoft.Storage/storageAccounts",
                        apiVersion: "2019-06-01",
                        location: "[parameters('location')]",
                        kind: "StorageV2",
                        sku: {
                            name: "Premium_LRS"
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
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "2019-06-01"
                        }
                    ]
                },
                "2019-06-01",
                ["p1", "description"],
                2,
                {
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "[parameters('p1')]"
                        }
                    ],
                    parameters: {
                        p1: {
                            type: "string",
                            defaultValue: "2019-06-01",
                            metadata: {
                                description: "description"
                            }
                        }
                    }
                }
            );
        });

        test('One existing param', async () => {
            await runExtractParameterTest(
                {
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "2019-06-01"
                        }
                    ],
                    parameters: {
                        p1: {
                            type: "string"
                        }
                    }
                },
                "2019-06-01",
                ["p2", "description"],
                2,
                {
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "[parameters('p2')]"
                        }
                    ],
                    parameters: {
                        p1: {
                            type: "string"
                        },
                        p2: {
                            type: "string",
                            defaultValue: "2019-06-01",
                            metadata: {
                                description: "description"
                            }
                        }
                    }
                }
            );
        });

        test('ENTER for no description', async () => {
            await runExtractParameterTest(
                {
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "2019-06-01"
                        }
                    ],
                    parameters: {
                        p1: {
                            type: "string"
                        }
                    }
                },
                "2019-06-01",
                ["p2", ""],
                2,
                {
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "[parameters('p2')]"
                        }
                    ],
                    parameters: {
                        p1: {
                            type: "string"
                        },
                        p2: {
                            type: "string",
                            defaultValue: "2019-06-01"
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
                parameters: {},
                variables: {
                    storageKind: "StorageV2"
                },
                resources: [
                    {
                        name: "[concat(resourceGroup().id, 'storageid', 123)]",
                        type: "Microsoft.Storage/storageAccounts",
                        apiVersion: "2019-06-01",
                        location: "[resourceGroup().location]",
                        kind: "[variables('storageKind')]",
                        sku: {
                            name: "Premium_LRS"
                        }
                    }
                ]
            };
            await runExtractVariableTest(baseTemplate, "StorageV2", ["storageKind"], 2, expected);
        });

        suite("Extract to location variable", () => {

            const expected = {
                parameters: {},
                variables: {
                    location: "[resourceGroup().location]"
                },
                resources: [
                    {
                        name: "[concat(resourceGroup().id, 'storageid', 123)]",
                        type: "Microsoft.Storage/storageAccounts",
                        apiVersion: "2019-06-01",
                        location: "[variables('location')]",
                        kind: "StorageV2",
                        sku: {
                            name: "Premium_LRS"
                        }
                    }
                ]
            };
            test('full expression with square brackets', async () => {
                await runExtractVariableTest(baseTemplate, "[resourceGroup().location]", ["location"], 2, expected);
            });
            test('full expression without square brackets', async () => {
                await runExtractVariableTest(baseTemplate, "resourceGroup().location", ["location"], 2, expected);
            });
        });

        suite("Don't extract variable or parameter references", () => {
            const baseTemplate2 = {
                parameters: {},
                variables: {
                    location: "[resourceGroup().location]"
                },
                resources: [
                    {
                        name: "[concat(resourceGroup().id, 'storageid', 123)]",
                        type: "Microsoft.Storage/storageAccounts",
                        apiVersion: "2019-06-01",
                        location: "[variables('location')]",
                        kind: "StorageV2",
                        sku: {
                            name: "Premium_LRS"
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
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "2019-06-01"
                        }
                    ]
                },
                "2019-06-01",
                ["v1"],
                2,
                {
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "[variables('v1')]"
                        }
                    ],
                    variables: {
                        v1: "2019-06-01"
                    }
                }
            );
        });

        test('One existing var', async () => {
            await runExtractVariableTest(
                {
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "2019-06-01"
                        }
                    ],
                    variables: {
                        v1: "v1"
                    }
                },
                "2019-06-01",
                ["v2"],
                2,
                {
                    resources: [
                        {
                            name: "[concat(resourceGroup().id, 'storageid', 123)]",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "[variables('v2')]"
                        }
                    ],
                    variables: {
                        v1: "v1",
                        v2: "2019-06-01"
                    }
                }
            );
        });
    });

    test("Don't allow from inside a property name", async () => {
        await runExtractVariableTest(
            {
                resources: [
                    {
                        name: "[concat(resourceGroup().id, 'storageid', 123)]",
                        type: "Microsoft.Storage/storageAccounts",
                        apiVersion: "2019-06-01"
                    }
                ]
            },
            "name",
            [],
            0
        );
    });

    suite("Don't allow outside of 'resources'", async () => {
        test("in variables", async () => {
            await runExtractVariableTest(
                {
                    variables:
                    {
                        name: "[concat(resourceGroup().id, 'storageid', 123)]",
                        type: "Microsoft.Storage/storageAccounts",
                        apiVersion: "2019-06-01"
                    }
                },
                "2019-06-01",
                [],
                0
            );
        });

        test("in parameters", async () => {
            await runExtractVariableTest(
                {
                    parameters: {
                        location: {
                            type: "string",
                            defaultValue: "abc",
                            metadata: {
                                description: "Location of resource"
                            }
                        }
                    },
                },
                "abc",
                [],
                0
            );
        });

        test("in user-functions", async () => {
            await runExtractVariableTest(
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    functions: [
                        {
                            namespace: "udf",
                            members: {
                                storageUri: {
                                    parameters: [
                                        {
                                            name: "storageAccountName",
                                            type: "string"
                                        }
                                    ],
                                    output: {
                                        type: "string",
                                        value: "my value"
                                    }
                                }
                            }
                        }
                    ]
                },
                "my value",
                [],
                0
            );
        });
    });

    //////////// Expressions

    suite("Extract within expressions", async () => {
        async function runExtractFromExpressionTest(expression: string, selectedText: string, expectedVarValue?: string, expectedExpression?: string): Promise<void> {
            if (expectedVarValue && expectedExpression) {
                // Expecting successful extraction
                await runExtractVariableTest(
                    {
                        resources: [
                            {
                                property: expression
                            }
                        ]
                    },
                    selectedText,
                    ["v1"],
                    2,
                    {
                        resources: [
                            {
                                property: expectedExpression
                            }
                        ],
                        variables: {
                            v1: expectedVarValue
                        }
                    }
                );
            } else {
                // Expecting no code actions offered for extraction
                await runExtractVariableTest(
                    {
                        resources: [
                            {
                                property: expression
                            }
                        ]
                    },
                    selectedText,
                    [],
                    0
                );
            }
        }

        suite("String literals", () => {

            test("without single quotes", async () => {
                await runExtractFromExpressionTest(`[concat('abc', 'def')]`, `abc`, `abc`, `[concat(variables('v1'), 'def')]`);
            });

            test("with single quotes", async () => {
                await runExtractFromExpressionTest(`[concat('abc', 'def')]`, `'abc'`, `abc`, `[concat(variables('v1'), 'def')]`);
            });

            /*TODO: P2
            test("empty", async () => {
                await runExtractFromExpressionTest(`[concat('', 'def')]`, `''`, `abc`, `[concat(variables('v1'), 'def')]`);
            });*/

            /*TODO: P2
            suite("string literal with escaped single quotes - escaped single quotes should removed in variable definition", async () => {
                test("one escaped", async () => {
                    await runExtractFromExpressionTest(`[concat('That''s fine', 'def')]`, `'That''s fine'`, `That's fine`, `[concat(variables('v1'), 'def')]`);
                });

                test("two escaped", async () => {
                    await runExtractFromExpressionTest(`[concat('That ''is'' fine', 'def')]`, `'That ''is'' fine'`, `That 'is' fine`, `[concat(variables('v1'), 'def')]`);
                });

                test("two sequential", async () => {
                    await runExtractFromExpressionTest(`[concat('That '''' fine', 'def')]`, `'That '''' fine'`, `That '' fine`, `[concat(variables('v1'), 'def')]`);
                });
            });
            */

            test("copyIndex(1)", async () => {
                await runExtractFromExpressionTest(`[concat(parameters('vmName'),'pip',copyIndex(1))]`, `copyIndex(1)`, `[copyIndex(1)]`, `[concat(parameters('vmName'),'pip',variables('v1'))]`);
            });

            /*TODO: P2 failing
            test("copyIndex(1)) - invalid", async () => {
                await runExtractFromExpressionTest(`[concat(parameters('vmName'),'pip',copyIndex(1))]`, `copyIndex(1))`);
            });*/

            test("int literal - invalid", async () => {
                await runExtractFromExpressionTest(`[concat(parameters('vmName'),'pip',copyIndex(1))]`, `1`);
            });

            test("resourceGroup() from property access chain", async () => {
                await runExtractFromExpressionTest(`[resourceGroup().location]`, `resourceGroup()`, `[resourceGroup()]`, `[variables('v1').location]`);
            });

            test("user-defined function #1", async () => {
                await runExtractFromExpressionTest(`[concat(ns.udf1('a'), ns.udf2(ns.udf3()))]`, `ns.udf3()`, `[ns.udf3()]`, `[concat(ns.udf1('a'), ns.udf2(variables('v1')))]`);
            });

            test("user-defined function #2", async () => {
                await runExtractFromExpressionTest(
                    `[concat(ns.udf1('a'), ns.udf2(ns.udf3()))]`,
                    `ns.udf2(ns.udf3())`,
                    `[ns.udf2(ns.udf3())]`,
                    `[concat(ns.udf1('a'), variables('v1'))]`
                );
            });
        });
    });

    suite("Nested templates", async () => {
        test("Inner-scoped nested template", async () => {
            await runExtractVariableTest(
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                        {
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2017-05-10",
                            properties: {
                                expressionEvaluationOptions: {
                                    scope: "inner"
                                },
                                template: {
                                    resources: [
                                        {
                                            name: "storageaccount1",
                                            type: "Microsoft.Storage/storageAccounts",
                                            apiVersion: "2019-06-01",
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                },
                "2019-06-01",
                ["v1"],
                2,
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                        {
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2017-05-10",
                            properties: {
                                expressionEvaluationOptions: {
                                    scope: "inner"
                                },
                                template: {
                                    resources: [
                                        {
                                            name: "storageaccount1",
                                            type: "Microsoft.Storage/storageAccounts",
                                            apiVersion: "[variables('v1')]",
                                        }
                                    ],
                                    variables: {
                                        v1: "2019-06-01"
                                    }
                                }
                            }
                        }
                    ]
                }
            );
        });

        test("Outer-scoped nested template", async () => {
            await runExtractParameterTest(
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                        {
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2017-05-10",
                            properties: {
                                expressionEvaluationOptions: {
                                    scope: "outer"
                                },
                                template: {
                                    resources: [
                                        {
                                            name: "storageaccount1",
                                            type: "Microsoft.Storage/storageAccounts",
                                            apiVersion: "2019-06-01",
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                },
                "2019-06-01",
                ["p1", ""],
                2,
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                        {
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2017-05-10",
                            properties: {
                                expressionEvaluationOptions: {
                                    scope: "outer"
                                },
                                template: {
                                    resources: [
                                        {
                                            name: "storageaccount1",
                                            type: "Microsoft.Storage/storageAccounts",
                                            apiVersion: "[parameters('p1')]"
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    parameters: {
                        p1: {
                            type: "string",
                            defaultValue: "2019-06-01"
                        }
                    }
                }
            );
        });

        test("Deeply-nested outer-scoped templates", async () => {
            await runExtractVariableTest(
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                        {
                            name: "inner1",
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2019-10-01",
                            properties: {
                                expressionEvaluationOptions: {
                                    scope: "inner"
                                },
                                mode: "Incremental",
                                template: {
                                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                    contentVersion: "1.0.0.0",
                                    resources: [
                                        {
                                            name: "outer2",
                                            type: "Microsoft.Resources/deployments",
                                            apiVersion: "2019-10-01",
                                            properties: {
                                                expressionEvaluationOptions: {
                                                    scope: "outer"
                                                },
                                                mode: "Incremental",
                                                template: {
                                                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                                    contentVersion: "1.0.0.0",
                                                    resources: [
                                                        {
                                                            name: "outer3",
                                                            type: "Microsoft.Resources/deployments",
                                                            apiVersion: "2019-10-01",
                                                            properties: {
                                                                expressionEvaluationOptions: {
                                                                    scope: "outer"
                                                                },
                                                                mode: "Incremental",
                                                                template: {
                                                                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                                                    contentVersion: "1.0.0.0",
                                                                    resources: [
                                                                        {
                                                                            name: "outer4",
                                                                            type: "Microsoft.Resources/deployments",
                                                                            apiVersion: "2019-10-01",
                                                                            properties: {
                                                                                expressionEvaluationOptions: {
                                                                                    scope: "outer"
                                                                                },
                                                                                mode: "Incremental",
                                                                                template: {
                                                                                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                                                                    contentVersion: "1.0.0.0",
                                                                                    resources: [
                                                                                        {
                                                                                            name: "storageaccount1",
                                                                                            type: "Microsoft.Storage/storageAccounts",
                                                                                            apiVersion: "2019-06-01",
                                                                                            tags: {
                                                                                                displayName: "storageaccount1"
                                                                                            },
                                                                                            location: "[resourceGroup().location]",
                                                                                            kind: "StorageV2",
                                                                                            sku: {
                                                                                                name: "Premium_LRS",
                                                                                                tier: "Premium"
                                                                                            }
                                                                                        }
                                                                                    ]
                                                                                }
                                                                            }
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                },
                "Premium_LRS",
                ["v1"],
                2,
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                        {
                            name: "inner1",
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2019-10-01",
                            properties: {
                                expressionEvaluationOptions: {
                                    scope: "inner"
                                },
                                mode: "Incremental",
                                template: {
                                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                    contentVersion: "1.0.0.0",
                                    resources: [
                                        {
                                            name: "outer2",
                                            type: "Microsoft.Resources/deployments",
                                            apiVersion: "2019-10-01",
                                            properties: {
                                                expressionEvaluationOptions: {
                                                    scope: "outer"
                                                },
                                                mode: "Incremental",
                                                template: {
                                                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                                    contentVersion: "1.0.0.0",
                                                    resources: [
                                                        {
                                                            name: "outer3",
                                                            type: "Microsoft.Resources/deployments",
                                                            apiVersion: "2019-10-01",
                                                            properties: {
                                                                expressionEvaluationOptions: {
                                                                    scope: "outer"
                                                                },
                                                                mode: "Incremental",
                                                                template: {
                                                                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                                                    contentVersion: "1.0.0.0",
                                                                    resources: [
                                                                        {
                                                                            name: "outer4",
                                                                            type: "Microsoft.Resources/deployments",
                                                                            apiVersion: "2019-10-01",
                                                                            properties: {
                                                                                expressionEvaluationOptions: {
                                                                                    scope: "outer"
                                                                                },
                                                                                mode: "Incremental",
                                                                                template: {
                                                                                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                                                                    contentVersion: "1.0.0.0",
                                                                                    resources: [
                                                                                        {
                                                                                            name: "storageaccount1",
                                                                                            type: "Microsoft.Storage/storageAccounts",
                                                                                            apiVersion: "2019-06-01",
                                                                                            tags: {
                                                                                                displayName: "storageaccount1"
                                                                                            },
                                                                                            location: "[resourceGroup().location]",
                                                                                            kind: "StorageV2",
                                                                                            sku: {
                                                                                                name: "[variables('v1')]",
                                                                                                tier: "Premium"
                                                                                            }
                                                                                        }
                                                                                    ]
                                                                                }
                                                                            }
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    ],
                                    variables: {
                                        v1: "Premium_LRS"
                                    }
                                }
                            }
                        }
                    ]
                }
            );
        });

        test("Don't allow in nested template if outside resources", async () => {
            await runExtractParameterTest(
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                        {
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2017-05-10",
                            properties: {
                                template: {
                                    resources: [
                                        {
                                            name: "storageaccount1",
                                            type: "Microsoft.Storage/storageAccounts",
                                            apiVersion: "2019-06-01",
                                        }
                                    ],
                                    variables: {
                                        v1: "my value"
                                    }
                                }
                            }
                        }
                    ]
                },
                "my value",
                [],
                0
            );
        });
    });

    suite("arrays", async () => {
        test("tags", async () => {
            await runExtractVariableTest(
                {
                    resources: [
                        {
                            name: "storageaccount1",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "2019-06-01",
                            tags: {
                                displayName: "storageaccount1DispayName"
                            },
                            location: "[resourceGroup().location]",
                            kind: "StorageV2",
                            sku: {
                                name: "Premium_LRS",
                                tier: "Premium"
                            }
                        }
                    ]
                },
                "storageaccount1DispayName",
                ["v1"],
                2,
                {
                    resources: [
                        {
                            name: "storageaccount1",
                            type: "Microsoft.Storage/storageAccounts",
                            apiVersion: "2019-06-01",
                            tags: {
                                displayName: "[variables('v1')]"
                            },
                            location: "[resourceGroup().location]",
                            kind: "StorageV2",
                            sku: {
                                name: "Premium_LRS",
                                tier: "Premium"
                            }
                        }
                    ],
                    variables: {
                        v1: "storageaccount1DispayName"
                    }
                }
            );
        });

        test("dependsOn array", async () => {
            await runExtractVariableTest(
                {
                    resources: [
                        {
                            type: "firewallRules",
                            apiVersion: "2018-06-01-preview",
                            name: "AllowAllWindowsAzureIps",
                            dependsOn: [
                                "abc"
                            ]
                        },
                    ]
                },
                "abc",
                ["v1"],
                2,
                {
                    resources: [
                        {
                            type: "firewallRules",
                            apiVersion: "2018-06-01-preview",
                            name: "AllowAllWindowsAzureIps",
                            dependsOn: [
                                "[variables('v1')]"
                            ]
                        },
                    ],
                    variables: {
                        v1: "abc"
                    }
                }
            );
        });
    });

    /* TODO: ?
    suite("Don't allow for multi-line strings", async () => {
        test('Simple multi-line string', async () => {
            await runExtractVariableTest(
                `{
    "resources": [
        {
            "name": "storageaccount1",
            "type": "Microsoft.Storage/storageAccounts",
            "whatever": "This is a
multi-line
string"
        }
    ]
}`,
                `This is a
multi-line
string`,
                ["v1"],
                2,
                // NOTE: Ideally we wouldn't replace newlines with \n, but this is acceptable
                {
                    "resources": [
                        {
                            "name": "storageaccount1",
                            "type": "Microsoft.Storage/storageAccounts",
                            "whatever": "[variables('v1')]"
                        }
                    ],
                    "variables": {
                        "v1": "This is a\nmulti-line\nstring"
                    }
                }
            );
        });

        test("Multi-line expressions", async () => {
            await runExtractVariableTest(
                `{
    "resources": [
        {
            "name": "storageaccount1",
            "type": "Microsoft.Storage/storageAccounts",
            "whatever": "[concat('This is a
multi-line
string', 'This is
another')]"
        }
    ]
}`,
                `'This is
another'`,
                ["v1"],
                2,
                // NOTE: Ideally we wouldn't replace newlines with \n, but this is acceptable
                `{
                    "resources": [
                        {
                            "name": "storageaccount1",
                            "type": "Microsoft.Storage/storageAccounts",
                            "whatever": "[concat('This is a
multi-line
string', variables('v1'))]"
                        }
                    ],
                    "variables": {
                        "v1": "This is a\nanother"
                    }
                }`
            );
        });

    }); */

});
