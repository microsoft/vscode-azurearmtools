// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
const DEBUG_BREAK_AFTER_INSERTING_SNIPPET = false;

import * as assert from 'assert';
import { Context } from 'mocha';
import { Position, Selection } from "vscode";
import { ext } from "../../extension.bundle";
import { assertEx } from '../support/assertEx';
import { delay } from '../support/delay';
import { diagnosticSources, getDiagnosticsForDocument, IGetDiagnosticsOptions } from '../support/diagnostics';
import { formatDocumentAndWait } from '../support/formatDocumentAndWait';
import { parseTemplateWithMarkers } from '../support/parseTemplate';
import { removeApiVersions } from '../support/removeApiVersions';
import { simulateCompletion } from '../support/simulateCompletion';
import { TempDocument, TempEditor, TempFile } from '../support/TempFile';
import { writeToLog } from '../support/testLog';
import { testWithRealSnippets } from '../support/TestSnippets';
import { DEFAULT_TESTCASE_TIMEOUT_MS } from '../testConstants';

// This tests snippets in different locations, and also different methods of bringing up the snippet context menu (e.g. CTRL+SPACE, double quote etc)
suite("Contextualized snippets", () => {
    function createContextualizedSnippetTest(
        testName: string,
        snippetPrefix: string,
        triggerCharacters: (string | undefined)[],
        templateWithCursorMarker: string,
        expectedTemplate: string,
        expectedDiagnostics: string[]
    ): void {
        const testSources = [diagnosticSources.expressions];
        const timeout = DEFAULT_TESTCASE_TIMEOUT_MS;

        for (const triggerCharacter of triggerCharacters) {
            // tslint:disable-next-line: prefer-template
            const name = `${testName}, triggered by ${triggerCharacter ? ("'" + triggerCharacter + "'") : 'CTRL+SPACE'}`;
            // tslint:disable:no-function-expression
            testWithRealSnippets(name, async function (this: Context): Promise<void> {
                const start = Date.now();
                this.timeout(timeout);

                const { dt, markers: { cursor } } = parseTemplateWithMarkers(templateWithCursorMarker);
                assert(cursor !== undefined, "<!cursor!> not found in template");

                let tempFile: TempFile | undefined;
                let tempDoc: TempDocument | undefined;
                let tempEditor: TempEditor | undefined;

                try {
                    tempFile = TempFile.fromContents(dt.documentText, `${testName}.${snippetPrefix}`, '.json');
                    tempDoc = new TempDocument(tempFile);
                    await tempDoc.open();
                    tempEditor = new TempEditor(tempDoc);
                    await tempEditor.open();

                    // Wait for first set of diagnostics to finish.
                    const diagnosticOptions: IGetDiagnosticsOptions = {
                        includeSources: testSources
                    };
                    let diagnosticResults = await getDiagnosticsForDocument(tempDoc.realDocument, 1, diagnosticOptions);

                    // Insert snippet (and wait for and verify diagnostics)
                    const docPos = dt.getDocumentPosition(cursor.index);
                    const pos = new Position(docPos.line, docPos.line);

                    writeToLog(`Document before inserting snippet:\n${tempEditor.document.realDocument.getText()}`);

                    tempEditor.realEditor.selection = new Selection(pos, pos);
                    await delay(1);
                    await simulateCompletion(
                        tempEditor.realEditor,
                        snippetPrefix,
                        triggerCharacter
                    );

                    // Wait until the current document has template graph info assigned
                    // tslint:disable-next-line: no-constant-condition
                    while (true) {
                        if (Date.now() > start + timeout) {
                            throw new Error("Timeout");
                        }
                        const openDoc = ext.provideOpenedDocuments?.getOpenedDeploymentTemplate(tempEditor.realEditor.document.uri);
                        if (openDoc && openDoc.templateGraph) {
                            break;
                        }
                        await delay(1);
                    }

                    // Wait for final diagnostics but don't compare until we've compared the expected text first
                    diagnosticResults = await getDiagnosticsForDocument(tempEditor.realEditor.document, 2, diagnosticOptions, diagnosticResults);
                    const messages = diagnosticResults.diagnostics.map(d => d.message).sort();

                    if (DEBUG_BREAK_AFTER_INSERTING_SNIPPET) {
                        // tslint:disable-next-line: no-debugger
                        debugger;
                    }

                    // Format (vscode seems to be inconsistent about this in these scenarios)
                    let docTextAfterInsertion = await formatDocumentAndWait(tempDoc.realDocument);
                    writeToLog(`Document after inserting snippet:\n${docTextAfterInsertion}`);

                    expectedTemplate = removeApiVersions(expectedTemplate);
                    docTextAfterInsertion = removeApiVersions(docTextAfterInsertion);

                    assert.strictEqual(docTextAfterInsertion, expectedTemplate);

                    // Compare diagnostics

                    assertEx.arraysEqual(messages, expectedDiagnostics, {}, "Diagnostics comparison failed");
                } finally {
                    await tempEditor?.dispose();
                    await tempDoc?.dispose();
                    tempFile?.dispose();
                }
            });
        }
    }

    suite("top level", () => {
        createContextualizedSnippetTest(
            "top-level param",
            "new-parameter",
            [undefined, '"'],
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "parameters": {
        <!cursor!>
    },
    "contentVersion": "1.0.0.0",
    "resources": []
}`,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "parameters": {
        "parameter1": {
            "type": "string",
            "metadata": {
                "description": "description"
            }
        }
    },
    "contentVersion": "1.0.0.0",
    "resources": []
}`,
            [
                "The parameter 'parameter1' is never used."
            ]
        );

        createContextualizedSnippetTest(
            "top-level variable",
            "new-variable",
            [undefined, '"'],
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "variables": {
        <!cursor!>
    },
    "contentVersion": "1.0.0.0",
    "resources": []
}`,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "variables": {
        "variable1": "value"
    },
    "contentVersion": "1.0.0.0",
    "resources": []
}`,
            [
                "The variable 'variable1' is never used."
            ]
        );

        createContextualizedSnippetTest(
            "top-level output",
            "new-output",
            [undefined, '"'],
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
    ],
    "outputs": {
        <!cursor!>
    }
}`,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
    ],
    "outputs": {
        "output1": {
            "type": "string",
            "value": "value"
        }
    }
}`,
            [
            ]
        );

        suite("User functions", () => {

            createContextualizedSnippetTest(
                "top-level user function namespace",
                "new-userfunc-namespace",
                [undefined, '{'],
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
    ],
    "functions": [
        <!cursor!>
    ]
}`,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
    ],
    "functions": [
        {
            "namespace": "namespacename",
            "members": {
                "functionname": {
                    "parameters": [
                        {
                            "name": "parametername",
                            "type": "string"
                        }
                    ],
                    "output": {
                        "value": "function-return-value",
                        "type": "string"
                    }
                }
            }
        }
    ]
}`,
                [
                    "The user-defined function 'namespacename.functionname' is never used.",
                    "User-function parameter 'parametername' is never used."
                ]
            );

            createContextualizedSnippetTest(
                "top-level user function",
                "new-user-function",
                [undefined, '"'],
                `{
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [
                ],
                "functions": [
                    {
                        "namespace": "namespacename",
                        "members": {
                            "existingfunction": {
                                "parameters": [
                                    {
                                        "name": "parametername",
                                        "type": "string"
                                    }
                                ],
                                "output": {
                                    "value": "function-return-value",
                                    "type": "string"
                                }
                            },
                            <!cursor!>
                        }
                    }
                ]
            }`,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
    ],
    "functions": [
        {
            "namespace": "namespacename",
            "members": {
                "existingfunction": {
                    "parameters": [
                        {
                            "name": "parametername",
                            "type": "string"
                        }
                    ],
                    "output": {
                        "value": "function-return-value",
                        "type": "string"
                    }
                },
                "functionname": {
                    "parameters": [
                        {
                            "name": "parametername",
                            "type": "string"
                        }
                    ],
                    "output": {
                        "value": "function-return-value",
                        "type": "string"
                    }
                }
            }
        }
    ]
}`,
                [
                    "The user-defined function 'namespacename.existingfunction' is never used.",
                    "The user-defined function 'namespacename.functionname' is never used.",
                    "User-function parameter 'parametername' is never used.",
                    "User-function parameter 'parametername' is never used."
                ]
            );

            createContextualizedSnippetTest(
                "User function parameters",
                "new-userfunc-parameter",
                [undefined, '{'],
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [],
    "functions": [
        {
            "namespace": "namespacename",
            "members": {
                "functionname": {
                    "parameters": [
                        {
                            "name": "parametername",
                            "type": "string"
                        },
                        <!cursor!>
                    ],
                    "output": {
                        "value": "function-return-value",
                        "type": "string"
                    }
                }
            }
        }
    ]
}`,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [],
    "functions": [
        {
            "namespace": "namespacename",
            "members": {
                "functionname": {
                    "parameters": [
                        {
                            "name": "parametername",
                            "type": "string"
                        },
                        {
                            "name": "parameter1",
                            "type": "string"
                        }
                    ],
                    "output": {
                        "value": "function-return-value",
                        "type": "string"
                    }
                }
            }
        }
    ]
}`,
                [
                    "The user-defined function 'namespacename.functionname' is never used.",
                    "User-function parameter 'parameter1' is never used.",
                    "User-function parameter 'parametername' is never used."
                ]
            );

        });

        suite("resources", () => {
            createContextualizedSnippetTest(
                "top-level resource",
                "arm-web-app",
                [undefined, '{'],
                `{
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [
                    <!cursor!>
                ]
            }`,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "webApp1",
            "type": "Microsoft.Web/sites",
            "apiVersion": "xxxx-xx-xx",
            "location": "[resourceGroup().location]",
            "tags": {
                "[concat('hidden-related:', resourceGroup().id, '/providers/Microsoft.Web/serverfarms/appServicePlan1')]": "Resource",
                "displayName": "webApp1"
            },
            "dependsOn": [
                "[resourceId('Microsoft.Web/serverfarms', 'appServicePlan1')]"
            ],
            "properties": {
                "name": "webApp1",
                "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', 'appServicePlan1')]"
            }
        }
    ]
}`,
                [
                ]
            );

            createContextualizedSnippetTest(
                "top-level - multiple resources in one snippet",
                "arm-vm-ubuntu",
                [undefined, '{'],
                `{
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [
                    <!cursor!>
                ]
            }`,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "[toLower('ubuntuVM1storage')]",
            "type": "Microsoft.Storage/storageAccounts",
            "apiVersion": "xxxx-xx-xx",
            "location": "[resourceGroup().location]",
            "tags": {
                "displayName": "ubuntuVM1 Storage Account"
            },
            "sku": {
                "name": "Standard_LRS"
            },
            "kind": "Storage"
        },
        {
            "name": "ubuntuVM1-PublicIP",
            "type": "Microsoft.Network/publicIPAddresses",
            "apiVersion": "xxxx-xx-xx",
            "location": "[resourceGroup().location]",
            "tags": {
                "displayName": "PublicIPAddress"
            },
            "properties": {
                "publicIPAllocationMethod": "Dynamic",
                "dnsSettings": {
                    "domainNameLabel": "[toLower('ubuntuVM1')]"
                }
            }
        },
        {
            "name": "ubuntuVM1-nsg",
            "type": "Microsoft.Network/networkSecurityGroups",
            "apiVersion": "xxxx-xx-xx",
            "location": "[resourceGroup().location]",
            "properties": {
                "securityRules": [
                    {
                        "name": "nsgRule1",
                        "properties": {
                            "description": "description",
                            "protocol": "Tcp",
                            "sourcePortRange": "*",
                            "destinationPortRange": "22",
                            "sourceAddressPrefix": "*",
                            "destinationAddressPrefix": "*",
                            "access": "Allow",
                            "priority": 100,
                            "direction": "Inbound"
                        }
                    }
                ]
            }
        },
        {
            "name": "ubuntuVM1-VirtualNetwork",
            "type": "Microsoft.Network/virtualNetworks",
            "apiVersion": "xxxx-xx-xx",
            "location": "[resourceGroup().location]",
            "dependsOn": [
                "[resourceId('Microsoft.Network/networkSecurityGroups', 'ubuntuVM1-nsg')]"
            ],
            "tags": {
                "displayName": "ubuntuVM1-VirtualNetwork"
            },
            "properties": {
                "addressSpace": {
                    "addressPrefixes": [
                        "10.0.0.0/16"
                    ]
                },
                "subnets": [
                    {
                        "name": "ubuntuVM1-VirtualNetwork-Subnet",
                        "properties": {
                            "addressPrefix": "10.0.0.0/24",
                            "networkSecurityGroup": {
                                "id": "[resourceId('Microsoft.Network/networkSecurityGroups', 'ubuntuVM1-nsg')]"
                            }
                        }
                    }
                ]
            }
        },
        {
            "name": "ubuntuVM1-NetworkInterface",
            "type": "Microsoft.Network/networkInterfaces",
            "apiVersion": "xxxx-xx-xx",
            "location": "[resourceGroup().location]",
            "dependsOn": [
                "[resourceId('Microsoft.Network/publicIPAddresses', 'ubuntuVM1-PublicIP')]",
                "[resourceId('Microsoft.Network/virtualNetworks', 'ubuntuVM1-VirtualNetwork')]"
            ],
            "tags": {
                "displayName": "ubuntuVM1-NetworkInterface"
            },
            "properties": {
                "ipConfigurations": [
                    {
                        "name": "ipConfig1",
                        "properties": {
                            "privateIPAllocationMethod": "Dynamic",
                            "publicIPAddress": {
                                "id": "[resourceId('Microsoft.Network/publicIPAddresses', 'ubuntuVM1-PublicIP')]"
                            },
                            "subnet": {
                                "id": "[resourceId('Microsoft.Network/virtualNetworks/subnets', 'ubuntuVM1-VirtualNetwork', 'ubuntuVM1-VirtualNetwork-Subnet')]"
                            }
                        }
                    }
                ]
            }
        },
        {
            "name": "ubuntuVM1",
            "type": "Microsoft.Compute/virtualMachines",
            "apiVersion": "xxxx-xx-xx",
            "location": "[resourceGroup().location]",
            "dependsOn": [
                "[resourceId('Microsoft.Network/networkInterfaces', 'ubuntuVM1-NetworkInterface')]"
            ],
            "tags": {
                "displayName": "ubuntuVM1"
            },
            "properties": {
                "hardwareProfile": {
                    "vmSize": "Standard_A2_v2"
                },
                "osProfile": {
                    "computerName": "ubuntuVM1",
                    "adminUsername": "adminUsername",
                    "adminPassword": "adminPassword"
                },
                "storageProfile": {
                    "imageReference": {
                        "publisher": "Canonical",
                        "offer": "UbuntuServer",
                        "sku": "16.04-LTS",
                        "version": "latest"
                    },
                    "osDisk": {
                        "name": "ubuntuVM1-OSDisk",
                        "caching": "ReadWrite",
                        "createOption": "FromImage"
                    }
                },
                "networkProfile": {
                    "networkInterfaces": [
                        {
                            "id": "[resourceId('Microsoft.Network/networkInterfaces', 'ubuntuVM1-NetworkInterface')]"
                        }
                    ]
                },
                "diagnosticsProfile": {
                    "bootDiagnostics": {
                        "enabled": true,
                        "storageUri": "[reference(resourceId('Microsoft.Storage/storageAccounts/', toLower('ubuntuVM1storage'))).primaryEndpoints.blob]"
                    }
                }
            }
        }
    ]
}`,
                [
                ]
            );

            createContextualizedSnippetTest(
                "resource tags",
                "arm-tags",
                [undefined, '"'],
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "webApp1",
            "type": "Microsoft.Web/sites",
            "apiVersion": "xxxx-xx-xx",
            <!cursor!>
        }
    ]
}`,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "webApp1",
            "type": "Microsoft.Web/sites",
            "apiVersion": "xxxx-xx-xx",
            "tags": {
                "tagName": "tagValue"
            }
        }
    ]
}`,
                [
                ]
            );

        });

    });

    suite('Nested templates', () => {

        createContextualizedSnippetTest(
            "nested template - new parameter definition",
            "new-parameter",
            ['"'],
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "nestedDeployment1",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "xxxx-xx-xx",
            "properties": {
                "expressionEvaluationOptions": {
                    "scope": "inner"
                },
                "mode": "Incremental",
                "template": {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        <!cursor!>
                    },
                    "variables": {},
                    "resources": [],
                    "outputs": {}
                }
            }
        }
    ]
}`,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "nestedDeployment1",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "xxxx-xx-xx",
            "properties": {
                "expressionEvaluationOptions": {
                    "scope": "inner"
                },
                "mode": "Incremental",
                "template": {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "parameter1": {
                            "type": "string",
                            "metadata": {
                                "description": "description"
                            }
                        }
                    },
                    "variables": {},
                    "resources": [],
                    "outputs": {}
                }
            }
        }
    ]
}`,
            [
                'The following parameters do not have values: "parameter1"',
                "The parameter 'parameter1' is never used."
            ]
        );

        createContextualizedSnippetTest(
            "nested template - new parameter value from existing parameter definition",
            "my-existing-parameter-name",
            ['"'],
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "nestedDeployment1",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "xxxx-xx-xx",
            "properties": {
                "expressionEvaluationOptions": {
                    "scope": "inner"
                },
                "parameters": {
                    <!cursor!>
                },
                "mode": "Incremental",
                "template": {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "my-existing-parameter-name": {
                            "type": "string",
                            "metadata": {
                                "description": "description"
                            }
                        }
                    },
                    "variables": {},
                    "resources": [],
                    "outputs": {}
                }
            }
        }
    ]
}`,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "nestedDeployment1",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "xxxx-xx-xx",
            "properties": {
                "expressionEvaluationOptions": {
                    "scope": "inner"
                },
                "parameters": {
                    "my-existing-parameter-name": {
                        "value": "" // TODO: Fill in parameter value
                    }
                },
                "mode": "Incremental",
                "template": {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "my-existing-parameter-name": {
                            "type": "string",
                            "metadata": {
                                "description": "description"
                            }
                        }
                    },
                    "variables": {},
                    "resources": [],
                    "outputs": {}
                }
            }
        }
    ]
}`,
            [
                "The parameter 'my-existing-parameter-name' is never used."
            ]
        );

        createContextualizedSnippetTest(
            "nested template - brand-new parameter value",
            "new-parameter-value",
            ['"'],
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "nestedDeployment1",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "xxxx-xx-xx",
            "properties": {
                "expressionEvaluationOptions": {
                    "scope": "inner"
                },
                "parameters": {
                    <!cursor!>
                },
                "mode": "Incremental",
                "template": {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "my-existing-parameter-name": {
                            "type": "string",
                            "metadata": {
                                "description": "description"
                            }
                        }
                    },
                    "variables": {},
                    "resources": [],
                    "outputs": {}
                }
            }
        }
    ]
}`,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "nestedDeployment1",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "xxxx-xx-xx",
            "properties": {
                "expressionEvaluationOptions": {
                    "scope": "inner"
                },
                "parameters": {
                    "parameter1": {
                        "value": "value"
                    }
                },
                "mode": "Incremental",
                "template": {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "my-existing-parameter-name": {
                            "type": "string",
                            "metadata": {
                                "description": "description"
                            }
                        }
                    },
                    "variables": {},
                    "resources": [],
                    "outputs": {}
                }
            }
        }
    ]
}`,
            [
                'The following parameters do not have values: "my-existing-parameter-name"',
                "The parameter 'my-existing-parameter-name' is never used."
            ]
        );

    });

    test('TODO: Child resources');
    test('TODO: subnets');
});
