// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ext, LanguageServerState } from "../../extension.bundle";
import { DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { delay } from "./delay";

let isLanguageServerAvailable = false;

export async function ensureLanguageServerAvailable(): Promise<void> {
    if (DISABLE_LANGUAGE_SERVER) {
        throw new Error("DISABLE_LANGUAGE_SERVER is set, but this test is trying to call ensureLanguageServerAvailable");
    }

    if (!isLanguageServerAvailable) {
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            switch (ext.languageServerState) {
                case LanguageServerState.Failed:
                    throw new Error(`Language server failed on start-up`);
                case LanguageServerState.NotStarted:
                case LanguageServerState.Starting:
                    await delay(100);
                    break;
                case LanguageServerState.Started:
                    await delay(1000); // Give vscode time to notice the new formatter available (I don't know of a way to detect this)

                    isLanguageServerAvailable = true;
                    return;
                case LanguageServerState.Stopped:
                    throw new Error('Language server stopped');
                default:
                    throw new Error('Unexpected languageServerState');
            }
        }
    }
}
