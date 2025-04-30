// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { waitForLanguageServerAvailable } from "./startArmLanguageServer";

interface LanguageServerVersionInfo {
    languageServerVersion: string;
    schemaCacheVersion: string;
}

/**
 * Asks the language server for version information
 */
export async function getLanguageServerVersionInfo(): Promise<LanguageServerVersionInfo | undefined> {
    return await callWithTelemetryAndErrorHandling("getVersions", async (actionContext: IActionContext) => {
        actionContext.errorHandling.suppressDisplay = true;
        actionContext.telemetry.suppressIfSuccessful = true;

        await waitForLanguageServerAvailable();
        return await ext.languageServerClient?.
            sendRequest("arm-template/getVersions", {}) as LanguageServerVersionInfo;
    });
}
