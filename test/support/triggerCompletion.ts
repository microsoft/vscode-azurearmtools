import * as assert from 'assert';
import { commands, Diagnostic, TextDocument } from 'vscode';
import { getDiagnosticsForDocument, IGetDiagnosticsOptions } from './diagnostics';
import { getCompletionItemResolutionPromise, getCompletionItemsPromise } from './getEventPromise';

export async function triggerCompletion(
    document: TextDocument,
    completion: string,
    diagnosticsOptions?: { expected: string[] } & IGetDiagnosticsOptions
): Promise<void> {
    const completionItemsPromise = getCompletionItemsPromise(document);
    await commands.executeCommand('editor.action.triggerSuggest');

    // Wait for our code to return completion items
    let items = await completionItemsPromise;
    items = items;

    // Wait for any resolution to be sure the UI is ready
    const resolutionPromise = getCompletionItemResolutionPromise();
    //await delay(1);
    await resolutionPromise;

    let diagnosticsPromise1: Promise<Diagnostic[]> = Promise.resolve([]);
    if (diagnosticsOptions) {
        diagnosticsPromise1 = getDiagnosticsForDocument(
            document, diagnosticsOptions);
    }
    await commands.executeCommand('type', { text: completion });
    await diagnosticsPromise1;

    // Start waiting for next set of diagnostics (so it picks up the current completion versions)
    let diagnosticsPromise2: Promise<Diagnostic[]> = Promise.resolve([]);
    if (diagnosticsOptions) {
        diagnosticsPromise2 = getDiagnosticsForDocument(
            document, diagnosticsOptions);
    }
    //await delay(1); //asdf
    await commands.executeCommand('acceptSelectedSuggestion');
    const diagnostics = await diagnosticsPromise2;

    // Some completions have additional text edits, and vscode doesn't
    // seem to have made all the changes when it fires didDocumentChange,
    // so give a slight delay to allow it to finish
    //await delay(1000);

    // function failed(): void {
    //     // tslint:disable-next-line: prefer-template
    //     assert.fail(`Did not find a completion item matching ${JSON.stringify(completion)}. Completions found: ` +
    //         completionsFound.join(', '));

    // }

    if (diagnosticsOptions?.expected) {
        let messages = diagnostics.map(d => d.message).sort();
        assert.deepEqual(messages, diagnosticsOptions?.expected);
    }
}
