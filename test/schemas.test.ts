// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length no-http-string

import * as assert from "assert";
import { DeploymentScopeKind, findSchemaInfo, getPreferredSchema, ISchemaInfo } from "../extension.bundle";

const mostRecentRGSchema = "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#";

suite("Schemas", () => {
    suite("getPreferredSchema", () => {
        function createTest(schema: string, expectedPreferred: string | undefined): void {
            // tslint:disable-next-line: strict-boolean-expressions
            test(schema || "(empty)", () => {
                const preferred: string | undefined = getPreferredSchema(schema);
                assert.equal(preferred, expectedPreferred);
            });
        }

        // Unrecognized schemas
        createTest("", undefined);
        createTest("://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#", undefined);
        createTest("2://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#", undefined);
        createTest("https://schema.management.azure.com/schema/2014-04-01-preview/deploymentTemplate.json#", undefined); // misspelled /schemas/
        createTest("https://schemas.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#", undefined); // misspelled /schema./management

        // Newer schemas shouldn't trip and therefore recommend an older schema
        createTest("https://schema.management.azure.com/schemas/2020-01-01/deploymentTemplate.json#", undefined);

        // https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json# - prefer newer
        createTest("https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#", mostRecentRGSchema);
        createTest("http://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#", mostRecentRGSchema);
        createTest("https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json", mostRecentRGSchema);
        createTest("HTTPS://SCHEMA.Management.Azure.Com/Schemas/2014-04-01-PREVIEW/DeploymentTemplate.json#", mostRecentRGSchema);

        // https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json# - prefer newer
        createTest("https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#", mostRecentRGSchema);
        createTest("http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#", mostRecentRGSchema);
        createTest("https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json", mostRecentRGSchema);
        createTest("HTTPS://SCHEMA.Management.Azure.Com/Schemas/2015-01-01/DeploymentTemplate.json#", mostRecentRGSchema);

        // https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json# - already newest, should return undefined
        createTest("https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#", undefined);

        // https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json# - already newest
        createTest("https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#", undefined);

        // https://schema.management.azure.com/schemas/2019-08-01/managementGroupDeploymentTemplate.json# - already newest
        createTest("https://schema.management.azure.com/schemas/2019-08-01/managementGroupDeploymentTemplate.json#", undefined);

        // https://schema.management.azure.com/schemas/2019-08-01/tenantDeploymentTemplate.json# - already newest
        createTest("https://schema.management.azure.com/schemas/2019-08-01/tenantDeploymentTemplate.json#", undefined);
    });

    suite("findSchemaInfo", () => {
        function createFindSchemaInfoTest(schemaUri: string, expected: ISchemaInfo | undefined): void {
            test(schemaUri, () => {
                const info = findSchemaInfo(schemaUri);
                if (expected) {
                    if (!info) {
                        assert.fail("Expected non-null schema info");
                    }

                    assert.strictEqual(info.normalizedSchema, expected.normalizedSchema, "normalizedSchema value incorrect");
                    assert.strictEqual(info.deploymentScopeKind, expected.deploymentScopeKind, "deploymentScopeKind value incorrect");
                    assert.strictEqual(info.isDeprecated, expected.isDeprecated, "isDeprecated value incorrect");
                } else {
                    assert(!info, "Expected null schema info");
                }
            });
        }

        suite("All recognized schemas", () => {
            createFindSchemaInfoTest(
                "https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#",
                <ISchemaInfo>{
                    normalizedSchema: '2014-04-01-preview/deploymentTemplate.json',
                    deploymentScopeKind: DeploymentScopeKind.resourceGroup,
                    isDeprecated: true
                });

            createFindSchemaInfoTest(
                "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                <ISchemaInfo>{
                    normalizedSchema: '2015-01-01/deploymentTemplate.json',
                    deploymentScopeKind: DeploymentScopeKind.resourceGroup,
                    isDeprecated: true
                });

            createFindSchemaInfoTest(
                "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                <ISchemaInfo>{
                    normalizedSchema: '2019-04-01/deploymentTemplate.json',
                    deploymentScopeKind: DeploymentScopeKind.resourceGroup,
                    isDeprecated: false
                });

            createFindSchemaInfoTest(
                "https://schema.management.azure.com/schemas/2019-08-01/tenantDeploymentTemplate.json#",
                <ISchemaInfo>{
                    normalizedSchema: '2019-08-01/tenantDeploymentTemplate.json',
                    deploymentScopeKind: DeploymentScopeKind.tenant,
                    isDeprecated: false
                });

            createFindSchemaInfoTest(
                "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
                <ISchemaInfo>{
                    normalizedSchema: '2018-05-01/subscriptionDeploymentTemplate.json',
                    deploymentScopeKind: DeploymentScopeKind.subscription,
                    isDeprecated: false
                });

            createFindSchemaInfoTest(
                "https://schema.management.azure.com/schemas/2019-08-01/managementGroupDeploymentTemplate.json#",
                <ISchemaInfo>{
                    normalizedSchema: '2019-08-01/managementGroupDeploymentTemplate.json',
                    deploymentScopeKind: DeploymentScopeKind.managementGroup,
                    isDeprecated: false
                });
        });
    });
});
