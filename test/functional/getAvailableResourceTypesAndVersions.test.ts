// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { assert } from "../../src/fixed_assert";
import { getAvailableResourceTypesAndVersions } from "../../src/languageclient/getAvailableResourceTypesAndVersions";
import { ensureLanguageServerAvailable } from "../support/ensureLanguageServerAvailable";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("getAvailableResourceTypesAndVersions", () => {
    testWithLanguageServer("deploymentTemplate.json#", async () => {
        await ensureLanguageServerAvailable();
        const resourceTypes = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#");
        assert(!!resourceTypes);
        assert(Object.entries(resourceTypes).length >= 1000, "Should be lots of resource types");
        assert(resourceTypes["microsoft.ApiManagement/service/users"]);
        assert(resourceTypes["microsoft.ApiManagement/service/users"].includes('2018-01-01'));
        for (const rt of Object.entries(resourceTypes)) {
            assert(rt.length > 0, "Each type listed should have at least one apiVersion");
        }
    });

    testWithLanguageServer("managementGroupDeploymentTemplate.json", async () => {
        await ensureLanguageServerAvailable();
        const resourceTypes = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/2019-08-01/managementGroupDeploymentTemplate.json#");
        assert(!!resourceTypes);
        assert(Object.entries(resourceTypes).length >= 10);
        for (const rt of Object.entries(resourceTypes)) {
            assert(rt.length > 0, "Each type listed should have at least one apiVersion");
        }
    });

    testWithLanguageServer("unknown schema", async () => {
        await ensureLanguageServerAvailable();
        const resourceTypes = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/unknown/deploymentTemplate.json#");
        assert(!!resourceTypes);
        assert.equal(Object.entries(resourceTypes).length, 0);
    });

    testWithLanguageServer("schema without hash = with hash", async () => {
        await ensureLanguageServerAvailable();
        const resourceTypes1 = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/unknown/deploymentTemplate.json#");
        const resourceTypes2 = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/unknown/deploymentTemplate.json");
        assert(!!resourceTypes1);
        assert(!!resourceTypes2);
        assert.equal(Object.entries(resourceTypes1).length, Object.entries(resourceTypes2).length);
    });
});
