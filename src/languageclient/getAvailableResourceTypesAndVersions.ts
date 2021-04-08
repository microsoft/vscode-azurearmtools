// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { callWithTelemetryAndErrorHandlingSync } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { waitForLanguageServerAvailable } from "../languageclient/startArmLanguageServer";
import { CaseInsensitiveMap } from "../util/CaseInsensitiveMap";

/**
 * Returns a case-insensitive map of available resource types and their apiVersions for a given ARM schema from the
 * currently-known schema cache in the language server.
 * The map is keyed by the resource type and each value is an array of valid apiVersions.
 *
 * @param schema The ARM schema of the template document to query for
 */
export async function getAvailableResourceTypesAndVersions(schema: string): Promise<CaseInsensitiveMap<string, string[]>> {
    const map = new CaseInsensitiveMap<string, string[]>();

    await callWithTelemetryAndErrorHandlingSync("getAvailableResourceTypesAndVersions", async () => {
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
}
