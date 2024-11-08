// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { callWithTelemetryAndErrorHandlingSync } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { CaseInsensitiveMap } from "../util/CaseInsensitiveMap";
import { getAvailableResourceTypesAndVersionsNoThrow } from "./getAvailableResourceTypesAndVersionsNoThrow";

export async function showAvailableResourceTypesAndVersions(schema: string): Promise<void> {
    await callWithTelemetryAndErrorHandlingSync("showAvailableResourceTypesAndVersions", async () => {
        const map: CaseInsensitiveMap<string, string[]> = await getAvailableResourceTypesAndVersionsNoThrow(schema);

        for (const entry of map.entries()) {
            const key = entry[0];
            for (const version of entry[1]) {
                ext.outputChannel.appendLine(`${key}@${version}`);
            }
        }
    });
}
