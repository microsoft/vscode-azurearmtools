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

    function createCompletionsFunctionalTest(
        testName: string,
        params: string | Partial<IDeploymentParametersFile>,
        template: string | Partial<IDeploymentTemplate> | undefined,
        insertSuggestionPrefix: string, // Insert the suggestion starting with this string
        expectedResult: string
    ): void {
        testWithLanguageServer(testName, async () => {
            const { markers: { bang }, unmarkedText } = getDocumentMarkers(params);
            expectedResult = removeEOLMarker(expectedResult);

            let { editor, document, dispose } = await openTextInNewEditor(unmarkedText);

            await delay(1);

            const position = editor.document.positionAt(bang.index);
            editor.selection = new Selection(position, position);
            await delay(1);

            const documentChangedPromise = getDocumentChangedPromise(document);
            const completionItemsPromise = getCompletionItemsPromise(document);

            await commands.executeCommand('editor.action.triggerSuggest');
            const completions = await completionItemsPromise;

            // Give time for suggestions to show (ick)
            // CONSIDER: Use completion resolution events to figure out when the UI is ready
            await delay(1000);

            const insertSuggestionIndex = completions.findIndex(c => c.label.startsWith(insertSuggestionPrefix));
            if (insertSuggestionIndex < 0) {
                assert.fail(`Did not find a completion item starting with "${insertSuggestionIndex}"`);
            }

            await commands.executeCommand('selectFirstSuggestion');
            for (let i = 0; i < insertSuggestionIndex; ++i) {
                await commands.executeCommand('selectNextSuggestion');
            }

            await commands.executeCommand('acceptSelectedSuggestion');
            const actualResult = await documentChangedPromise;
            assert.equal(actualResult, expectedResult);

            await dispose();
        });
    }

    suite("No template file", () => {
        suite("Completions for new parameters", async () => {
            createCompletionsFunctionalTest(
                "No template file, new parameter in blank section",
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        !{EOL}
    }
}`,
                undefined,
                newParamCompletionLabel,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "parameter1": {
            "value": "value"
        }
    }
}`
            );

            createCompletionsFunctionalTest(
                "No template file, new parameter after an existing one, comma already exists",
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
                undefined,
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
    }
}`
            );

            createCompletionsFunctionalTest(
                "No template file, new parameter before an existing one, automatically adds comma after new parameter",
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        !{EOL}
        "PARAmeter2": {
            "value": "string"
        }
    }
}`,
                undefined,
                newParamCompletionLabel,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "parameter1": {
            "value": "value"
        },
        "PARAmeter2": {
            "value": "string"
        }
    }
}`
            );

            createCompletionsFunctionalTest(
                "No template file, inside existing double quotes (or double quote trigger), removes double quotes when inserting",
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "!"
    }
}`,
                undefined,
                newParamCompletionLabel,
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "parameter1": {
            "value": "value"
        }
    }
}`
            );
        });
    });
});
