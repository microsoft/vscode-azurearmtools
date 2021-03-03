// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import { testDiagnostics } from "./support/diagnostics";
import { testWithLanguageServer } from "./support/testWithLanguageServer";

suite("Nested templates functional tests", () => {

    testWithLanguageServer("type mismatch error location #1119", async () => {
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {},
                "functions": [],
                "variables": {},
                "resources": [
                    {
                        "name": "nestedDeployment1",
                        "type": "Microsoft.Resources/deployments",
                        "apiVersion": "2020-10-01",
                        "properties": {
                            "expressionEvaluationOptions": {
                                "scope": "inner"
                            },
                            "mode": "Incremental",
                            "parameters": {
                                "intParam": {
                                    "value": "abc"
                                }
                            },
                            "template": {
                                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                "contentVersion": "1.0.0.0",
                                "parameters": {
                                    "intParam": {
                                        "type": "int",
                                        "metadata": {
                                            "description": "description"
                                        }
                                    }
                                },
                                "functions": [],
                                "variables": {},
                                "resources": [],
                                "outputs": {}
                            }
                        }
                    }
                ],
                "outputs": {}
            },
            {},
            [
                "Error: Template validation failed: Template parameter JToken type is not valid. Expected 'Integer'. Actual 'String'. Please see https://aka.ms/arm-deploy/#parameter-file for usage details. (arm-template (validation)) [12,21-12,21] [The error occurred in a nested template near here] [26,19-26,19]",
                "Warning: The parameter 'intParam' is never used. (arm-template (expressions)) [26,13-26,23]",
            ]);
    });
});
