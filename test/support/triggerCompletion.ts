import * as assert from 'assert';
import { Selection, SnippetString, TextEditor } from 'vscode';
import { DeploymentTemplate, getVSCodeRangeFromSpan } from '../../extension.bundle';
import { delay } from './delay';
import { typeInDocumentAndWait } from './typeInDocumentAndWait';

// tslint:disable-next-line: no-suspicious-comment
// tslint:disable-next-line: export-name //TODO: rename file
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
