// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

// tslint:disable:no-unused-expression no-console no-string-based-set-timeout max-line-length
// tslint:disable:insecure-random max-func-body-length radix prefer-template

import * as assert from "assert";
import * as fs from 'fs';
import { ISuiteCallbackContext } from "mocha";
import * as path from 'path';
import { commands, languages, Range, Selection, TextDocument, TextEditor, window, workspace } from "vscode";
import { armDeploymentLanguageId } from "../extension.bundle";
import { getTempFilePath } from "./support/getTempFilePath";
import { diagnosticsTimeout, getDiagnosticsForDocument, testFolder } from "./support/testDiagnostics";

const formatDocumentCommand = 'editor.action.formatDocument';
const formatRangeCommand = 'editor.action.formatSelection';

suite("Format document", function (this: ISuiteCallbackContext): void {
    this.timeout(diagnosticsTimeout);

    async function testFormat(testName: string, source: string, expected: string, range?: Range | RegExp): Promise<void> {
        test(testName, async () => {
            let sourceIsFile = false;
            let jsonUnformatted: string = source;
            if (source.includes('.json')) {
                sourceIsFile = true;
                jsonUnformatted = fs.readFileSync(path.join(testFolder, source)).toString().trim();
            }
            let jsonExpected: string = expected;
            if (jsonExpected.includes('.json')) {
                jsonExpected = fs.readFileSync(path.join(testFolder, expected)).toString().trim();
            }

            if (source === 'format-me.json') {
                assert(!jsonUnformatted.match(/[\n\r]/), "The input file to format should only be one line of JSON. Did it get corrupted?");
            }

            let filePath = getTempFilePath(sourceIsFile ? `temp.${path.basename(source)}` : undefined);
            fs.writeFileSync(filePath, jsonUnformatted);
            let doc = await workspace.openTextDocument(filePath);
            let editor: TextEditor = await window.showTextDocument(doc);
            if (!sourceIsFile && doc.languageId !== armDeploymentLanguageId) {
                await languages.setTextDocumentLanguage(doc, armDeploymentLanguageId);
            }

            // Wait until we have diagnostics, which means the language server is definitely hooked up
            await getDiagnosticsForDocument(doc);

            if (range) {
                let foundRange: Range;
                if (range instanceof RegExp) {
                    foundRange = rangeFromMatch(doc, range);
                } else {
                    foundRange = range;
                }
                let selection: Selection = new Selection(foundRange.start, foundRange.end);
                editor.selection = selection;

                await commands.executeCommand(formatRangeCommand);
            } else {
                await commands.executeCommand(formatDocumentCommand);
            }

            let output = doc.getText();
            await commands.executeCommand('workbench.action.closeAllEditors');
            fs.unlinkSync(filePath);

            output = output.replace(/\r\n/g, '\n').trim();
            jsonExpected = jsonExpected.replace(/\r\n/g, '\n');

            if (sourceIsFile) {
                assert.notEqual(jsonUnformatted, output, "The format command did not modify the editor.");
            }

            assert.equal(output, jsonExpected);
        });
    }

    suite("Format entire document", () => {
        testFormat('templates/format-me.json', 'templates/format-me.json', 'templates/format-me.expected.full.json');
        testFormat('almost empty', 'almost empty', 'almost empty');

        // TODO: Currently fails due to https://dev.azure.com/devdiv/DevDiv/_workitems/edit/892851
        //testFormat('empty', '', '');
    });

    suite("Format range", () => {
        testFormat('range: contentVersion', 'templates/format-me.json', 'templates/format-me.expected.range1.json', /contentVersion/);
    });
});

function rangeFromMatch(doc: TextDocument, regex: RegExp): Range {
    let match = doc.getText().match(regex);
    assert(!!match, "Could not find rangeFromMatch pattern");
    return new Range(
        doc.positionAt(match.index),
        doc.positionAt(match.index + match[0].length)
    );
}
