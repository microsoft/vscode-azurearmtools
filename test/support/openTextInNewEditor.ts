// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

import * as fs from 'fs';
import { commands, TextDocument, TextEditor, window, workspace } from 'vscode';
import { getTempFilePath } from './getTempFilePath';

/**
 * Writes text to a temp file, shows it in an editor
 */
export async function openTextInNewEditor(fileContents: string): Promise<{
    dispose(): Promise<void>;
    document: TextDocument;
    editor: TextEditor;
}> {
    // Write to temp file
    let tempPath = getTempFilePath();
    fs.writeFileSync(tempPath, fileContents);

    let document = await workspace.openTextDocument(tempPath);
    let editor = await window.showTextDocument(document);

    return {
        dispose: async (): Promise<void> => {
            fs.unlinkSync(tempPath);

            // NOTE: Even though we request the editor to be closed,
            // there's no way to request the document actually be closed,
            //   and when you open it via an API, it doesn't close for a while,
            //   so the diagnostics won't go away
            // See https://github.com/Microsoft/vscode/issues/43056
            await commands.executeCommand('workbench.action.closeActiveEditor');
            await commands.executeCommand('workbench.action.closeAllEditors');
        },
        document,
        editor
    };
}
