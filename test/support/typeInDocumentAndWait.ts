// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { Position, Selection, TextEditor, window } from "vscode";
import { ensureLanguageServerAvailable } from "./ensureLanguageServerAvailable";
import { actThenWait, getDocumentChangedPromise } from "./getEventPromise";
import { stringify } from './stringify';
import { writeToLog } from './testLog';

export async function typeInDocumentAndWait(editor: TextEditor, text: string): Promise<string> {
    return await actThenWait(
        async () => {
            // Not using the 'type' command because:
            //  1) Seems to be not 100% consistent
            //  2) It causes vscode to call provideCompletionItems, which causes interaction with
            //      the triggerSuggest behavior in extension.ts

            const initialPosition = editor.selection.anchor;
            let setPosition = initialPosition.translate(0, text.length);

            writeToLog(`typeInDocumentAndWait: ${stringify(text)}`);

            if (text === '"') {
                // Imitate vscode adding the closing quote
                text = '""';
                setPosition = initialPosition.translate(0, 1);
            } else if (text === '{') {
                // Imitate vscode adding the closing brace
                // NOTE: This would be better in the caller
                const margin = initialPosition.character;
                const indent = Number(editor.options.tabSize ?? 4);
                text = `{\n${' '.repeat(margin + indent)}\n${' '.repeat(margin)}}`;
                setPosition = new Position(initialPosition.line + 1, margin + indent);
            }

            await ensureLanguageServerAvailable();
            assert(window.activeTextEditor === editor, "Wrong active text editor");
            await editor.edit(e => e.insert(initialPosition, text));
            editor.selection = new Selection(setPosition, setPosition);
            const finalPosition = editor.selection.anchor;
            assert.equal(finalPosition, setPosition);
        },
        getDocumentChangedPromise(editor.document));
}
