// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
const DEBUG_BREAK_AFTER_DIAGNOSTICS_COMPLETE = false;

// tslint:disable:no-unused-expression no-console no-string-based-set-timeout
// tslint:disable:insecure-random max-func-body-length radix prefer-template
// tslint:disable:object-literal-key-quotes no-http-string non-literal-fs-path
// tslint:disable:no-non-null-assertion

import * as assert from "assert";
import * as fs from 'fs';
import * as path from 'path';
import { Diagnostic, DiagnosticSeverity, Disposable, languages, TextDocument } from "vscode";
import { diagnosticsCompletePrefix, expressionsDiagnosticsSource, ExpressionType, ext, LanguageServerState, languageServerStateSource } from "../../extension.bundle";
import { DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { stringify } from "./stringify";
import { TempDocument, TempEditor, TempFile } from "./TempFile";

export const diagnosticsTimeout = 2 * 60 * 1000; // CONSIDER: Use this long timeout only for first test, or for suite setup
export const testFolder = path.join(__dirname, '..', '..', '..', 'test');

export interface Source {
    name: string;
}
export const sources = {
    expressions: { name: expressionsDiagnosticsSource },
    schema: { name: 'arm-template (schema)' },
    syntax: { name: 'arm-template (syntax)' },
    template: { name: 'arm-template (validation)' },
};

function isSourceFromLanguageServer(source: Source): boolean {
    return source.name !== sources.expressions.name;
}

export interface IDeploymentParameterDefinition {
    // tslint:disable-next-line:no-reserved-keywords
    type: ExpressionType | string;
    metadata?: {
        [key: string]: string | undefined;
        description?: string;
    };
    maxLength?: number;
    minLength?: number;
    defaultValue?: number | unknown[] | string | {};
    allowedValues?: (number | unknown[] | string | {})[];
}

export interface IDeploymentOutput {
    // tslint:disable-next-line:no-reserved-keywords
    type: ExpressionType | string;
    value: number | unknown[] | string | {};
}

export interface IDeploymentFunctionDefinition {
    parameters?:
    {
        name: string;
        // tslint:disable-next-line: no-reserved-keywords
        type: ExpressionType | string;
    }[];
    output?: IDeploymentOutput;
}

export interface IDeploymentNamespaceDefinition {
    namespace: string;
    members: {
        [key: string]: IDeploymentFunctionDefinition;
    };
}

export interface IDeploymentParameterValue {
    value: unknown;
}

export interface IDeploymentParametersFile {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#";
    contentVersion: string;
    parameters?: {
        [key: string]: IDeploymentParameterValue;
    };
}

export interface IDeploymentTemplate {
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" | "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"
    | string;
    contentVersion: string;
    apiProfile?: string;
    parameters?: {
        [key: string]: IDeploymentParameterDefinition;
    };
    variables?: {
        copy?: {
            name: string;
            count: number;
            input: string | {};
        }[];
        [key: string]: number | unknown[] | string | {} | undefined;
    };
    resources: IDeploymentTemplateResource[];
    outputs?: {
        [key: string]: IDeploymentOutput;
    };
    functions?: IDeploymentNamespaceDefinition[];
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
    waitForChange?: boolean;   // Wait until diagnostics change before retrieving themed
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

export async function getDiagnosticsForDocument(
    document: TextDocument,
    options: IGetDiagnosticsOptions
): Promise<Diagnostic[]> {
    let dispose: Disposable | undefined;
    let timer: NodeJS.Timer | undefined;

    // Default to all sources
    let filterSources: Source[] = Array.from(Object.values(sources));

    if (options.includeSources) {
        filterSources = filterSources.filter(s => options.includeSources!.find(s2 => s2.name === s.name));
    }
    if (options.ignoreSources) {
        filterSources = filterSources.filter(s => !(options.ignoreSources!).includes(s));
    }

    const includesLanguageServerSource = filterSources.some(isSourceFromLanguageServer);
    if (includesLanguageServerSource && DISABLE_LANGUAGE_SERVER) {
        throw new Error("DISABLE_LANGUAGE_SERVER is set, but this test is trying to include a non-expressions diagnostic source");
    }

    // tslint:disable-next-line:typedef promise-must-complete // (false positive for promise-must-complete)
    let diagnosticsPromise = new Promise<Diagnostic[]>((resolve, reject) => {
        let currentDiagnostics: Diagnostic[] | undefined;

        function pollDiagnostics(): { diagnostics: Diagnostic[]; sourceCompletionVersions: { [source: string]: number } } {
            const sourceCompletionVersions: { [source: string]: number } = {};

            currentDiagnostics = languages.getDiagnostics(document.uri);

            // Filter out any language server state diagnostics
            currentDiagnostics = currentDiagnostics.filter(d => d.source !== languageServerStateSource);

            // Filter diagnostics according to sources filter
            let filteredDiagnostics = currentDiagnostics.filter(d => filterSources.find(s => d.source === s.name));

            // Find completion messages
            for (let d of filteredDiagnostics) {
                if (d.message.startsWith(diagnosticsCompletePrefix)) {
                    const version = Number(d.message.match(/version ([0-9]+)/)![1]);
                    sourceCompletionVersions[d.source!] = version;
                }
            }

            // Remove completion messages
            filteredDiagnostics = filteredDiagnostics.filter(d => !d.message.startsWith(diagnosticsCompletePrefix));

            if (includesLanguageServerSource) {
                if (ext.languageServerState === LanguageServerState.Failed) {
                    throw new Error("Language server failed to start");
                }
            }

            return { diagnostics: filteredDiagnostics, sourceCompletionVersions };
        }

        function areAllSourcesComplete(sourceCompletionVersions: { [source: string]: number }): boolean {
            for (let source of filterSources) {
                const completionVersion = sourceCompletionVersions[source.name];
                if (completionVersion === undefined) {
                    return false;
                }
                if (requiredSourceCompletionVersions[source.name] !== undefined
                    && completionVersion < requiredSourceCompletionVersions[source.name]) {
                    return false;
                }
            }

            return true;
        }

        const initialResults = pollDiagnostics();
        const requiredSourceCompletionVersions = Object.assign({}, initialResults.sourceCompletionVersions);
        if (options.waitForChange) {
            // tslint:disable-next-line:no-for-in forin
            for (let source in requiredSourceCompletionVersions) {
                requiredSourceCompletionVersions[source] = requiredSourceCompletionVersions[source] + 1;
            }
        }

        if (areAllSourcesComplete(initialResults.sourceCompletionVersions)) {
            resolve(initialResults.diagnostics);
            return;
        }

        // Now only poll on changed events
        console.log("Waiting for diagnostics to complete...");
        timer = setTimeout(
            () => {
                reject(
                    new Error('Timed out waiting for diagnostics. Last retrieved diagnostics: '
                        + (currentDiagnostics ? currentDiagnostics.map(d => d.message).join('\n') : "None")));
            },
            diagnosticsTimeout);
        dispose = languages.onDidChangeDiagnostics(e => {
            const results = pollDiagnostics();
            if (areAllSourcesComplete(results.sourceCompletionVersions)) {
                resolve(results.diagnostics);
            }
        });
    });

    let diagnostics = await diagnosticsPromise;
    assert(diagnostics);

    if (DEBUG_BREAK_AFTER_DIAGNOSTICS_COMPLETE) {
        // tslint:disable-next-line:no-debugger
        debugger;
        // ************* BREAKPOINT HERE TO INSPECT THE TEST FILE WITH DIAGNOSTICS IN THE VSCODE EDITOR
        //
        // But note: If you edit the template in the experimental instance, it won't update errors because
        //   the debugger is paused.
    }

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
    // tslint:disable-next-line: strict-boolean-expressions
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
        // It's a (flying?) object
        let templateObject: Partial<IDeploymentTemplate> = templateContentsOrFileName;
        templateContents = stringify(templateObject);
    }

    // Add schema if not already present (to make it easier to write tests)
    if (!options.doNotAddSchema && !templateContents.includes('$schema')) {
        templateContents = templateContents.replace(/\s*{\s*/, '{\n"$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",\n');
    }

    if (options.search) {
        let newContents = templateContents.replace(options.search, options.replace!);
        templateContents = newContents;
    }

    const tempFile = new TempFile(templateContents);
    const document = new TempDocument(tempFile);
    const editor = new TempEditor(document);
    await editor.open();

    let diagnostics: Diagnostic[] = await getDiagnosticsForDocument(document.realDocument, options);
    assert(diagnostics);

    await editor.dispose();
    return diagnostics;
}

function diagnosticToString(diagnostic: Diagnostic, options: IGetDiagnosticsOptions, includeRange: boolean): string {
    assert(diagnostic.code === '', `Expecting empty code for all diagnostics, instead found Code="${String(diagnostic.code)}" for "${diagnostic.message}"`);

    let severity: string = "";
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
        // tslint:disable-next-line: strict-boolean-expressions
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
    let includeRanges = !!options.includeRange && expectedHasRanges;

    let actualAsStrings = actual.map(d => diagnosticToString(d, options, includeRanges));

    // Sort
    expected = expected.sort();
    actualAsStrings = actualAsStrings.sort();

    assert.deepStrictEqual(actualAsStrings, expected);
}
