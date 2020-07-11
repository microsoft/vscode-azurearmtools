import * as assert from 'assert';
import { commands, Diagnostic, TextDocument } from 'vscode';
import { delay } from './delay';
import { getDiagnosticsForDocument, IGetDiagnosticsOptions } from './diagnostics';
import { getCompletionItemsPromise } from './getEventPromise';

export async function triggerCompletion(
    document: TextDocument,
    completion: string,
    options?: { expected: string[]; triggerCharacter?: string } & IGetDiagnosticsOptions
): Promise<void> {
    // Bring up completion UI
    const completionItemsPromise = getCompletionItemsPromise(document);
    if (options?.triggerCharacter) {
        await commands.executeCommand('type', { text: options.triggerCharacter });
    } else {
        await commands.executeCommand('editor.action.triggerSuggest');
    }

    // Wait for our code to return completion items
    let items = await completionItemsPromise;
    items = items; // (make result easily avaible while debugging)

    let completionItemsCompleted = false;
    // tslint:disable-next-line: no-floating-promises
    completionItemsPromise.then(() => { completionItemsCompleted = true; });
    while (!completionItemsCompleted) {
        // Move to next selection in case the first suggestion isn't one of ours (in which case we won't get a completion resolution)
        await commands.executeCommand('selectNextSuggestion');
        await delay(1);
    }

    // Type the desired completion prefix and wait for the triggered diagnostics to complete
    let diagnosticsPromise1: Promise<Diagnostic[]> = Promise.resolve([]);
    if (options) {
        diagnosticsPromise1 = getDiagnosticsForDocument(
            document, options);
    }
    await commands.executeCommand('type', { text: completion });
    await diagnosticsPromise1;

    // Start waiting for next set of diagnostics (so it picks up the current completion versions)
    let diagnosticsPromise2: Promise<Diagnostic[]> = Promise.resolve([]);
    if (options) {
        diagnosticsPromise2 = getDiagnosticsForDocument(
            document, options);
    }
    // ... Accept current suggestion
    await commands.executeCommand('acceptSelectedSuggestion');
    const diagnostics = await diagnosticsPromise2;

    // Some completions have additional text edits, and vscode doesn't
    // seem to have made all the changes when it fires didDocumentChange,
    // so give a slight delay to allow it to finish
    await delay(1);

    // Wait for final diagnostics and compare
    if (options?.expected) {
        let messages = diagnostics.map(d => d.message).sort();
        assert.deepEqual(messages, options?.expected);
    }
}
