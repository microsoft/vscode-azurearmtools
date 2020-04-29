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
import { DISABLE_SLOW_TESTS } from '../testConstants';

suite("SortTemplate", async (): Promise<void> => {
    const topLevelCommand = 'azurerm-vscode-tools.sortTopLevel';
    const parameterCommand = 'azurerm-vscode-tools.sortParameters';
    const variablesCommand = 'azurerm-vscode-tools.sortVariables';
    const resourcesCommand = 'azurerm-vscode-tools.sortResources';
    const outputsCommand = 'azurerm-vscode-tools.sortOutputs';
    const functionsCommand = 'azurerm-vscode-tools.sortFunctions';

    if (DISABLE_SLOW_TESTS) {
        return;
    }

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
            parameterCommand,
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
            parameterCommand,
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

    test("Parameters with multiple comments", async () => {
        await testSortTemplate(
            parameterCommand,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    //Comment for parameter 2.1
                    /* Comment for parameter 2.2 */
                    //Comment for parameter 2.3
                    "parameter2": {
                       "type": "string"
                    },
                    /* Comment for parameter 1.1 */
                    //Comment for parameter 1.2
                    //Comment for parameter 1.3
                    "parameter1": {
                       "type": "string"
                    }
                    //Comment that should not be sorted
                }
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    /* Comment for parameter 1.1 */
                    //Comment for parameter 1.2
                    //Comment for parameter 1.3
                    "parameter1": {
                       "type": "string"
                    },
                    //Comment for parameter 2.1
                    /* Comment for parameter 2.2 */
                    //Comment for parameter 2.3
                    "parameter2": {
                       "type": "string"
                    }
                    //Comment that should not be sorted
                }
            }`);
    });

    test("Variables", async () => {
        await testSortTemplate(
            variablesCommand,
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

    test("Variables with multi line comments", async () => {
        await testSortTemplate(
            variablesCommand,
            `{
                "variables": {
                    /* Multi
                    line comment 2*/
                    "variable2": "value2",
                    /* Multi
                    line comment 1*/
                    "variable1": "value1"
                }
            }`,
            `{
                "variables": {
                    /* Multi
                    line comment 1*/
                    "variable1": "value1",
                    /* Multi
                    line comment 2*/
                    "variable2": "value2"
                }
            }`);
    });

    test("Resources", async () => {
        await testSortTemplate(
            resourcesCommand,
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
            resourcesCommand,
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

    test("Resources with multiple lines", async () => {
        await testSortTemplate(
            resourcesCommand,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [
                    {
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion":"2019-06-01",
                        "name": "[concat(
                            'String 2',
                            'String 1')]"
                    },
                    {
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion":"2019-06-01",
                        "name": "[concat(
                            'String 1',
                            'String 2')]"
                    }
                ]
            }`,
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [
                    {
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion":"2019-06-01",
                        "name": "[concat(
                            'String 1',
                            'String 2')]"
                    },
                    {
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion":"2019-06-01",
                        "name": "[concat(
                            'String 2',
                            'String 1')]"
                    }
                ]
            }`);
    });

    test("Outputs", async () => {
        await testSortTemplate(
            outputsCommand,
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
            functionsCommand,
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
            functionsCommand,
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
            topLevelCommand,
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

    const emptyTemplate: string = `{
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0"
    }`;

    test("Sort empty template (top level)", async () => {
        await testSortTemplate(topLevelCommand, emptyTemplate, emptyTemplate);
    });

    test("Sort empty template (parameters)", async () => {
        await testSortTemplate(parameterCommand, emptyTemplate, emptyTemplate);
    });

    test("Sort empty template (variables)", async () => {
        await testSortTemplate(variablesCommand, emptyTemplate, emptyTemplate);
    });

    test("Sort empty template (resources)", async () => {
        await testSortTemplate(resourcesCommand, emptyTemplate, emptyTemplate);
    });

    test("Sort empty template (parameters)", async () => {
        await testSortTemplate(parameterCommand, emptyTemplate, emptyTemplate);
    });

    test("Sort empty template (outputs)", async () => {
        await testSortTemplate(outputsCommand, emptyTemplate, emptyTemplate);
    });

    test("Sort empty template (functions)", async () => {
        await testSortTemplate(functionsCommand, emptyTemplate, emptyTemplate);
    });
});
