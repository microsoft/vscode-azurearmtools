// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment max-func-body-length

import { testDiagnostics } from "../support/diagnostics";
import { testWithLanguageServerAndRealFunctionMetadata } from "../support/testWithLanguageServer";

suite("General validation tests (all diagnotic sources)", () => {
    suite("scoped deployments", () => {
        testWithLanguageServerAndRealFunctionMetadata("invalid schema", async () => {
            await testDiagnostics(
                'templates/scopes/invalid-schema.json',
                {
                },
                [
                    "Error: Template validation failed: Template schema 'https://schema.management.azure.com/schemas/2015-01-02/deploymentTemplate.json#' is not supported. Supported versions are '2014-04-01-preview,2015-01-01,2018-05-01,2019-04-01,2019-08-01'. Please see https://aka.ms/arm-template for usage details. (arm-template (validation))",
                    "Warning: Unknown schema: https://schema.management.azure.com/schemas/2015-01-02/deploymentTemplate.json# (arm-template (schema))"
                ]);
        });

        testWithLanguageServerAndRealFunctionMetadata("management group deployment", async () => {
            await testDiagnostics(
                'templates/scopes/managementGroupDeploymentTemplate.define-policy.json',
                {
                },
                []);
        });

        testWithLanguageServerAndRealFunctionMetadata("resource group deployment - old root schema", async () => {
            await testDiagnostics(
                'templates/scopes/resourceGroupDeployment2015-01-01.json',
                {
                },
                []);
        });

        testWithLanguageServerAndRealFunctionMetadata("resource group deployment - new root schema", async () => {
            await testDiagnostics(
                'templates/scopes/resourceGroupDeployment2019-04-01.json',
                {
                },
                []);
        });

        testWithLanguageServerAndRealFunctionMetadata("subscription deployment", async () => {
            await testDiagnostics(
                'templates/scopes/subscriptionDeploymentTemplate.json',
                {
                },
                [
                ]);
        });

        testWithLanguageServerAndRealFunctionMetadata("subscription deployment with nested resource group deployment", async () => {
            await testDiagnostics(
                'templates/scopes/subscriptionDeploymentWithNesteRGDeployment.json',
                {
                },
                [
                ]);
        });

        testWithLanguageServerAndRealFunctionMetadata("tenant deployment", async () => {
            await testDiagnostics(
                'templates/scopes/tenantDeploymentTemplate.assign-role.json',
                {
                },
                []);
        });

        testWithLanguageServerAndRealFunctionMetadata("linked template scope", async () => {
            await testDiagnostics(
                {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    parameters: {
                        linkedTemplatesLocation: {
                            type: "string"
                        }
                    },
                    variables: {
                        firstTemplate: "../linkedTemplate1.json",
                        secondTemplate: "linkedTemplate2.json"
                    },
                    resources: [
                        {
                            name: "nestedDeployment2",
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2017-05-10",
                            properties: {
                                mode: "Incremental",
                                templateLink: {
                                    uri: "[concat(parameters('linkedTemplatesLocation'), '/', variables('secondTemplate'))]",
                                    contentVersion: "1.0.0.0"
                                },
                                parameters: {
                                    linked2param1: {
                                        value: "abc"
                                    }
                                }
                            }
                        },
                        {
                            name: "nestedDeployment1",
                            type: "Microsoft.Resources/deployments",
                            apiVersion: "2017-05-10",
                            properties: {
                                mode: "Incremental",
                                templateLink: {
                                    uri: "[concat(parameters('linkedTemplatesLocation'), '/', variables('firstTemplate'))]"
                                },
                                parameters: {
                                    linked1param1: {
                                        value: "my value" // (error)
                                    }
                                }
                            }
                        }
                    ],
                    outputs: {
                    },
                    functions: [
                    ]
                },
                {
                },
                [
                    // expecting no errors
                ]);
        });
    });
});
