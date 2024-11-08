// tslint:disable:no-useless-files
// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable-next-line: no-suspicious-comment
// TODO: Gives this on build machine only:   Error: "registerUIExtensionVariables" must be called before using the @microsoft/vscode-azext-utils package.
/*
import * as assert from "assert";
import { getAvailableResourceTypesAndVersions } from "../../extension.bundle";
import { ensureLanguageServerAvailable } from "../support/ensureLanguageServerAvailable";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("getAvailableResourceTypesAndVersions", () => {
    testWithLanguageServer("deploymentTemplate.json#", async () => {
        await ensureLanguageServerAvailable();
        const resourceTypes = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#");
        assert(resourceTypes.size >= 1000, "Should be lots of resource types");
        assert(resourceTypes.get("microsoft.ApiManagement/service/users"));
        assert(resourceTypes.get("microsoft.ApiManagement/service/users")?.includes('2018-01-01'));
        for (const rt of resourceTypes.entries()) {
            assert(rt.length > 0, "Each type listed should have at least one apiVersion");
        }
    });

    testWithLanguageServer("managementGroupDeploymentTemplate.json", async () => {
        await ensureLanguageServerAvailable();
        const resourceTypes = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/2019-08-01/managementGroupDeploymentTemplate.json#");
        assert(Object.entries(resourceTypes).length >= 10);
        for (const rt of resourceTypes.entries()) {
            assert(rt.length > 0, "Each type listed should have at least one apiVersion");
        }
    });

    testWithLanguageServer("unknown schema", async () => {
        await ensureLanguageServerAvailable();
        const resourceTypes = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/unknown/deploymentTemplate.json#");
        assert.equal(resourceTypes.size, 0);
    });

    testWithLanguageServer("schema without hash = with hash", async () => {
        await ensureLanguageServerAvailable();
        const resourceTypes1 = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/unknown/deploymentTemplate.json#");
        const resourceTypes2 = await getAvailableResourceTypesAndVersions("https://schema.management.azure.com/schemas/unknown/deploymentTemplate.json");
        assert.equal(resourceTypes1.size, resourceTypes2.size);
    });
});
*/
