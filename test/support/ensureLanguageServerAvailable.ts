// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { commands, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { armTemplateLanguageId, ext, waitForLanguageServerAvailable } from "../../extension.bundle";
import { DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { delay } from "./delay";
import { writeToLog } from "./testLog";

let isLanguageServerAvailable = false;

export async function ensureLanguageServerAvailable(): Promise<LanguageClient> {
    if (DISABLE_LANGUAGE_SERVER) {
        throw new Error("DISABLE_LANGUAGE_SERVER is set, but this test is trying to call ensureLanguageServerAvailable");
    }

    if (!isLanguageServerAvailable) { //asdf
        writeToLog("Waiting for language server to be available");

        // Open a doc to force the language server to start up
        workspace.openTextDocument({
            content: `{"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#","contentVersion": "1.0.0.0","resources": []}`,
            language: armTemplateLanguageId,
        });

        await waitForLanguageServerAvailable();
        writeToLog("Language server now available");
    }

    assert(ext.languageServerClient);
    return ext.languageServerClient;
}

export async function ensureExtensionHasInitialized(): Promise<void> { //asdf move
    const timeout = 2 * 60 * 1000;

    let start = Date.now();
    // tslint:disable-next-line: no-constant-condition
    while (true) {
        const extensionStartupComplete = ext.extensionStartupComplete;

        console.log(`Extension initialization state: ${extensionStartupComplete ? "Completed" : extensionStartupComplete === undefined ? "Not started" : "In progress"}`);

        if (extensionStartupComplete) {
            console.log(`Extension initialization complete`);
            return;
        } else if (ext.languageServerStartupError) {
            console.log(`Extension initialization failed: ${ext.extensionStartupError}`);
            throw new Error(ext.languageServerStartupError);
        }

        if (Date.now() > start + timeout) {
            break;
        }
        await delay(1000);

    }

    console.warn("First timeout");

    console.warn("before");
    await commands.executeCommand("azurerm-vscode-tools.developer.showAvailableResourceTypesAndVersions");
    console.warn("after");

    start = Date.now();
    // tslint:disable-next-line: no-constant-condition
    while (true) {
        const extensionStartupComplete = ext.extensionStartupComplete;

        console.log(`Extension initialization state: ${extensionStartupComplete ? "Completed" : extensionStartupComplete === undefined ? "Not started" : "In progress"}`);

        if (extensionStartupComplete) {
            console.log(`Extension initialization complete`);
            return;
        } else if (ext.languageServerStartupError) {
            console.log(`Extension initialization failed: ${ext.extensionStartupError}`);
            throw new Error(ext.languageServerStartupError);
        }

        if (Date.now() > start + timeout) {
            throw new Error("Timed out waiting for extension to initialize");
        }
        await delay(1000);

    }
}
