// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length
// tslint:disable: no-suspicious-comment

import { testDiagnostics } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("Backend validation", () => {
    testWithLanguageServer("missing required property 'resources'", async () =>
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.2.3.4"
            },
            {
            },
            [
                // Expected:
                "Error: Template validation failed: Required property 'resources' not found in JSON. Path '', line 4, position 1. (arm-template (validation))",

                // Other errors:
                'Warning: Missing required property "resources" (arm-template (schema))'
            ])
    );

    testWithLanguageServer("reference not valid inside a function definition", async () => {
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                resources: [],
                "functions": [
                    {
                        "namespace": "udf",
                        "members": {
                            "storageUri": {
                                "parameters": [
                                    {
                                        "name": "storageAccountName",
                                        "type": "string"
                                    }
                                ],
                                "output": {
                                    "type": "string",
                                    "value": "[reference(concat('Microsoft.Storage/storageAccounts/', parameters('storageAccountName')), '2018-02-01').primaryEndpoints.blob]"
                                }
                            }
                        }
                    }
                ]
            },
            {
            },
            [
                // Expected:
                // (Used to point to the user-function name, now points to the "output" property)
                "Error: Template validation failed: The template function 'storageUri' at line '16' and column '21' is not valid. These function calls are not supported in a function definition: 'reference'. Please see https://aka.ms/arm-template/#functions for usage details. (arm-template (validation))",

                // Unrelated errors:
                "Warning: The user-defined function 'udf.storageUri' is never used. (arm-template (expressions))"
            ]
        );
    });

    // https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/copy-outputs
    testWithLanguageServer("copy loop in outputs 1", async () => {
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "storageCount": {
                        "type": "int",
                        "defaultValue": 2
                    }
                },
                "variables": {
                    "baseName": "[concat('storage', uniqueString(resourceGroup().id))]"
                },
                "resources": [
                    {
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2019-04-01",
                        "name": "[concat(copyIndex(), variables('baseName'))]",
                        "location": "[resourceGroup().location]",
                        "sku": {
                            "name": "Standard_LRS"
                        },
                        "kind": "Storage",
                        "properties": {},
                        "copy": {
                            "name": "storagecopy",
                            "count": "[parameters('storageCount')]"
                        }
                    }
                ],
                "outputs": {
                    "storageEndpoints": {
                        "type": "array",
                        "copy": {
                            "count": "[parameters('storageCount')]",
                            "input": "[reference(concat(copyIndex(), variables('baseName'))).primaryEndpoints.blob]"
                        }
                    }
                }
            },
            {},
            []
        );
    });

    // https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/copy-outputs
    testWithLanguageServer("copy loop in outputs 2", async () => {
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "storageCount": {
                        "type": "int",
                        "defaultValue": 2
                    }
                },
                "variables": {
                    "baseName": "[concat('storage', uniqueString(resourceGroup().id))]"
                },
                "resources": [
                    {
                        "type": "Microsoft.Storage/storageAccounts",
                        "apiVersion": "2019-04-01",
                        "name": "[concat(copyIndex(), variables('baseName'))]",
                        "location": "[resourceGroup().location]",
                        "sku": {
                            "name": "Standard_LRS"
                        },
                        "kind": "Storage",
                        "properties": {},
                        "copy": {
                            "name": "storagecopy",
                            "count": "[parameters('storageCount')]"
                        }
                    }
                ],
                "outputs": {
                    "storageEndpoints": {
                        "type": "array",
                        "copy": {
                            "count": "[parameters('storageCount')]",
                            "input": "[reference(concat(copyIndex(), variables('baseName'))).primaryEndpoints.blob]"
                        }
                    }
                }
            },
            {},
            []
        );
    });

    //https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates-cloud-consistency#track-versions-using-api-profiles
    testWithLanguageServer("copy loop in outputs 3 - subscription deployment", async () => {
        await testDiagnostics(
            // https://github.com/microsoft/vscode-azurearmtools/issues/600#issuecomment-616631029
            {
                "$schema": "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "rgNamePrefix": {
                        "type": "string",
                        "defaultValue": ""
                    },
                    "rgEnvList": {
                        "type": "array",
                        "allowedValues": [
                            "DEV",
                            "TEST",
                            "PROD"
                        ],
                        "defaultValue": [
                        ]
                    },
                    "rgLocation": {
                        "type": "string",
                        "defaultValue": ""
                    },
                    "instanceCount": {
                        "type": "int",
                        "defaultValue": 2
                    }
                },
                "variables": {
                },
                "resources": [
                    {
                        "type": "Microsoft.Resources/resourceGroups",
                        "apiVersion": "2018-05-01",
                        "location": "[parameters('rgLocation')]",
                        "name": "[concat(parameters('rgNamePrefix'),'-',parameters('rgEnvList')[copyIndex()])]",
                        "copy": {
                            "name": "rgCopy",
                            "count": "[parameters('instanceCount')]"
                        },
                        "properties": {
                        }
                    }
                ],
                "outputs": {
                    "resourceGroups": {
                        "type": "array",
                        "copy": {
                            "count": "[parameters('instanceCount')]",
                            "input": "[resourceId('Microsoft.Resources/resourceGroups', concat(parameters('rgNamePrefix'),'-',parameters('rgEnvList')[copyIndex()]))]"
                        }
                    }
                }
            },
            {},
            [
                // TODO: There should be no errors
                //  https://github.com/microsoft/vscode-azurearmtools/issues/695
                `Warning: Missing required property "value" (arm-template (schema))`
            ]
        );
    });
});
