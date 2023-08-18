// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { Extension, extensions } from "vscode";
import { delayWhileSync, ext } from "../../extension.bundle";
import { delay } from "./delay";
import { writeToLog } from "./testLog";

export async function ensureExtensionHasInitialized(totalTimeout: number): Promise<void> {
    async function ensureDotnetExtensionActivated(): Promise<void> {
        const dotnetExtensionName = "ms-dotnettools.vscode-dotnet-runtime";
        writeToLog(`>>> Looking for dotnet extension ${dotnetExtensionName}`, true);
        let extensionDotnet: Extension<unknown> | undefined;
        await delayWhileSync(
            5 * 1000,
            () => {
                extensionDotnet = extensions.getExtension(dotnetExtensionName);
                writeToLog(extensionDotnet !== undefined ? `Dotnet extension ${dotnetExtensionName} found` : `Dotnet extension ${dotnetExtensionName} not found`, true);
                return !extensionDotnet;
            },
            5 * 60 * 1000);
        // tslint:disable-next-line: no-non-null-assertion
        await extensionDotnet!.activate();
        writeToLog(`>>> Dotnet extension ${dotnetExtensionName} is active`, true);
        // console.log("Dotnet extension: ", extensionDotnet);
    }

    await ensureDotnetExtensionActivated();

    async function waitForExtensionInitialization(timeout: number): Promise<boolean> {
        const start = Date.now();
        writeToLog(
            `Extension initialization state: ${ext.extensionStartupComplete ? "Completed" : ext.extensionStartupComplete === undefined ? "Not started" : "In progress"}`,
            true);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const extensionStartupComplete = ext.extensionStartupComplete;

            if (extensionStartupComplete) {
                writeToLog(`>>> Extension initialization complete`, true);
                return true;
            } else if (ext.languageServerStartupError) {
                writeToLog(`>>> Extension initialization failed: ${ext.extensionStartupError}`, true);
                throw new Error(ext.languageServerStartupError);
            }

            if (Date.now() > start + timeout) {
                return false;
            }

            await delay(1000);
        }
    }

    const result1 = await waitForExtensionInitialization(totalTimeout / 2);
    if (result1) {
        return;
    }

    writeToLog(">>> First timeout hit, will try to activate extension manually", true);

    const extension = extensions.getExtension(ext.extensionId);
    assert(extension, `Couldn't find extension ${ext.extensionId}`);
    await extension.activate();

    writeToLog(">>> Activation done", true);
    const result2 = await waitForExtensionInitialization(totalTimeout / 2);
    if (!result2) {
        throw new Error("Timed out waiting for extension initialization to complete");
    }
}
