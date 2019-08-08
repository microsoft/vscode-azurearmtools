// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

// tslint:disable:no-unused-expression no-console no-string-based-set-timeout
// tslint:disable:insecure-random max-func-body-length radix prefer-template
// tslint:disable:object-literal-key-quotes no-http-string

import * as assert from "assert";
import * as fs from 'fs';
import * as path from 'path';
import { commands, Diagnostic, DiagnosticSeverity, Disposable, languages, TextDocument, window, workspace } from "vscode";
import { diagnosticsCompletePrefix, expressionsDiagnosticsSource } from "../../extension.bundle";
import { getTempFilePath } from "./getTempFilePath";

export const diagnosticsTimeout = 30000; // CONSIDER: Use this long timeout only for first test, or for suite setup
export const testFolder = path.join(__dirname, '..', '..', '..', 'test');

export interface Source {
    name: string;
}
export const sources = {
    expressions: { name: expressionsDiagnosticsSource },
    schema: { name: 'ARM (Schema)' },
    syntax: { name: 'ARM (Syntax)' },
    template: { name: 'ARM (Template)' },
};

export type IDeploymentExpressionType = "string" | "securestring" | "int" | "bool" | "object" | "secureObject" | "array";
export interface IDeploymentParameterDefinition {
    // tslint:disable-next-line:no-reserved-keywords
    type: IDeploymentExpressionType;
    metadata?: {
        [key: string]: string;
        description?: string;
    };
    maxLength?: number;
    defaultValue?: number | unknown[] | string | {};
    allowedValues?: (number | unknown[] | string | {})[];
}

export interface IDeploymentTemplate {
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" | "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#";
    contentVersion: string;
    parameters?: {
        [key: string]: IDeploymentParameterDefinition;
    };
    variables?: {
        [key: string]: number | unknown[] | string | {};
    };
    resources: IDeploymentTemplateResource[];
    outputs?: {
        [key: string]: {
            // tslint:disable-next-line:no-reserved-keywords
            type: IDeploymentExpressionType;
            value: number | unknown[] | string | {};
        };
    };
}

export const defaultArmSchema = "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#";

export const minimalDeploymentTemplate: IDeploymentTemplate = {
    "$schema": defaultArmSchema,
    "contentVersion": "1.0.0.0",
    "resources": [
    ]
};

export interface IDeploymentTemplateResource {
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
    name: string;
    apiVersion: string;
    location: string;
    dependsOn?: string[];
    tags?: { [key: string]: string };
    properties?: { [key: string]: unknown };
    resources?: IDeploymentTemplateResource[];
    [key: string]: unknown;
}

// tslint:disable-next-line:no-empty-interface
interface ITestDiagnosticsOptions extends IGetDiagnosticsOptions {
}

interface IGetDiagnosticsOptions {
    includeSources?: Source[]; // Error sources to include in the comparison - defaults to all
    ignoreSources?: Source[];  // Error sources to ignore in the comparison - defaults to ignoring none
    includeRange?: boolean;    // defaults to false - whether to include the error range in the results for comparison (if true, ignored when expected messages don't have ranges)
    search?: RegExp;           // Run a replacement using this regex and replacement on the file/contents before testing for errors
    replace?: string;          // Run a replacement using this regex and replacement on the file/contents before testing for errors
    doNotAddSchema?: boolean;  // Don't add schema (testDiagnostics only) automatically
}

export async function testDiagnosticsFromFile(filePath: string | Partial<IDeploymentTemplate>, options: ITestDiagnosticsOptions, expected: string[]): Promise<void> {
    await testDiagnosticsCore(filePath, options, expected);
}

export async function testDiagnostics(json: string | Partial<IDeploymentTemplate>, options: ITestDiagnosticsOptions, expected: string[]): Promise<void> {
    await testDiagnosticsCore(json, options, expected);
}

async function testDiagnosticsCore(templateContentsOrFileName: string | Partial<IDeploymentTemplate>, options: ITestDiagnosticsOptions, expected: string[]): Promise<void> {
    let actual: Diagnostic[] = await getDiagnosticsForTemplate(templateContentsOrFileName, options);
    compareDiagnostics(actual, expected, options);
}

