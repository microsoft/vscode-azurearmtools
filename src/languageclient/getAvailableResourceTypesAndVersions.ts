// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { callWithTelemetryAndErrorHandlingSync } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";

/**
 * Returns a dictionary of available resource types and their apiVersions for a given ARM schema from the
 * currently-known schema cache in the language server.  Will return undefined if the language server is not
 * yet ready or if there is an error.
 *
 * @param schema The ARM schema of the template document to query for
 */
export async function getAvailableResourceTypesAndVersions(schema: string): Promise<{ [key: string]: string[] } | undefined> {
    return await callWithTelemetryAndErrorHandlingSync("getAvailableResourceTypesAndVersions", async () => {
        const result = <{ [key: string]: string[] }>
            await ext.languageServerClient?.
                sendRequest("arm-template/getAvailableResourceTypesAndVersions", {
                    Schema: schema
                });

        return result;
    });
}
