// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { armTemplateLanguageId, ext, waitForLanguageServerAvailable } from "../../extension.bundle";
import { DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { testLog } from "./testLog";

let isLanguageServerAvailable = false;

export async function ensureLanguageServerAvailable(): Promise<LanguageClient> {
    if (DISABLE_LANGUAGE_SERVER) {
        throw new Error("DISABLE_LANGUAGE_SERVER is set, but this test is trying to call ensureLanguageServerAvailable");
    }

    if (!isLanguageServerAvailable) {
        testLog.writeLine("Waiting for language server to be available");

        // Open a doc to force the language server to start up
        workspace.openTextDocument({
            content: `{"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#","contentVersion": "1.0.0.0","resources": []}`,
            language: armTemplateLanguageId,
        });

        await waitForLanguageServerAvailable();
        testLog.writeLine("Language server now available");
    }

    assert(ext.languageServerClient);
    return ext.languageServerClient;
}
