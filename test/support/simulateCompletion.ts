import * as assert from 'assert';
import { Selection, SnippetString, TextEditor } from 'vscode';
import { DeploymentTemplateDoc, getVSCodeRangeFromSpan } from '../../extension.bundle';
import { delay } from './delay';
import { stringify } from './stringify';
import { testLog } from './testLog';
import { typeInDocumentAndWait } from './typeInDocumentAndWait';

export async function simulateCompletion(
    editor: TextEditor,
    completion: string,
    triggerCharacter: string | undefined
): Promise<void> {
    let pos = editor.selection.anchor;
    let deploymentTemplate: DeploymentTemplateDoc = new DeploymentTemplateDoc(editor.document.getText(), editor.document.uri);
    let pc = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(pos.line, pos.character, undefined, true);

    if (triggerCharacter) {
        // Type the trigger character
        const newContents = await typeInDocumentAndWait(editor, triggerCharacter);
        deploymentTemplate = new DeploymentTemplateDoc(newContents, editor.document.uri);
        pos = editor.selection.anchor;
        pc = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(pos.line, pos.character, undefined, true);
    }

    // Get completion items
    let result = await pc.getCompletionItems(triggerCharacter);
    if (result.triggerSuggest) {
        testLog.writeLine("triggering suggestion because result.triggerSuggest=true");
        // Trigger again after entering a newline
        const newContents = await typeInDocumentAndWait(editor, '\n');

        deploymentTemplate = new DeploymentTemplateDoc(newContents, editor.document.uri);
        pos = editor.selection.anchor;
        pc = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(pos.line, pos.character, undefined, true);

        result = await pc.getCompletionItems(undefined);
        assert(!result.triggerSuggest, "Shouldn't triggerSuggest twice");
    }

    // Find the desired snippet
    const snippet = result.items.find(s => s.label === completion || s.label === `"${completion}"`);
    testLog.writeLine(`Available completions: ${stringify(result)}`);
    if (!snippet) {
        throw new Error(`Couldn't find completion with label '${completion}' that is available at this location`);
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
    await delay(1);
}
