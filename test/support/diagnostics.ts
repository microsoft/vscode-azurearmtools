// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

// tslint:disable:no-unused-expression no-console no-string-based-set-timeout
// tslint:disable:insecure-random max-func-body-length radix prefer-template

import * as assert from "assert";
import * as fs from 'fs';
import * as path from 'path';
import { commands, Diagnostic, DiagnosticSeverity, Disposable, languages, TextDocument, window, workspace } from "vscode";
import { diagnosticsCompleteMessage, diagnosticsSource, languageServerCompleteMessage } from "../../extension.bundle";
import { getTempFilePath } from "./getTempFilePath";

export const diagnosticsTimeout = 30000; // CONSIDER: Use this long timeout only for first test, or for suite setup
export const testFolder = path.join(__dirname, '..', '..', '..', 'test');

export type Source = 'ARM Language Server' | 'json';
export const schemaSource: Source = 'ARM Language Server'; // Schema errors
export const armToolsSource: Source = <Source>diagnosticsSource;

interface ITestDiagnosticsOptions {
    ignoreSources?: Source[]; // Error sources to ignore in the comparison - defaults to ignoring none
    includeRange?: boolean;   // defaults to false - whether to include the error range in the results for comparison
    search?: RegExp;          // Run a replacement using this regex and replacement on the file/contents before testing for errors
    replace?: string;         // Run a replacement using this regex and replacement on the file/contents before testing for errors
}

export async function testDiagnosticsFromFile(filePath: string | object, options: ITestDiagnosticsOptions, expected: string[]): Promise<void> {
    await testDiagnosticsCore(filePath, options, expected);
}

export async function testDiagnostics(json: string | object, options: ITestDiagnosticsOptions, expected: string[]): Promise<void> {
    await testDiagnosticsCore(json, options, expected);
}

export async function testDiagnosticsCore(templateContentsOrFileName: string | { $schema?: string }, options: ITestDiagnosticsOptions, expected: string[]): Promise<void> {
    let actual: Diagnostic[] = await getDiagnosticsForTemplate(templateContentsOrFileName, options.search, options.replace);

    if (options.ignoreSources) {
        actual = actual.filter(d => !(<string[]>options.ignoreSources).includes(d.source));
    }

    compareDiagnostics(actual, expected, options);
}

async function getDiagnosticsForDocument(
    document: TextDocument,
    search?: RegExp,          // Run a replacement using this regex and replacement on the file/contents before testing for errors
    replace?: string         // Run a replacement using this regex and replacement on the file/contents before testing for errors
): Promise<Diagnostic[]> {
    let dispose: Disposable;
    let timer: NodeJS.Timer;

    // tslint:disable-next-line:typedef
    let diagnosticsPromise = new Promise<Diagnostic[]>((resolve, reject) => {
        let currentDiagnostics: Diagnostic[] | undefined;
        let complete: boolean;

        function pollDiagnostics(): void {
            currentDiagnostics = languages.getDiagnostics(document.uri);
            if (currentDiagnostics.find(d => d.message === diagnosticsCompleteMessage)
                && currentDiagnostics.find(d => d.message === languageServerCompleteMessage)
            ) {
                complete = true;
                resolve(currentDiagnostics);
            }
        }

        // Poll first in case the diagnostics are already in
        pollDiagnostics();

        // Now only poll on changed events
        console.log("Waiting for diagnostics to complete...");
        if (!complete) {
            timer = setTimeout(
                () => {
                    reject(
                        new Error('Waiting for diagnostics timed out. Last retrieved diagnostics: '
                            + (currentDiagnostics ? currentDiagnostics.map(d => d.message).join('\n') : "None")));
                },
                diagnosticsTimeout);
            dispose = languages.onDidChangeDiagnostics(e => {
                pollDiagnostics();
            });
        }
    });

    let diagnostics = await diagnosticsPromise;
    assert(!!diagnostics);

    if (dispose) {
        dispose.dispose();
    }

    if (timer) {
        clearTimeout(timer);
    }

    return diagnostics.filter(d => d.message !== diagnosticsCompleteMessage && d.message !== languageServerCompleteMessage);
}

export async function getDiagnosticsForTemplate(
    templateContentsOrFileName: string | { $schema?: string },
    search?: RegExp,          // Run a replacement using this regex and replacement on the file/contents before testing for errors
    replace?: string,         // Run a replacement using this regex and replacement on the file/contents before testing for errors
): Promise<Diagnostic[]> {
    let templateContents: string | undefined;
    let fileToDelete: string | undefined;

    if (typeof templateContentsOrFileName === 'string') {
        if (!!templateContentsOrFileName.match(/\.jsonc?$/)) {
            // It's a filename
            let sourcePath = path.join(testFolder, templateContentsOrFileName);
            templateContents = fs.readFileSync(sourcePath).toString();
        } else {
            // It's a string
            templateContents = templateContentsOrFileName;
        }
    } else {
        // It's an object
        let templateObject: { $schema?: string } = templateContentsOrFileName;
        templateContents = JSON.stringify(templateObject, null, 2);
    }

    // Add schema if not already present (to make it easier to write tests)
    if (!templateContents.includes('$schema')) {
        templateContents = templateContents.replace(/\s*{\s*/, '{\n"$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",\n');
    }

    if (search) {
        let newContents = templateContents.replace(search, replace);
        templateContents = newContents;
    }

    // Write to temp file
    let tempPath = getTempFilePath();
    fs.writeFileSync(tempPath, templateContents);
    fileToDelete = tempPath;

    let doc = await workspace.openTextDocument(tempPath);
    await window.showTextDocument(doc);

    let diagnostics: Diagnostic[] = await getDiagnosticsForDocument(doc);
    assert(!!diagnostics);

    if (fileToDelete) {
        fs.unlinkSync(fileToDelete);
    }

    commands.executeCommand('workbench.action.closeActiveEditor');

    return diagnostics.filter(d => d.message !== diagnosticsCompleteMessage);
}

function diagnosticToString(diagnostic: Diagnostic, options: ITestDiagnosticsOptions): string {
    assert(diagnostic.code === '', `Expecting empty code for all diagnostics, instead found Code="${String(diagnostic.code)}" for "${diagnostic.message}"`);

    let severity: string;
    switch (diagnostic.severity) {
        case DiagnosticSeverity.Error: severity = "Error"; break;
        case DiagnosticSeverity.Warning: severity = "Warning"; break;
        case DiagnosticSeverity.Information: severity = "Information"; break;
        case DiagnosticSeverity.Hint: severity = "Hint"; break;
        default: assert.fail(`Expected severity ${diagnostic.severity}`); break;
    }

    let s = `${severity}: ${diagnostic.message} (${diagnostic.source})`;

    if (options.includeRange === true) {
        if (!diagnostic.range) {
            s += " []";
        } else {
            s += ` [${diagnostic.range.start.line},${diagnostic.range.start.character}`
                + `-${diagnostic.range.end.line},${diagnostic.range.end.character}]`;
        }
    }

    return s;
}

function compareDiagnostics(actual: Diagnostic[], expected: string[], options: ITestDiagnosticsOptions): void {
    let actualAsStrings = actual.map(d => diagnosticToString(d, options));
    assert.deepStrictEqual(actualAsStrings, expected);
}
