// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import { testDiagnostics, testDiagnosticsFromFile } from "./support/diagnostics";
import { testWithLanguageServer } from "./support/testWithLanguageServer";
import { isWin32 } from "./testConstants";

suite("Linked templates regressions", () => {
    suite("variables and parameters inside templateLink object refer to the parent's scope", () => {
        testWithLanguageServer('Regress #792: Regression from 0.10.0: top-level parameters not recognized in nested template properties', async () => {
            await testDiagnosticsFromFile(
                'templates/linked-templates-scope.json',
                {},
                [
                    // Should be no errors
                ]
            );
        });

        suite('Regress #773: Regression from 0.10.0: top-level parameters not recognized in nested template properties', () => {
            testWithLanguageServer("simple", async () => {
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
                        'Error: Template validation failed: getaddrinfo ENOTFOUND foo (arm-template (validation)) [9,21-9,21]'
                    ]);
            });
            testWithLanguageServer("linked-templates-scope.json", async () => {
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
            testWithLanguageServer("Nested template wrong param type", async () => {
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
                        "Error: Template validation failed: Template parameter JToken type is not valid. Expected 'String, Uri'. Actual 'Integer'. Please see https://aka.ms/arm-deploy/#parameter-file for usage details. (arm-template (validation)) [9,21-9,21] [The error occurred in a nested template near here] [23,21-23,21]",
                        "Warning: The parameter 'parameter1' is never used. (arm-template (expressions)) [23,13-23,25]"
                    ]
                );
            });

            testWithLanguageServer("Nested template missing properties", async () => {
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
                        "Error: Template validation failed: The deployment must have Properties property set. Please see https://aka.ms/arm-deploy for usage details. (arm-template (validation)) [5,5-5,5]",
                        "Warning: Missing required property \"properties\" (arm-template (schema)) [5,5-5,6]"

                    ]
                );
            });
        }
    });
});
