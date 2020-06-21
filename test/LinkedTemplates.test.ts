// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import { isWin32 } from "../extension.bundle";
import { testDiagnostics, testDiagnosticsFromFile } from "./support/diagnostics";

suite("Linked templates", () => {
    suite("variables and parameters inside templateLink object refer to the parent's scope", () => {
        test('Regress #792: Regression from 0.10.0: top-level parameters not recognized in nested template properties', async () => {
            await testDiagnosticsFromFile(
                'templates/linked-templates-scope.json',
                {},
                [
                    // Should be no errors
                ]
            );
        });

        suite('Regress #773: Regression from 0.10.0: top-level parameters not recognized in nested template properties', () => {
            test("simple", async () => {
                await testDiagnosticsFromFile(
                    {
                        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                        "contentVersion": "1.0.0.0",
                        "resources": [
                            {
                                "name": "aadLinkedTemplate",
                                "type": "Microsoft.Resources/deployments",
                                "apiVersion": "2019-10-01",
                                "properties": {
                                    "mode": "Incremental",
                                    "templateLink": {
                                        "uri": "https://foo"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        parameters: {
                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                            "contentVersion": "1.0.0.0",
                            "parameters": {}
                        }
                    },
                    [
                        // Should be no errors
                    ]);
            });
            test("linked-templates-scope.json", async () => {
                await testDiagnosticsFromFile(
                    'templates/linked-templates-scope.json',
                    {
                        parameters: {
                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                            "contentVersion": "1.0.0.0",
                            "parameters": {}
                        }
                    },
                    [
                        // Should be no errors
                    ]
                );
            });
        });
    });

    suite("Error location inside linked and nested templates", async () => {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: For some reason, these two tests are failing consistently in the
        // Windows build pipeline, but not locally or on other platforms.
        if (!isWin32) {
            test("Nested template wrong param type", async () => {
                await testDiagnostics(
                    {
                        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                        "contentVersion": "1.0.0.0",
                        "resources": [
                            {
                                "type": "Microsoft.Resources/deployments",
                                "apiVersion": "2019-10-01",
                                "name": "inner",
                                "properties": {
                                    "expressionEvaluationOptions": {
                                        "scope": "inner"
                                    },
                                    "mode": "Incremental",
                                    "parameters": {
                                        "parameter1": {
                                            "value": 123
                                        }
                                    },
                                    "template": {
                                        "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                                        "contentVersion": "1.0.0.0",
                                        "parameters": {
                                            "parameter1": {
                                                "type": "string"
                                            }
                                        },
                                        "resources": []
                                    }
                                }
                            }
                        ]
                    },
                    {
                        includeRange: true,
                        parameters: {
                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                            "contentVersion": "1.0.0.0",
                            "parameters": {
                            }
                        }
                    },
                    [
                        "Error: Template validation failed: Template parameter JToken type is not valid. Expected 'String, Uri'. Actual 'Integer'. Please see https://aka.ms/arm-deploy/#parameter-file for usage details. (arm-template (validation)) [8,20-8,20] [The error occurred in a nested template near here] [13,39-13,39]",
                        "Warning: The parameter 'parameter1' is never used. (arm-template (expressions)) [22,12-22,24]"
                    ]
                );
            });

            test("Nested template missing properties", async () => {
                await testDiagnostics(
                    {
                        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                        "contentVersion": "1.0.0.0",
                        "resources": [
                            {
                                "type": "Microsoft.Resources/deployments",
                                "apiVersion": "2019-10-01",
                                "name": "inner"
                            }
                        ]
                    },
                    {
                        includeRange: true,
                        parameters: {
                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                            "contentVersion": "1.0.0.0",
                            "parameters": {
                            }
                        }
                    },
                    [
                        "Error: Template validation failed: The deployment must have Properties property set. Please see https://aka.ms/arm-deploy for usage details. (arm-template (validation)) [4,4-4,4]",
                        "Warning: Missing required property \"properties\" (arm-template (schema)) [4,4-4,5]"

                    ]
                );
            });
        }
    });
});
