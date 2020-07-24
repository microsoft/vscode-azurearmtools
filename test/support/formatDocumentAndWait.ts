// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { commands, TextDocument } from "vscode";
import { ensureLanguageServerAvailable } from "./ensureLanguageServerAvailable";
import { actThenWait, getDocumentChangedPromise } from "./getEventPromise";

export async function formatDocumentAndWait(document: TextDocument): Promise<string> {
    return await actThenWait(
        async () => {
            await ensureLanguageServerAvailable();
            await commands.executeCommand('editor.action.formatDocument');
        },
        getDocumentChangedPromise(document));
}