async function getDiagnosticsForDocument(
    document: TextDocument,
    options: IGetDiagnosticsOptions
): Promise<Diagnostic[]> {
    let dispose: Disposable;
    let timer: NodeJS.Timer;

    // Default to all sources
    let filterSources: Source[] = Array.from(Object.values(sources));

    if (options.includeSources) {
        filterSources = filterSources.filter(s => options.includeSources.find(s2 => s2.name == s.name));
    }
    if (options.ignoreSources) {
        filterSources = filterSources.filter(s => !(options.ignoreSources).includes(s));
    }

    // tslint:disable-next-line:typedef
    let diagnosticsPromise = new Promise<Diagnostic[]>((resolve, reject) => {
        let currentDiagnostics: Diagnostic[] | undefined;
        let complete: boolean;

        function pollDiagnostics(): void {
            currentDiagnostics = languages.getDiagnostics(document.uri);

            // Filter diagnostics according to sources filter
            let filteredDiagnostics = currentDiagnostics.filter(d => filterSources.find(s => d.source === s.name));

            // Find completion messages
            let completedSources:string[] = filteredDiagnostics.filter(d => d.message.startsWith(diagnosticsCompletePrefix)).map(d => d.source);

            // Remove completion messages
            filteredDiagnostics = filteredDiagnostics.filter(d => !d.message.startsWith(diagnosticsCompletePrefix));

            if (filterSources.every(s => completedSources.includes(s.name))) {
                complete = true;
                resolve(filteredDiagnostics);
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
                        new Error('Timed out waiting for diagnostics. Last retrieved diagnostics: '
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

    // ************* BREAKPOINT HERE TO INSPECT THE TEST FILE WITH DIAGNOSTICS IN THE VSCODE EDITOR
    //
    // But note: If you edit the template in the experimental instance, it won't update errors because
    //   the debugger is paused.

    if (dispose) {
        dispose.dispose();
    }

    if (timer) {
        clearTimeout(timer);
    }

    return diagnostics;
}

export async function getDiagnosticsForTemplate(
    templateContentsOrFileName: string | Partial<IDeploymentTemplate>,
    options?: IGetDiagnosticsOptions
): Promise<Diagnostic[]> {
    let templateContents: string | undefined;
    let fileToDelete: string | undefined;
    options = options || {};

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
        let templateObject: Partial<IDeploymentTemplate> = templateContentsOrFileName;
        templateContents = JSON.stringify(templateObject, null, 2);
    }

    // Add schema if not already present (to make it easier to write tests)
    if (!options.doNotAddSchema && !templateContents.includes('$schema')) {
        templateContents = templateContents.replace(/\s*{\s*/, '{\n"$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",\n');
    }

    if (options.search) {
        let newContents = templateContents.replace(options.search, options.replace);
        templateContents = newContents;
    }

    // Write to temp file
    let tempPath = getTempFilePath();
    fs.writeFileSync(tempPath, templateContents);
    fileToDelete = tempPath;

    let doc = await workspace.openTextDocument(tempPath);
    await window.showTextDocument(doc);

    let diagnostics: Diagnostic[] = await getDiagnosticsForDocument(doc, options);
    assert(!!diagnostics);

    // NOTE: Even though we request the editor to be closed,
    // there's no way to request the document actually be closed,
    //   and when you open it via an API, it doesn't close for a while,
    //   so the diagnostics won't go away
    // See https://github.com/Microsoft/vscode/issues/43056
    await commands.executeCommand('workbench.action.closeAllEditors');

    if (fileToDelete) {
        fs.unlinkSync(fileToDelete);
    }

    return diagnostics;
}

function diagnosticToString(diagnostic: Diagnostic, options: IGetDiagnosticsOptions, includeRange: boolean): string {
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

    // Do the expected messages include ranges?
    if (includeRange) {
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
    // Do the expected messages include ranges?
    let expectedHasRanges = expected.length === 0 || !!expected[0].match(/[0-9]+,[0-9]+-[0-9]+,[0-9]+/);
    let includeRanges = options.includeRange && expectedHasRanges;

    let actualAsStrings = actual.map(d => diagnosticToString(d, options, includeRanges));
    assert.deepStrictEqual(actualAsStrings, expected);
}
