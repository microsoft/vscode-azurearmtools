// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { commands, TextDocument } from "vscode";
import { ensureLanguageServerAvailable } from "./ensureLanguageServerAvailable";
import { actThenWait, getDocumentChangedPromise } from "./getEventPromise";
import { testLog } from "./testLog";

export async function formatDocumentAndWait(document: TextDocument): Promise<string> {
    return await actThenWait(
        async () => {
            await ensureLanguageServerAvailable();
            testLog.writeLine("Formatting document...");
            await commands.executeCommand('editor.action.formatDocument');
            testLog.writeLine("Format completed.");
        },
        getDocumentChangedPromise(document));
}
