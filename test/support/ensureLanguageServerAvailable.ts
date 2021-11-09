// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { Extension, extensions, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { armTemplateLanguageId, delayWhileSync, ext, waitForLanguageServerAvailable } from "../../extension.bundle";
import { DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { delay } from "./delay";
import { writeToLog } from "./testLog";

let isLanguageServerAvailable = false;

export async function ensureLanguageServerAvailable(): Promise<LanguageClient> {
    if (DISABLE_LANGUAGE_SERVER) {
        throw new Error("DISABLE_LANGUAGE_SERVER is set, but this test is trying to call ensureLanguageServerAvailable");
    }

    if (!isLanguageServerAvailable) { //asdf
        writeToLog("Waiting for language server to be available", true);

        // Open a doc to force the language server to start up
        workspace.openTextDocument({
            content: `{"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#","contentVersion": "1.0.0.0","resources": []}`,
            language: armTemplateLanguageId,
        });

        await waitForLanguageServerAvailable();
        writeToLog("Language server now available", true);
    }

    assert(ext.languageServerClient);
    return ext.languageServerClient;
}

export async function ensureExtensionHasInitialized(): Promise<void> { //asdf move
    writeToLog(">>>>>>>>>>>>>> activating dotnet extension ", true);
    let extensionDotnet: Extension<unknown> | undefined;
    await delayWhileSync(
        1000,
        () => {
            extensionDotnet = extensions.getExtension("ms-dotnettools.vscode-dotnet-runtime");
            console.log(extensionDotnet);
            return !!extensionDotnet;
        },
        5 * 60 * 1000);
    // tslint:disable-next-line: no-non-null-assertion
    await extensionDotnet!.activate();
    writeToLog(">>>>>>>>>>>>>> dotnet extension activated", true);

    console.log("Dotnet extension: ", extensionDotnet);

    const timeout = 13 * 60 * 1000;

    let start = Date.now();
    writeToLog(
        `Extension initialization state: ${ext.extensionStartupComplete ? "Completed" : ext.extensionStartupComplete === undefined ? "Not started" : "In progress"}`,
        true);

    // tslint:disable-next-line: no-constant-condition
    while (true) {
        const extensionStartupComplete = ext.extensionStartupComplete;

        if (extensionStartupComplete) {
            writeToLog(`Extension initialization complete`, true);
            return;
        } else if (ext.languageServerStartupError) {
            writeToLog(`Extension initialization failed: ${ext.extensionStartupError}`, true);
            throw new Error(ext.languageServerStartupError);
        }

        if (Date.now() > start + timeout) {
            break;
        }
        await delay(1000);

    }

    writeToLog("First timeout", true);
    writeToLog("Trying to activate extension manually", true);

    let extension = extensions.getExtension(ext.extensionId);
    assert(extension, `Couldn't find extension ${ext.extensionId}`);
    await extension.activate();

    start = Date.now();
    writeToLog(
        `Extension initialization state: ${ext.extensionStartupComplete ? "Completed" : ext.extensionStartupComplete === undefined ? "Not started" : "In progress"}`,
        true);

    // tslint:disable-next-line: no-constant-condition
    while (true) {
        const extensionStartupComplete = ext.extensionStartupComplete;

        if (extensionStartupComplete) {
            writeToLog(`Extension initialization complete`, true);
            return;
        } else if (ext.languageServerStartupError) {
            writeToLog(`Extension initialization failed: ${ext.extensionStartupError}`, true);
            throw new Error(ext.languageServerStartupError);
        }

        if (Date.now() > start + timeout) {
            throw new Error("Timed out waiting for extension to initialize");
        }
        await delay(1000);
    }
}
