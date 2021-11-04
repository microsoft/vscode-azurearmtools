// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { commands, TextDocument } from "vscode";
import { ensureLanguageServerAvailable } from "./ensureLanguageServerAvailable";
import { actThenWait, getDocumentChangedPromise } from "./getEventPromise";
import { writeToLog } from "./testLog";

export async function formatDocumentAndWait(document: TextDocument): Promise<string> {
    return await actThenWait(
        async () => {
            await ensureLanguageServerAvailable();
            writeToLog("Formatting document...");
            await commands.executeCommand('editor.action.formatDocument');
            writeToLog("Format completed.");
        },
        getDocumentChangedPromise(document));
}
