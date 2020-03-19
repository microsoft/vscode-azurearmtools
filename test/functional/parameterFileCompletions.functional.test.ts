// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template

import { commands, Selection, TextDocument, workspace } from 'vscode';
import { Completion } from "../../extension.bundle";
import { ext } from '../../src/extensionVariables';
import { assert } from '../../src/fixed_assert';
import { delay } from '../support/delay';
import { IDeploymentParametersFile, IDeploymentTemplate } from "../support/diagnostics";
import { openTextInNewEditor } from '../support/openTextInNewEditor';
import { getDocumentMarkers, removeEOLMarker } from "../support/parseTemplate";
import { testWithLanguageServer } from '../support/testWithLanguageServer';

const newParamCompletionLabel = "New parameter value";

function getDocumentChangedPromise(document: TextDocument, timeout: number = 60000): Promise<string> {
    // tslint:disable-next-line:typedef
    return new Promise(async (resolve, reject) => {
        const disposable = workspace.onDidChangeTextDocument(e => {
            if (e.document === document) {
                disposable.dispose();
                resolve(document.getText());
            }
        });

        await delay(timeout);
        reject("timeout");
    });
}

function getCompletionItemsPromise(document: TextDocument, timeout: number = 60000): Promise<Completion.Item[]> {
    // tslint:disable-next-line:typedef
    return new Promise(async (resolve, reject) => {
        const disposable = ext.completionItemsSpy.onCompletionItems(e => {
            if (e.document.documentId.fsPath === document.uri.fsPath) {
                disposable.dispose();
                resolve(e.result);
            }
        });

        await delay(timeout);
        reject("timeout");
    });
}

suite("Function parameter file completions", () => {

    function createParamsCompletionsFunctionalTest(
        testName: string,
        params: string | Partial<IDeploymentParametersFile>,
        template: string | Partial<IDeploymentTemplate> | undefined,
        insertSuggestionPrefix: string, // Insert the suggestion starting with this string
        // Can either be an array of completion names, or an array of
        //   [completion name, insert text] tuples
        expectedResult: string
    ): void {
        testWithLanguageServer(testName, async () => {
            //let dt: DeploymentTemplate | undefined = template ? await parseTemplate(template) : undefined;

            const { markers: { bang }, unmarkedText } = getDocumentMarkers(params);
            expectedResult = removeEOLMarker(expectedResult);

            let { editor, document, dispose } = await openTextInNewEditor(unmarkedText);

            await delay(1000);

            const position = editor.document.positionAt(bang.index);
            editor.selection = new Selection(position, position);
            await delay(1);

            const documentChangedPromise = getDocumentChangedPromise(document);
            const completionItemsPromise = getCompletionItemsPromise(document);

            await commands.executeCommand('editor.action.triggerSuggest');
            const completions = await completionItemsPromise;

            // Give suggestions UI time to show up (ick)
            await delay(1000);

            const insertSuggestionIndex = completions.findIndex(c => c.label.startsWith(insertSuggestionPrefix));
            if (insertSuggestionIndex < 0) {
                assert.fail(`Did not find a completion item starting with "${insertSuggestionIndex}"`);
            }

            await commands.executeCommand('selectFirstSuggestion');
            for (let i = 0; i < insertSuggestionIndex; ++i) {
                await commands.executeCommand('selectNextSuggestion');
            }

            await delay(1000);

            await commands.executeCommand('acceptSelectedSuggestion');
            const actualResult = await documentChangedPromise;
            assert.equal(actualResult, expectedResult);

            await dispose();
        });
    }

    // /**asdf
    //  * Given a deployment template and a character index into it, verify that getReferences on the template
    //  * returns the expected set of locations.
    //  *
    //  * Usually parseTemplateWithMarkers will be used to parse the document and find the indices of a set of locations
    //  * Example:
    //  *
    //  *      const { dt, markers: { apiVersionDef, apiVersionReference } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
    //  *      // Cursor at reference to "apiVersion" inside resources
    //  *      await testFindReferences(dt, apiVersionReference.index, [apiVersionReference.index, apiVersionDef.index]);
    //  */
    // export async function testParamCompletions(
    //     dt: DeploymentTemplate,
    //     dp: DeploymentParameters,
    //     cursorIndex: number,
    //     expectedReferenceIndices: number[]
    // ): Promise<void> {
    //     const pc = dt.getContextFromDocumentCharacterIndex(cursorIndex);
    //     // tslint:disable-next-line: no-non-null-assertion
    //     const references: ReferenceList = pc.getReferences()!;
    //     assert(references, "Expected non-empty list of references");

    //     const indices = references.spans.map(r => r.startIndex).sort();
    //     expectedReferenceIndices = expectedReferenceIndices.sort();

    //     assert.deepStrictEqual(indices, expectedReferenceIndices);
    // }
    suite("Completions for new parameters", async () => {
        createParamsCompletionsFunctionalTest(
            "asdf",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "PARAmeter2": {
            "value": "string"
        },
        !{EOL}
    }
}`,
            {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "parameters": {
                    "Parameter10": {
                        "type": "int"
                    },
                    "Parameter2": {
                        "type": "string"
                    }
                }
            },
            newParamCompletionLabel,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "PARAmeter2": {
            "value": "string"
        },
        "parameter1": {
            "value": "value"
        }
        {EOL}
    }
}`
        );
    });
});

// export async function acceptFirstSuggestion(uri: vscode.Uri, _disposables: vscode.Disposable[]) {
// 	const didChangeDocument = onChangedDocument(uri, _disposables);
// 	await vscode.commands.executeCommand('editor.action.triggerSuggest');
// 	await wait(1000); // Give time for suggestions to show
// 	await vscode.commands.executeCommand('acceptSelectedSuggestion');
// 	return didChangeDocument;
// }

// export async function typeCommitCharacter(uri: vscode.Uri, character: string, _disposables: vscode.Disposable[]) {
// 	const didChangeDocument = onChangedDocument(uri, _disposables);
// 	await vscode.commands.executeCommand('editor.action.triggerSuggest');
// 	await wait(1000); // Give time for suggestions to show
// 	await vscode.commands.executeCommand('type', { text: character });
// 	return await didChangeDocument;
// }

// export function onChangedDocument(documentUri: Uri, disposables: Disposable[]) {
// 	return new Promise<TextDocument>(resolve => workspace.onDidChangeTextDocument(e => {
// 		if (e.document.uri.toString() === documentUri.toString()) {
// 			resolve(e.document);
// 		}
// 	}, undefined, disposables));
// };
