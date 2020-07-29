// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { commands, TextDocument } from "vscode";
import { testLog } from "./createTestLog";
import { ensureLanguageServerAvailable } from "./ensureLanguageServerAvailable";
import { actThenWait, getDocumentChangedPromise } from "./getEventPromise";

export async function formatDocumentAndWait(document: TextDocument): Promise<string> {
    return await actThenWait(
        async () => {
            await ensureLanguageServerAvailable();
            testLog.writeLineIfLogCreated("Formatting document...");
            await commands.executeCommand('editor.action.formatDocument');
            testLog.writeLineIfLogCreated("Format completed.");
        },
        getDocumentChangedPromise(document));
}
