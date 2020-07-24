import * as assert from 'assert';
import { commands, Selection, SnippetString, TextDocument, TextEditor } from 'vscode';
import { DeploymentTemplate, getVSCodeRangeFromSpan } from '../../extension.bundle';
import { delay } from './delay';
import { getDiagnosticsForDocument, IDiagnosticsResults, IGetDiagnosticsOptions } from './diagnostics';
import { getCompletionItemsPromise } from './getEventPromise';
import { typeInDocumentAndWait } from './typeInDocumentAndWait';

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
    let diagnosticsPromise1: Promise<IDiagnosticsResults> = Promise.resolve<IDiagnosticsResults>({ diagnostics: [], sourceCompletionVersions: {} });
    if (options) {
        diagnosticsPromise1 = getDiagnosticsForDocument(
            document, options);
    }
    await commands.executeCommand('type', { text: completion });
    await diagnosticsPromise1;

    // Start waiting for next set of diagnostics (so it picks up the current completion versions)
    let diagnosticsPromise2: Promise<IDiagnosticsResults> = Promise.resolve<IDiagnosticsResults>({ diagnostics: [], sourceCompletionVersions: {} });
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
        let messages = diagnostics.diagnostics.map(d => d.message).sort();
        assert.deepEqual(messages, options?.expected);
    }
}

export async function simulateCompletion(
    editor: TextEditor,
    completion: string,
    triggerCharacter: string | undefined
): Promise<void> {
    let pos = editor.selection.anchor;
    let deploymentTemplate: DeploymentTemplate = new DeploymentTemplate(editor.document.getText(), editor.document.uri);
    let pc = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(pos.line, pos.character, undefined, true);

    if (triggerCharacter) {
        // Type the trigger character
        const newContents = await typeInDocumentAndWait(editor, triggerCharacter);
        deploymentTemplate = new DeploymentTemplate(newContents, editor.document.uri);
        pos = editor.selection.anchor;
        pc = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(pos.line, pos.character, undefined, true);
    }

    // Get completion items
    let result = await pc.getCompletionItems(triggerCharacter);
    if (result.triggerSuggest) {
        // Trigger again after entering a newline
        const newContents = await typeInDocumentAndWait(editor, '\n');

        deploymentTemplate = new DeploymentTemplate(newContents, editor.document.uri);
        pos = editor.selection.anchor;
        pc = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(pos.line, pos.character, undefined, true);

        result = await pc.getCompletionItems(undefined);
        assert(!result.triggerSuggest, "Shouldn't triggerSuggest twice");
    }

    // Find the desired snippet
    const snippet = result.items.find(s => s.label === completion || s.label === `"${completion}"`);
    if (!snippet) {
        throw new Error(`Couldn't find snippet with label '${completion}'`);
    }

    const range = getVSCodeRangeFromSpan(deploymentTemplate, snippet.span);
    editor.selection = new Selection(range.start, range.end);

    // tslint:disable-next-line: strict-boolean-expressions
    if (snippet.additionalEdits?.length) {
        assert(snippet.additionalEdits.length === 1, "Not implemented: More than one edit");
        const edit = snippet.additionalEdits[0];
        const r = getVSCodeRangeFromSpan(deploymentTemplate, edit.span);
        await editor.edit(e => e.replace(r, edit.insertText));
    }

    await editor.insertSnippet(new SnippetString(snippet.insertText));

    // Some completions have additional text edits, and vscode doesn't
    // seem to have made all the changes when it fires didDocumentChange,
    // so give a slight delay to allow it to finish
    await delay(1);
}
