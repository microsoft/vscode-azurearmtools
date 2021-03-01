// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { armTemplateLanguageId, assertNever, ext, LanguageServerState } from "../../extension.bundle";
import { DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { delay } from "./delay";
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
            language: armTemplateLanguageId
        });

        // tslint:disable-next-line: no-constant-condition
        while (!isLanguageServerAvailable) {
            switch (ext.languageServerState) {
                case LanguageServerState.Failed:
                    throw new Error(`Language server failed on start-up: ${ext.languageServerStartupError}`);
                case LanguageServerState.NotStarted:
                case LanguageServerState.Starting:
                case LanguageServerState.LoadingSchemas:
                    await delay(100);
                    break;
                case LanguageServerState.Running:
                    await delay(1000); // Give vscode time to notice the new formatter available (I don't know of a way to detect this)

                    isLanguageServerAvailable = true;
                    testLog.writeLine("Language server now available");
                    break;

                case LanguageServerState.Stopped:
                    throw new Error('Language server stopped');
                default:
                    assertNever(ext.languageServerState);
            }
        }
    }

    assert(ext.languageServerClient);
    return ext.languageServerClient;
}
