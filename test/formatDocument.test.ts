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
import { commands, window, workspace } from "vscode";
import { getTempFilePath } from "./getTempFilePath";
import { diagnosticsTimeout, getDiagnosticsForDocument, testFolder } from "./testDiagnostics";

suite("format document", function (this: ISuiteCallbackContext): void {
    this.timeout(diagnosticsTimeout);

    test("format entire document", async () => {
        const jsonUnformmated = fs.readFileSync(path.join(testFolder, 'format-me.json')).toString().trim();
        let jsonExpected = fs.readFileSync(path.join(testFolder, 'format-me.expected.json')).toString().trim();

        assert(!jsonUnformmated.match(/[\n\r]/), "The input file to format should only be one line of JSON. Did it get corrupted?");

        let filePath = getTempFilePath();
        fs.writeFileSync(filePath, jsonUnformmated);
        let doc = await workspace.openTextDocument(filePath);
        await window.showTextDocument(doc);

        // Wait until we have diagnostics, which means the language server is definitely hooked up
        // TODO: we have to wait for schema errors, too
        await getDiagnosticsForDocument(doc);

        await commands.executeCommand('editor.action.formatDocument');

        let output = doc.getText();
        await commands.executeCommand('workbench.action.closeActiveEditor');
        fs.unlinkSync(filePath);

        output = output.replace(/\r\n/g, '\n');
        jsonExpected = jsonExpected.replace(/\r\n/g, '\n');

        assert.equal(output, jsonExpected);
    });
});
