// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

// tslint:disable:no-unused-expression no-console no-string-based-set-timeout max-line-length
// tslint:disable:insecure-random max-func-body-length radix prefer-template no-function-expression
// tslint:disable: no-non-null-assertion

import * as assert from "assert";
import * as fs from 'fs';
import { ISuiteCallbackContext, ITestCallbackContext } from "mocha";
import * as path from 'path';
import { commands, languages, Range, Selection, TextDocument, TextEditor, window, workspace } from "vscode";
import { armTemplateLanguageId } from "../extension.bundle";
import { diagnosticsTimeout, testFolder } from "./support/diagnostics";
import { ensureLanguageServerAvailable } from "./support/ensureLanguageServerAvailable";
import { getTempFilePath } from "./support/getTempFilePath";
import { testWithLanguageServer } from "./support/testWithLanguageServer";

const formatDocumentCommand = 'editor.action.formatDocument';
const formatRangeCommand = 'editor.action.formatSelection';

suite("Format document", function (this: ISuiteCallbackContext): void {
    this.timeout(diagnosticsTimeout);

    function testFormat(testName: string, source: string, expected: string, range?: Range | RegExp): void {
        testWithLanguageServer(testName, async function (this: ITestCallbackContext): Promise<void> {
            let sourceIsFile = false;
            let jsonUnformatted: string = source;
            if (source.match(/\.jsonc?$/)) {
                sourceIsFile = true;
                jsonUnformatted = fs.readFileSync(path.join(testFolder, source)).toString().trim();
            }
            let jsonExpected: string = expected;
            if (jsonExpected.match(/\.jsonc?$/)) {
                jsonExpected = fs.readFileSync(path.join(testFolder, expected)).toString().trim();
            }

            if (source === 'format-me.json') {
                assert(!jsonUnformatted.match(/[\n\r]/), "The input file to format should only be one line of JSON. Did it get corrupted?");
            }

            let filePath = getTempFilePath(sourceIsFile ? `temp.${path.basename(source)}` : undefined);
            fs.writeFileSync(filePath, jsonUnformatted);
            let doc = await workspace.openTextDocument(filePath);
            let editor: TextEditor = await window.showTextDocument(doc);
            if (!sourceIsFile && doc.languageId !== armTemplateLanguageId) {
                await languages.setTextDocumentLanguage(doc, armTemplateLanguageId);
            }

            // Now that we've opened a document that should start up the server, wait until we know it's actually available before trying
            // to format
            await ensureLanguageServerAvailable();

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

            if (sourceIsFile && jsonUnformatted !== jsonExpected) {
                assert.notEqual(jsonUnformatted, output, "The format command did not modify the editor.");
            }

            assert.equal(output, jsonExpected);
        });
    }

    suite("Format entire document", () => {
        testFormat('templates/format-me.jsonc', 'templates/format-me.jsonc', 'templates/format-me.expected.full.jsonc');
        testFormat('format twice', 'templates/format-me.expected.full.jsonc', 'templates/format-me.expected.full.jsonc');
        testFormat('bad syntax', 'This is a bad json file', 'This is a bad json file');
        testFormat('{}', '{}', '{\n}');

        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Currently fails due to https://dev.azure.com/devdiv/DevDiv/_workitems/edit/892851
        //testFormat('empty', '', '');
    });

    suite("Format range", () => {
        testFormat('range: whole doc', 'templates/format-me.jsonc', 'templates/format-me.expected.full.jsonc', /.*/);

        const unformattedJson =
            `{ "$schema" :
"http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" ,
             "contentVersion" : "1.0.0.0" ,
               "parameters" :{"location":{
                "type": "string"}}
}`;

        testFormat(
            'dictionary value - only affects the line it\'s on',
            unformattedJson,
            `{ "$schema" :
"http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" ,
  "contentVersion": "1.0.0.0",
               "parameters" :{"location":{
                "type": "string"}}
}`,
            /1.0.0.0/);

        testFormat(
            'final closing bracket - formats entire file',
            unformattedJson,
            `{
  "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": {
      "type": "string"
    }
  }
}`,
            /}$/);

        testFormat(
            'Next to last brackets - doesn\'t affect first line',
            unformattedJson,
            `{ "$schema" :
"http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" ,
             "contentVersion" : "1.0.0.0" ,
  "parameters": {
    "location": {
      "type": "string"
    }
  }
}`,
            /}}/);
    });
});

function rangeFromMatch(doc: TextDocument, regex: RegExp): Range {
    let match = doc.getText().match(regex);
    assert(!!match, "Could not find rangeFromMatch pattern");
    return new Range(
        doc.positionAt(match!.index!),
        doc.positionAt(match!.index! + match![0].length)
    );
}
