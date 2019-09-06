// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

// tslint:disable:no-unused-expression no-console no-string-based-set-timeout
// tslint:disable:insecure-random max-func-body-length radix prefer-template

import * as assert from "assert";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commands, Diagnostic, DiagnosticSeverity, Disposable, languages, window, workspace } from "vscode";
import { diagnosticsCompleteMessage, diagnosticsSource } from "../extension.bundle";

const diagnosticsTimeout = 20000;
const testFolder = path.join(__dirname, '..', '..', 'test', 'templates');

const schemaSource = ''; // Built-in schema errors
const jsonSource = 'json'; // Built-in JSON errors
export const armToolsSource = diagnosticsSource;

interface ITestDiagnosticsOptions {
    ignoreSources?: string[];
    includeRange?: boolean; // defaults to false
}

export function testDiagnosticsDeferred(filePath: string, options?: ITestDiagnosticsOptions, expected?: string[]): void {
    test(filePath);
}

export function testDiagnosticsFromFile(filePath: string | object, options: ITestDiagnosticsOptions, expected: string[]): void {
    test(`File ${filePath}`, async () => {
        let actual: Diagnostic[] = await getDiagnosticsForTemplate(filePath);

        let ignoreSources = options.ignoreSources || [];

        // For now, always ignore schema and JSON diagnostics because we don't know when they're fully published
        ignoreSources = ignoreSources.concat([jsonSource, schemaSource]);

        if (options.ignoreSources) {
            actual = actual.filter(d => !options.ignoreSources.includes(d.source));
        }

        compareDiagnostics(actual, expected, options);
    });
}

export function testDiagnostics(testName: string, json: string | object, options: ITestDiagnosticsOptions, expected: string[]): void {
    test(testName, async () => {
        let actual: Diagnostic[] = await getDiagnosticsForTemplate(json);

        let ignoreSources = options.ignoreSources || [];

        // For now, always ignore schema and JSON diagnostics because we don't know when they're fully published
        ignoreSources = ignoreSources.concat([jsonSource, schemaSource]);

        if (options.ignoreSources) {
            actual = actual.filter(d => !options.ignoreSources.includes(d.source));
        }

        compareDiagnostics(actual, expected, options);
    });
}

async function getDiagnosticsForTemplate(templateContentsOrFileName: string | { $schema?: string }): Promise<Diagnostic[]> {
    let templateContents: string | undefined;
    let filePath: string | undefined;
    let fileToDelete: string | undefined;

    if (typeof templateContentsOrFileName === 'string') {
        if (!!templateContentsOrFileName.match(/\.jsonc?$/)) {
            // It's a filename
            filePath = path.join(testFolder, templateContentsOrFileName);
        } else {
            templateContents = templateContentsOrFileName;
        }
    } else {
        if (!templateContentsOrFileName.$schema) {
            templateContentsOrFileName.$schema = "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#";
        }
        templateContents = JSON.stringify(templateContentsOrFileName, null, 2);
    }

    if (!filePath) {
        assert(typeof templateContents === 'string');
        let tempName = '';
        for (let i = 0; i < 10; ++i) {
            tempName += String.fromCharCode(64 + Math.random() * 26);
        }
        filePath = path.join(os.tmpdir(), `${tempName}.jsonc`);
        fs.writeFileSync(filePath, templateContents);
        fileToDelete = filePath;
    }

    let diagnostics: Diagnostic[] | undefined;
    let dispose: Disposable;
    let timer: NodeJS.Timer;
    // tslint:disable-next-line:typedef
    let diagnosticsPromise = new Promise((resolve, reject) => {
        timer = setTimeout(
            () => {
                reject(
                    new Error('Waiting for diagnostics timed out. Last retrieved diagnostics: '
                        + (diagnostics ? diagnostics.map(d => d.message).join('\n') : "None")));
            },
            diagnosticsTimeout);
        dispose = languages.onDidChangeDiagnostics(e => {
            if (e.uris.find(uri => uri.fsPath === doc.uri.fsPath)) {
                diagnostics = languages.getDiagnostics(doc.uri);
                if (diagnostics.find(d => d.message === diagnosticsCompleteMessage)) {
                    resolve();
                }
            }
        });
    });

    let doc = await workspace.openTextDocument(filePath);
    await window.showTextDocument(doc);

    await diagnosticsPromise;
    assert(!!diagnostics);

    if (dispose) {
        dispose.dispose();
    }

    if (fileToDelete) {
        fs.unlinkSync(fileToDelete);
    }

    clearTimeout(timer);

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
        s += ` [${diagnostic.range.start.line},${diagnostic.range.start.character}`
            + `-${diagnostic.range.end.line},${diagnostic.range.end.character}]`;
    }

    return s;
}

function compareDiagnostics(actual: Diagnostic[], expected: string[], options: ITestDiagnosticsOptions): void {
    let actualAsStrings = actual.map(d => diagnosticToString(d, options));
    assert.deepStrictEqual(actualAsStrings, expected);
}
