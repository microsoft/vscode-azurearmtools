// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length

import { diagnosticSources, testDiagnostics } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("Backend validation deployment scope", () => {
    suite("Subscription deployment scope", () => {
        testWithLanguageServer("subscription() with subscription schema works", () =>
            testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [
                    ],
                    "variables": {
                        "v1": "[subscription()]",
                        "v2": "[subscription().subscriptionId]"
                    },
                    "outputs": {
                        "o1": {
                            "type": "string",
                            "value": "[subscription().subscriptionId]"
                        }
                    }
                },
                {},
                [
                    "Warning: The variable 'v1' is never used. (arm-template (expressions))",
                    "Warning: The variable 'v2' is never used. (arm-template (expressions))"
                ]
            )
        );

        // tslint:disable-next-line: no-suspicious-comment
        /* TODO: https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1018665
        testWithLanguageServer("resourceGroup() with subscription schema gives error", () =>
            testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [],
                    "variables": {
                        "v1": "[resourceGroup()]"
                    },
                    "outputs": { "o1": { "type": "object", "value": "[variables('v1')]" } }
                },
                {},
                [
                    "Error: Template validation failed: The template variable 'v1' is not valid: The template function 'RESOURCEGROUP' is not expected at this location. Please see https://aka.ms/arm-template-expressions for usage details.. Please see https://aka.ms/arm-template-expressions for usage details. (arm-template (validation))"
                ]
            )
        );

        testWithLanguageServer("deployment() with subscription schema gives error", () =>
            testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [],
                    "variables": {
                        "v1": "[deployment()]"
                    },
                    "outputs": { "o1": { "type": "object", "value": "[variables('v1')]" } }
                }
                ,
                {},
                [
                    "Error: Template validation failed: The deployment metadata 'DEPLOYMENT' is not valid. (arm-template (validation))"
                ]
            )
        );
        */
    }); // end suite Subscription scope

    suite("Resource Group deployment scope", () => {
        testWithLanguageServer("resourceGroup() with resource group schema works", () =>
            testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [],
                    "variables": {
                        "v1": "[resourceGroup()]"
                    },
                    "outputs": {
                        "o1": {
                            "type": "string",
                            "value": "[resourceGroup().id]"
                        }
                    }
                },
                {},
                [
                    "Warning: The variable 'v1' is never used. (arm-template (expressions))"
                ]
            )
        );

        // tslint:disable-next-line: no-suspicious-comment
        /* TODO: https://devdiv.visualstudio.com/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1012861
        testWithLanguageServer("deployment() with resource group schema works", () =>
            testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [
                    ],
                    "variables": {
                        "v1": "[deployment()]"
                    },
                    "outputs": {
                        "o1": {
                            "type": "string",
                            "value": "[deployment().name]"
                        }
                    }
                },
                {},
                [
                    "Warning: The variable 'v1' is never used. (arm-template (expressions))"
                ]
            )
        );*/

        // tslint:disable-next-line: no-suspicious-comment
        /* TODO: https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1018665
        testWithLanguageServer("subscription() with resource group schema gives error", () =>
            testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [],
                    "variables": {
                        "v1": "[subscription()]"
                    },
                    "outputs": { "o1": { "type": "object", "value": "[variables('v1')]" } }
                },
                {},
                [
                    "Error: Template validation failed: The deployment metadata 'SUBSCRIPTION' is not valid. (arm-template (validation))"
                ]
            )
        );
        */
    }); // Resource Group deployment scope

    testWithLanguageServer("management group deployment scope", async () => {
        await testDiagnostics(
            'templates/scopes/1055-mg.json',
            {
            },
            [
            ]);
    });

    testWithLanguageServer("tenant deployment scope", async () => {
        await testDiagnostics(
            'templates/scopes/1055-tenant.json',
            {
            },
            [
            ]);
    });

    testWithLanguageServer("subscription deployment scope", async () => {
        await testDiagnostics(
            'templates/scopes/1055-sub.json',
            {
            },
            [
            ]);
    });

    // https://github.com/microsoft/vscode-azurearmtools/issues/831
    testWithLanguageServer(`Give warning if it looks like the $schema is incorrect for the resources being used #1055`, async () => {
        await testDiagnostics(
            'templates/scopes/1055-rg.json',
            {
                includeSources: [diagnosticSources.expressions]
            },
            [
                "Warning: This resource type may not available for a deployment scoped to resource group. Are you using the correct schema? (arm-template (expressions)) [The schema is specified here]",
                "Warning: This resource type may not available for a deployment scoped to resource group. Are you using the correct schema? (arm-template (expressions)) [The schema is specified here]"
            ]);
    });
});
