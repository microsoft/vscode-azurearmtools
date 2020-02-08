// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { commands, window, workspace } from "vscode";
import { getTempFilePath } from "../support/getTempFilePath";

suite("SortTemplate", async (): Promise<void> => {
    async function testSortTemplate(command: string, template: String, expected: String): Promise<void> {
        const tempPath = getTempFilePath(`sortTemplate`, '.azrm');

        fse.writeFileSync(tempPath, template);

        let doc = await workspace.openTextDocument(tempPath);
        await window.showTextDocument(doc);

        // SortTemplate
        await commands.executeCommand(command, {});

        const docTextAfterInsertion = window.activeTextEditor!.document.getText();
        assert.deepStrictEqual(docTextAfterInsertion, expected);
    }

    test("Parameters", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortParameters',
            `{
            "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "parameters": { "parameter2": {
               "type": "string"
            }, "parameter1": {
               "type": "string"
            }}
        }`,
            `{
            "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "parameters": { "parameter1": {
               "type": "string"
            }, "parameter2": {
               "type": "string"
            }}
        }`);
    });

    test("Parameters with comments", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortParameters',
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    //Comment for parameter 2
                    "parameter2": {
                       "type": "string"
                    },
                    //Comment for parameter 1
                    "parameter1": {
                       "type": "string"
                    }
                }
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    //Comment for parameter 1
                    "parameter1": {
                       "type": "string"
                    },
                    //Comment for parameter 2
                    "parameter2": {
                       "type": "string"
                    }
                }
            }`);
    });

    test("Variables", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortVariables',
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {/*v2*/"variable2": "value", /*v1*/"variable1": "value"}
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {/*v1*/"variable1": "value", /*v2*/"variable2": "value"}
            }`);
    });

    test("Resources", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortResources',
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [/*s2*/{ "name": "storageaccount2",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2015-06-15"
                },/*s1*/{ "name": "storageaccount1",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2015-06-15"
                }]
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [/*s1*/{ "name": "storageaccount1",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2015-06-15"
                },/*s2*/{ "name": "storageaccount2",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2015-06-15"
                }]
            }`);
    });

    test("Resources with child resources", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortResources',
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [/*s2*/{"name": "storageaccount2",
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2015-06-15",
                        "resources": [/*s22*/{"name": "storageaccount22",
                                "type": "Microsoft.Storage/storageAccounts",
                                "apiVersion": "2015-06-15"
                            },
                            /*s21*/{"name": "storageaccount21","type": "Microsoft.Storage/storageAccounts",
                                "apiVersion": "2015-06-15"
                            }
                        ]
                    },/*s1*/{"name": "storageaccount1","type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2015-06-15"
                    }
                ]
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [/*s1*/{"name": "storageaccount1","type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2015-06-15"
                    },/*s2*/{"name": "storageaccount2",
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2015-06-15",
                        "resources": [/*s21*/{"name": "storageaccount21","type": "Microsoft.Storage/storageAccounts",
                                "apiVersion": "2015-06-15"
                            },
                            /*s22*/{"name": "storageaccount22",
                                "type": "Microsoft.Storage/storageAccounts",
                                "apiVersion": "2015-06-15"
                            }
                        ]
                    }
                ]
            }`);
    });

    test("Outputs", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortOutputs',
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "outputs": {/*o2*/"output2": {
                   "type": "string",
                   "value": "value"
                }, /*o1*/"output1": {
                   "type": "string",
                   "value": "value"
                }}
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "outputs": {/*o1*/"output1": {
                   "type": "string",
                   "value": "value"
                }, /*o2*/"output2": {
                   "type": "string",
                   "value": "value"
                }}
            }`);
    });

    test("Function namespaces", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortFunctions',
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [/*ns2*/{
                    "namespace": "namespace2",
                    "members": {
                        "function": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                },
                /*ns1*/{
                    "namespace": "namespace1",
                    "members": {
                        "function": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                }]
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [/*ns1*/{
                    "namespace": "namespace1",
                    "members": {
                        "function": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                },
                /*ns2*/{
                    "namespace": "namespace2",
                    "members": {
                        "function": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                }]
            }`);
    });

    test("Functions inside namespace", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortFunctions',
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [{
                    "namespace": "namespace2",
                    "members": {
                        /*f2*/"function2": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        },/*f1*/"function1": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                }]
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [{
                    "namespace": "namespace2",
                    "members": {
                        /*f1*/"function1": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        },/*f2*/"function2": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                }]
            }`);
    });

    test("Top level properties", async () => {
        await testSortTemplate(
            'azurerm-vscode-tools.sortTopLevel',
            `{
                // Outputs
                "outputs": {},
                "apiProfile": "...",
                // Functions
                "functions": [],
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                // Variables
                "variables": {},
                "contentVersion": "1.0.0.0",
                // Resources
                "resources": [],
                "parameters": {}
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "apiProfile": "...",
                "parameters": {},
                // Functions
                "functions": [],
                // Variables
                "variables": {},
                // Resources
                "resources": [],
                // Outputs
                "outputs": {}
            }`);
    });
});
