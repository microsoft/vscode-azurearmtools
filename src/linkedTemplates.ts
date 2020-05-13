// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri, window, workspace } from "vscode";
import { parseError } from "vscode-azureextensionui";

// tslint:disable-next-line: export-name //asdf
export async function loadLinkedFile(filePath: string): Promise<void> {
    try {
        const uri = Uri.parse(filePath); //asdf
        // asdf existing?
        const doc = await workspace.openTextDocument(uri);
        await window.showTextDocument(doc);
    } catch (err) {
        window.showErrorMessage(parseError(err).message); //asdf
    }
}
