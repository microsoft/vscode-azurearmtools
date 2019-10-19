// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as path from 'path';
import { commands, Diagnostic, Position, Selection, window, workspace } from "vscode";
import { getDiagnosticsForDocument, sources, testFolder } from '../support/diagnostics';
import { getTempFilePath } from "../support/getTempFilePath";

let resourceTemplate: string = `{
    "resources": [

    ],
    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "variables": {
    },
    "parameters": {
    }
}`;

let emptyTemplate: string = "";

const overrideTemplateForSnippet: { [name: string]: string } = {
    "Azure Resource Manager (ARM) Template": emptyTemplate,
    "Azure Resource Manager (ARM) Parameters Template": emptyTemplate
};

const overrideInsertPosition: { [name: string]: Position } = {
    "Azure Resource Manager (ARM) Template": new Position(1, 0),
    "Azure Resource Manager (ARM) Parameters Template": new Position(1, 0)
};

const overrideExpectedDiagnostics: { [name: string]: string[] } = {
    "Azure Resource Manager (ARM) Parameters Template":
        [
            "Template validation failed: Required property 'resources' not found in JSON. Path '', line 5, position 1."
            //"Missing required property resources"
        ]
};

suite("Snippets functional tests", () => {
    suite("all snippets", () => {
        createSnippetTests("jsonsnippets.jsonc");
        createSnippetTests("armsnippets.jsonc");
    });

    function createSnippetTests(snippetsFile: string): void {
        suite(snippetsFile, () => {
            const snippetsPath = path.join(testFolder, '..', 'assets', snippetsFile);
            const snippets = <{ [name: string]: {} }>fse.readJsonSync(snippetsPath);
            // tslint:disable-next-line:no-for-in forin
            for (let snippetName in snippets) {
                test(snippetName, async () => {
                    await createSnippetTest(snippetName);
                });
            }
        });
    }

    async function createSnippetTest(snippetName: string): Promise<void> {
        const template = overrideTemplateForSnippet[snippetName] !== undefined ? overrideTemplateForSnippet[snippetName] : resourceTemplate;
        // tslint:disable-next-line: strict-boolean-expressions
        const expectedDiagnostics = (overrideExpectedDiagnostics[snippetName] || []).sort();
        // tslint:disable-next-line: strict-boolean-expressions
        const snippetInsertPos: Position = overrideInsertPosition[snippetName] || new Position(2, 0);

        const tempPath = getTempFilePath(`snippet ${snippetName}`, '.azrm');

        fse.writeFileSync(tempPath, template);

        let doc = await workspace.openTextDocument(tempPath);
        await window.showTextDocument(doc);

        // Wait for first set of diagnostics to finish.
        await getDiagnosticsForDocument(doc, {});

        // Start waiting for next set of diagnostics (so it picks up the current completion versions)
        let diagnosticsPromise: Promise<Diagnostic[]> = getDiagnosticsForDocument(
            doc,
            {
                waitForChange: true,
                ignoreSources: [sources.schema] //asdf TODO
            });

        // Insert snippet
        window.activeTextEditor!.selection = new Selection(snippetInsertPos, snippetInsertPos);
        await commands.executeCommand('editor.action.insertSnippet', {
            name: snippetName
        });

        // Wait for diagnostics to finish
        let diagnostics: Diagnostic[] = await diagnosticsPromise;

        let messages = diagnostics.map(d => d.message).sort();
        assert.deepStrictEqual(messages, expectedDiagnostics);

        // // NOTE: Even though we request the editor to be closed,
        // // there's no way to request the document actually be closed,
        // //   and when you open it via an API, it doesn't close for a while,
        // //   so the diagnostics won't go away
        // // See https://github.com/Microsoft/vscode/issues/43056
        await commands.executeCommand("undo");
        fse.unlinkSync(tempPath);
        await commands.executeCommand('workbench.action.closeAllEditors');
    }
});
