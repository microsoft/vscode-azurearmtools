// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

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
    });
});
