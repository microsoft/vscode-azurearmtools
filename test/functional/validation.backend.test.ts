// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length

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
});
