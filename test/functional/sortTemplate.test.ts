// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
const DEBUG_BREAK_AFTER_INSERTING_SNIPPET = false;

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { commands, window, workspace } from "vscode";
import { getTempFilePath } from "../support/getTempFilePath";

suite("SortTemplate", async (): Promise<void> => {
    async function testSortTemplate(template: String, expected: String): Promise<void> {
        const tempPath = getTempFilePath(`sortTemplate`, '.azrm');

        fse.writeFileSync(tempPath, template);

        let doc = await workspace.openTextDocument(tempPath);
        await window.showTextDocument(doc);

        // SortTemplate
        await commands.executeCommand('azurerm-vscode-tools.sortTemplate', {});

        const docTextAfterInsertion = window.activeTextEditor!.document.getText();
        assert.deepStrictEqual(docTextAfterInsertion, expected);
    }

    test("Parameters", async () => {
        await testSortTemplate(
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

    test("Variables", async () => {
        await testSortTemplate(
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {"variable2": "value", "variable1": "value"}
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {"variable1": "value", "variable2": "value"}
            }`);
    });

    test("Resources", async () => {
        await testSortTemplate(
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [{ "name": "storageaccount2",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2015-06-15"
                },{ "name": "storageaccount1",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2015-06-15"
                }]
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [{ "name": "storageaccount1",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2015-06-15"
                },{ "name": "storageaccount2",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2015-06-15"
                }]
            }`);
    });

    test("Resources with child resources", async () => {
        await testSortTemplate(
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [{"name": "storageaccount2",
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2015-06-15",
                        "resources": [{"name": "storageaccount22",
                                "type": "Microsoft.Storage/storageAccounts",
                                "apiVersion": "2015-06-15"
                            },
                            {"name": "storageaccount21","type": "Microsoft.Storage/storageAccounts",
                                "apiVersion": "2015-06-15"
                            }
                        ]
                    },{"name": "storageaccount1","type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2015-06-15"
                    }
                ]
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [{"name": "storageaccount1","type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2015-06-15"
                    },{"name": "storageaccount2",
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2015-06-15",
                        "resources": [{"name": "storageaccount21","type": "Microsoft.Storage/storageAccounts",
                                "apiVersion": "2015-06-15"
                            },
                            {"name": "storageaccount22",
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
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "outputs": {"output2": {
                   "type": "string",
                   "value": "value"
                }, "output1": {
                   "type": "string",
                   "value": "value"
                }}
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "outputs": {"output1": {
                   "type": "string",
                   "value": "value"
                }, "output2": {
                   "type": "string",
                   "value": "value"
                }}
            }`);
    });

    test("Function namespaces", async () => {
        await testSortTemplate(
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [{
                    "namespace": "namespace2",
                    "members": {
                        "function": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                },
                {
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
                "functions": [{
                    "namespace": "namespace1",
                    "members": {
                        "function": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                },
                {
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
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [{
                    "namespace": "namespace2",
                    "members": {
                        "function2": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        },"function1": {"parameters": [],
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
                        "function1": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        },"function2": {"parameters": [],
                            "output": { "value": "Hello world", "type": "string" }
                        }
                    }
                }]
            }`);
    });

    test("Parameter file", async () => {
        await testSortTemplate(
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {"parameter2": {
                        "value": "Value2"
                    },"parameter1": { "value": "Value1"}
                }
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {"parameter1": { "value": "Value1"},"parameter2": {
                        "value": "Value2"
                    }
                }
            }`);
    });
});
