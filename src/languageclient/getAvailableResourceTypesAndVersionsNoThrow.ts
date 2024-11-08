// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { callWithTelemetryAndErrorHandling } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { assert } from "../fixed_assert";
import { CaseInsensitiveMap } from "../util/CaseInsensitiveMap";
import { waitForLanguageServerAvailable } from "./startArmLanguageServer";

/**
 * Returns a case-insensitive map of available resource types and their apiVersions for a given ARM schema from the
 * currently-known schema cache in the language server.
 * The map is keyed by the resource type and each value is an array of valid apiVersions.
 *
 * @param schema The ARM schema of the template document to query for
 */
export async function getAvailableResourceTypesAndVersionsNoThrow(schema: string): Promise<CaseInsensitiveMap<string, string[]>> {
    try {
        const map = new CaseInsensitiveMap<string, string[]>();

        await callWithTelemetryAndErrorHandling("getAvailableResourceTypesAndVersions", async () => {
            await waitForLanguageServerAvailable();

            const resourceTypes = <{ [key: string]: string[] }>
                await ext.languageServerClient?.
                    sendRequest("arm-template/getAvailableResourceTypesAndVersions", {
                        Schema: schema
                    });

            for (const entry of Object.entries(resourceTypes)) {
                const key = entry[0];
                const value = entry[1].map(apiVersion => apiVersion.toLowerCase());

                map.set(key, value);
            }
        });

        return map;
    } catch (err) {
        assert.fail("getAvailableResourceTypesAndVersionsNoThrow shouldn't throw");
    }
}
