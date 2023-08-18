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

import { parseError } from "@microsoft/vscode-azext-utils";
import * as assert from "assert";
import * as fse from "fs-extra";
import * as path from 'path';
import { Diagnostic, DiagnosticSeverity, Disposable, languages, Position, Range, TextDocument, Uri } from "vscode";
import { backendValidationDiagnosticsSource, diagnosticsCompletePrefix, expressionsDiagnosticsSource, ExpressionType, ext, LanguageServerState, languageServerStateSource, readUtf8FileWithBom } from "../../extension.bundle";
import { bail } from "../global.test";
import { DEFAULT_TESTCASE_TIMEOUT_MS, DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { delay } from "./delay";
import { mapParameterFile } from "./mapParameterFile";
import { parseParametersWithMarkers } from "./parseTemplate";
import { positionToString, rangeToString } from "./rangeToString";
import { resolveInTestFolder } from "./resolveInTestFolder";
import { stringify } from "./stringify";
import { TempDocument, TempEditor, TempFile } from "./TempFile";
import { writeToLog } from "./testLog";

export const defaultDiagnosticsTimeoutMs = DEFAULT_TESTCASE_TIMEOUT_MS - 2000;

export type TransformDiagnosticMessage = (msg: string) => string;

export interface ICompareDiagnosticsOptions {
    transformResults?: TransformDiagnosticMessage;
}

enum ExpectedDiagnosticSeverity {
    Warning = 4,
    Error = 8,
}

enum IncludeRange {
    no,
    range,
    position,
}

// In the style of the Copy context menu in vscode
export interface IExpectedDiagnostic {
    message: string;
    severity: ExpectedDiagnosticSeverity;
    source: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
}

export type ExpectedDiagnostics = string[] | IExpectedDiagnostic[];

export interface DiagnosticSource {
    name: string;
}
export const diagnosticSources = {
    expressions: { name: expressionsDiagnosticsSource },
    schema: { name: 'arm-template (schema)' },
    syntax: { name: 'arm-template (syntax)' },
    backendValidation: { name: backendValidationDiagnosticsSource },
};

function isSourceFromLanguageServer(source: DiagnosticSource): boolean {
    return source.name !== diagnosticSources.expressions.name;
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
    maxValue?: number;
    minValue?: number;
    defaultValue?: number | unknown[] | string | {};
    allowedValues?: (number | unknown[] | string | {})[];
}

export interface IDeploymentOutput {
    // tslint:disable-next-line:no-reserved-keywords
    type: ExpressionType | string;
    value?: number | unknown[] | string | {};
    copy?: {
        count: string;
        input: string;
    };
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
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#" | "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#";
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

export interface IPartialDeploymentTemplate {
    "$schema"?: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" | "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"
    | string;
    contentVersion?: string;
    apiProfile?: string;
    parameters?: {
        [key: string]: Partial<IDeploymentParameterDefinition>;
    };
    variables?: {
        copy?: {
            name: string;
            count: number;
            input: string | {};
        }[];
        [key: string]: number | unknown[] | string | {} | undefined;
    };
    resources?: IPartialDeploymentTemplateResource[];
    outputs?: {
        [key: string]: Partial<IDeploymentOutput>;
    };
    functions?: Partial<IDeploymentNamespaceDefinition>[];
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
    apiVersion?: string;
    location?: string;
    dependsOn?: string[];
    tags?: { [key: string]: string } | string;
    properties?: { [key: string]: unknown };
    resources?: IDeploymentTemplateChildResource[];
    [key: string]: unknown;
}

export interface IDeploymentTemplateChildResource {
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
    name: string;
    apiVersion: string;
    location?: string;
    dependsOn?: string[];
    tags?: { [key: string]: string } | string;
    properties?: { [key: string]: unknown };
    resources?: IDeploymentTemplateResource[];
    [key: string]: unknown;
}

export interface IPartialDeploymentTemplateResource {
    // tslint:disable-next-line:no-reserved-keywords
    type?: string;
    name?: string;
    apiVersion?: string;
    location?: string;
    dependsOn?: string[];
    tags?: { [key: string]: string } | string;
    properties?: { [key: string]: unknown };
    resources?: IPartialDeploymentTemplateResource[];
    [key: string]: unknown;
}

// tslint:disable-next-line:no-empty-interface
export type ITestDiagnosticsOptions = IGetDiagnosticsOptions & ICompareDiagnosticsOptions;

export interface IGetDiagnosticsOptions {
    /**
     * Timeout in milliseconds
     */
    timeoutMs?: number;
    /**
     * Parameters that will be placed into a temp file and associated with the template file
     */
    parameters?: string | Partial<IDeploymentParametersFile>;
    /**
     * A parameter file that will be associated with the template file
     */
    parametersFile?: string;
    /**
     * Error sources to include in the comparison - defaults to all
     */
    includeSources?: DiagnosticSource[];
    /**
     * Error sources to ignore in the comparison - defaults to ignoring none
     */
    ignoreSources?: DiagnosticSource[];
    /**
     * Ignore informational diagnostics
     */
    ignoreInfos?: boolean;
    /**
     * defaults to false - whether to include the error range in the results for comparison (if true, ignored when expected messages don't have ranges)
     */
    includeRange?: boolean;
    /**
     * defaults to false - whether to include the error start position in the results for comparison (if true, ignored when expected messages don't have start positions)
     */
    includePositions?: boolean;
    /**
     * Run a replacement using this regex and replacement on the file/contents before testing for errors
     */
    search?: RegExp;
    /**
     * Run a replacement using this regex and replacement on the file/contents before testing for errors
     */
    replace?: string;
    /**
     * Don't add schema (testDiagnostics only) automatically
     */
    doNotAddSchema?: boolean;
    /**
     * Wait until the diagnostics version of all sources changes before retrieving themed.  Without this, it just waits until all diagnostics indicate they're complete.
     * NOTE: If previousResults are passed in, waitForChange is assumed true
     */
    waitForChange?: boolean;

    /**
     * If specified, wait for the filter to return true as well as the normal tests before considering the diagnostics complete
     */
    waitForDiagnosticsFilter?(results: IDiagnosticsResults): boolean | Promise<boolean>;
}

export async function testDiagnosticsFromFile(filePath: string | Partial<IDeploymentTemplate>, options: ITestDiagnosticsOptions, expected: ExpectedDiagnostics): Promise<void> {
    await testDiagnosticsCore(async () => await getDiagnosticsForTemplate(filePath, 1, options), options, expected);
}

export async function testDiagnostics(templateContentsOrFileName: string | Partial<IDeploymentTemplate>, options: ITestDiagnosticsOptions, expected: ExpectedDiagnostics): Promise<void> {
    await testDiagnosticsCore(async () => await getDiagnosticsForTemplate(templateContentsOrFileName, 1, options), options, expected);
}

async function testDiagnosticsCore(getDiagnostics: () => Promise<IDiagnosticsResults>, options: ITestDiagnosticsOptions, expected: ExpectedDiagnostics): Promise<void> {
    const actual: IDiagnosticsResults = await getDiagnostics();
    compareDiagnostics(actual.diagnostics, expected, options);
}

export async function testDiagnosticsFromUri(documentUri: Uri, options: ITestDiagnosticsOptions, expected: ExpectedDiagnostics): Promise<void> {
    await testDiagnosticsCore(async () => await getDiagnosticsForDocument(documentUri, 1, options), options, expected);
}

export interface IDiagnosticsResults {
    diagnostics: Diagnostic[];
    sourceCompletionVersions: { [source: string]: number };
}

export async function getDiagnosticsForDocument(
    document: TextDocument | Uri,
    expectedMinimumVersionForEachSource: number,
    options: IGetDiagnosticsOptions,
    previousResults?: IDiagnosticsResults // If specified, will wait until the versions change and are completed
): Promise<IDiagnosticsResults> {
    const documentUri = document instanceof Uri ? document : document.uri;

    let dispose: Disposable | undefined;
    let timer: NodeJS.Timer | undefined;

    // Default to all sources
    let filterSources: DiagnosticSource[] = Array.from(Object.values(diagnosticSources));

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

    const timeoutMs = options.timeoutMs ?? defaultDiagnosticsTimeoutMs;

    // eslint-disable-next-line no-async-promise-executor -- CONSIDER: working, so leaving for now
    const diagnosticsPromise = new Promise<IDiagnosticsResults>(async (resolve, reject): Promise<void> => {
        try {
            let currentDiagnostics: Diagnostic[] | undefined;

            function getCurrentDiagnostics(): IDiagnosticsResults {
                const sourceCompletionVersions: { [source: string]: number } = {};

                currentDiagnostics = languages.getDiagnostics(documentUri);

                // Filter out any language server state diagnostics
                currentDiagnostics = currentDiagnostics.filter(d => d.source !== languageServerStateSource);

                // Filter diagnostics according to sources filter
                let filteredDiagnostics = currentDiagnostics.filter(d => filterSources.find(s => d.source === s.name));

                if (options.ignoreInfos) {
                    filteredDiagnostics = filteredDiagnostics.filter(d => d.message.startsWith(diagnosticsCompletePrefix) || d.severity !== DiagnosticSeverity.Information);
                }

                // Find completion messages
                for (const d of filteredDiagnostics) {
                    if (d.message.startsWith(diagnosticsCompletePrefix)) {
                        const version = Number(d.message.match(/version ([0-9]+)/)![1]);
                        sourceCompletionVersions[d.source!] = version;
                    }
                }

                // Remove completion messages
                filteredDiagnostics = filteredDiagnostics.filter(d => !d.message.startsWith(diagnosticsCompletePrefix));

                if (includesLanguageServerSource) {
                    if (ext.languageServerState === LanguageServerState.Failed) {
                        throw new Error(`Language server failed on start-up: ${ext.languageServerStartupError}`);
                    } else if (ext.languageServerState === LanguageServerState.Stopped) {
                        throw new Error(`Language server is in stopped state`);
                    }
                }

                return { diagnostics: filteredDiagnostics, sourceCompletionVersions };
            }

            function areAllSourcesComplete(sourceCompletionVersions: { [source: string]: number }): boolean {
                for (const source of filterSources) {
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

            async function diagnosticsFilterPasses(results: IDiagnosticsResults): Promise<boolean> {
                if (options.waitForDiagnosticsFilter) {
                    const filterValue = await options.waitForDiagnosticsFilter(results);
                    return filterValue;
                }

                return true;
            }

            const currentResults: IDiagnosticsResults = previousResults ?? getCurrentDiagnostics();
            const requiredSourceCompletionVersions = Object.assign({}, currentResults.sourceCompletionVersions);
            if (options.waitForChange || previousResults) {
                // tslint:disable-next-line:no-for-in forin
                for (const source in requiredSourceCompletionVersions) {
                    requiredSourceCompletionVersions[source] = requiredSourceCompletionVersions[source] + 1;
                }
            }

            if (areAllSourcesComplete(currentResults.sourceCompletionVersions) && await diagnosticsFilterPasses(currentResults)) {
                resolve(currentResults);
                return;
            }

            // Now only poll on changed events
            writeToLog("Waiting for diagnostics to complete...");
            let done = false;
            timer = setTimeout(
                () => {
                    bail();
                    reject(
                        new Error('Timed out waiting for diagnostics. Last retrieved diagnostics: '
                            + (currentDiagnostics ? currentDiagnostics.map(d => d.message).join('\n') : "None")));
                    done = true;
                },
                timeoutMs);

            while (!done) {
                const results = getCurrentDiagnostics();
                if (areAllSourcesComplete(results.sourceCompletionVersions) && await diagnosticsFilterPasses(results)) {
                    resolve(results);
                    done = true;
                }
                await delay(100);
            }
        } catch (err) {
            reject(err);
        }
    });

    const diagnostics = await diagnosticsPromise;

    if (DEBUG_BREAK_AFTER_DIAGNOSTICS_COMPLETE) {
        // eslint-disable-next-line no-debugger
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

    writeToLog(`Diagnostics complete:  ${stringify(diagnostics)}`);

    // Verify the version of expectedMinimumVersionForEachSource
    for (const source of Object.getOwnPropertyNames(diagnostics.sourceCompletionVersions)) {
        if (!(diagnostics.sourceCompletionVersions[source] >= expectedMinimumVersionForEachSource)) {
            assert.fail(`Expected diagnostics source to be at least 3, but found ${stringify(diagnostics)}`);
        }
    }

    return diagnostics;
}

export async function getDiagnosticsForTemplate(
    templateContentsOrFileName: string | Partial<IDeploymentTemplate>,
    expectedMinimumVersionForEachSource: number,
    options?: IGetDiagnosticsOptions
): Promise<IDiagnosticsResults> {
    let templateContents: string | undefined;
    let templateFile: TempFile | undefined;
    let paramsFile: TempFile | undefined;
    let editor: TempEditor | undefined;

    try {
        // tslint:disable-next-line: strict-boolean-expressions
        options = options || {};

        if (typeof templateContentsOrFileName === 'string') {
            if (templateContentsOrFileName.match(/\.jsonc?$/)) {
                // It's a filename
                const sourcePath = resolveInTestFolder(templateContentsOrFileName);
                templateFile = TempFile.fromExistingFile(sourcePath);
            } else {
                // It's a content string
                templateContents = templateContentsOrFileName;
            }
        } else {
            // It's a (flying?) object
            const templateObject: Partial<IDeploymentTemplate> = templateContentsOrFileName;
            templateContents = stringify(templateObject);
        }

        // Search/relace needs a content string (at least for now)
        if (options.search && !templateContents && templateFile) {
            templateContents = await readUtf8FileWithBom(templateFile.fsPath);
            templateFile = undefined;
        }

        if (!templateFile) {
            assert(templateContents);
            // Add schema if not already present (to make it easier to write tests)
            if (!options.doNotAddSchema && !templateContents.includes('$schema')) {
                templateContents = templateContents.replace(/\s*{\s*/, '{\n"$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",\n');
            }

            if (options.search) {
                const newContents = templateContents.replace(options.search, options.replace!);
                templateContents = newContents;
            }

            templateFile = TempFile.fromContents(templateContents, '.json');
        }

        const document = new TempDocument(templateFile);

        // Parameter file
        if (options.parameters || options.parametersFile) {
            if (options.parameters) {
                const { unmarkedText: unmarkedParams } = parseParametersWithMarkers(options.parameters);
                paramsFile = TempFile.fromContents(unmarkedParams);
            } else {
                assert(options.parametersFile);

                // First try relative to the template file
                let absPath: string = path.join(path.dirname(templateFile.fsPath), options.parametersFile);
                if (!fse.pathExistsSync(absPath)) {
                    absPath = resolveInTestFolder(options.parametersFile!);
                }

                assert(fse.pathExistsSync(absPath), `Couldn't find parameter file ${absPath}`);
                paramsFile = TempFile.fromExistingFile(absPath);
            }

            // Map template to params
            await mapParameterFile(templateFile.uri, paramsFile.uri);
        }

        editor = new TempEditor(document);
        await editor.open();

        const diagnostics: IDiagnosticsResults = await getDiagnosticsForDocument(document.realDocument, expectedMinimumVersionForEachSource, options);
        assert(diagnostics);

        await editor.dispose();
        return diagnostics;
    } finally {
        if (editor) {
            await editor.dispose();
        }

        if (templateFile) {
            // Unmap template file
            await mapParameterFile(templateFile.uri, undefined, false);
            templateFile.dispose();
        }
        if (paramsFile) {
            paramsFile.dispose();
        }
    }
}

export function expectedDiagnosticToString(diagnostic: IExpectedDiagnostic): string {
    return diagnosticToString(
        {
            message: diagnostic.message,
            range: new Range(
                new Position(diagnostic.startLineNumber, diagnostic.startColumn),
                new Position(diagnostic.endLineNumber, diagnostic.endColumn)
            ),
            severity: diagnostic.severity === ExpectedDiagnosticSeverity.Error ? DiagnosticSeverity.Error
                : diagnostic.severity === ExpectedDiagnosticSeverity.Warning ? DiagnosticSeverity.Warning
                    : <DiagnosticSeverity>-1,
            source: diagnostic.source,
            code: ""
        },
        {},
        IncludeRange.range);
}

export function diagnosticToString(diagnostic: Diagnostic, options: IGetDiagnosticsOptions, includeRange: IncludeRange): string {
    assert(diagnostic.code === '', `Expecting empty code for all diagnostics, instead found Code="${String(diagnostic.code)}" for "${diagnostic.message}"`);

    let severity: string = "";
    switch (diagnostic.severity) {
        case DiagnosticSeverity.Error: severity = "Error"; break;
        case DiagnosticSeverity.Warning: severity = "Warning"; break;
        case DiagnosticSeverity.Information: severity = "Information"; break;
        case DiagnosticSeverity.Hint: severity = "Hint"; break;
        default: assert.fail(`Expected severity ${diagnostic.severity}`);
    }

    let s = `${severity}: ${diagnostic.message} (${diagnostic.source})${maybeRange(diagnostic.range)}`;
    if (diagnostic.relatedInformation) {
        const related = diagnostic.relatedInformation[0];
        s = `${s} [${related.message}]${maybeRange(related.location.range)}`;
    }

    return s;

    function maybeRange(range: Range | undefined): string {
        // Do the expected messages include ranges?
        if (includeRange === IncludeRange.range) {
            return ' ' + rangeToString(range);
        } else if (includeRange === IncludeRange.position) {
            return ' ' + positionToString(range?.start);
        } else {
            return "";
        }
    }
}

function compareDiagnostics(actual: Diagnostic[], expected: ExpectedDiagnostics, options: ITestDiagnosticsOptions): void {
    transformResults(actual, options);

    // Do the expected messages include ranges?
    const expectedHasRanges = expected.length === 0 ||
        (typeof expected[0] === 'string' && !!expected[0].match(/\[[0-9]+,[0-9]+-[0-9]+,[0-9]+\]/)
            || (typeof expected[0] !== 'string' && expected[0].startLineNumber !== undefined));
    const expectedHasPositions = expected.length > 0 &&
        (typeof expected[0] === 'string' && !!expected[0].match(/\[[0-9]+,[0-9]+\]/));
    const includeRange: IncludeRange = (!!options.includeRange || expectedHasRanges) ? IncludeRange.range
        : (!!options.includePositions || expectedHasPositions) ? IncludeRange.position
            : IncludeRange.no;

    let expectedAsStrings = expected.length === 0 ? []
        : typeof expected[0] === 'string' ? expected
            : (<IExpectedDiagnostic[]>expected).map(d => typeof d === 'string' ? d : expectedDiagnosticToString(d));
    let actualAsStrings = actual.map(d => diagnosticToString(d, options, includeRange));

    // Sort
    expectedAsStrings = expectedAsStrings.sort();
    actualAsStrings = actualAsStrings.sort();

    try {
        assert.deepStrictEqual(actualAsStrings, expectedAsStrings);
    } catch (err) {
        // Test engine reporting doesn't handle very long error messages
        const msgMax = 5000;
        let msg = parseError(err).message;
        if (msg.length > msgMax) {
            msg = `${msg.slice(0, msgMax)}\n...(more)`;
        }

        throw new Error(msg);
    }
}
function transformResults(results: Diagnostic[], options: ICompareDiagnosticsOptions): void {
    if (options.transformResults) {
        for (const result of results) {
            result.message = options.transformResults(result.message);
        }
    }
}

export function simplifyBadTypeResourceMessage(msg: string): string {
    return msg.replace(/Value must be one of the following values: [a-zA-Z0-9-, "./]+/, "Value must be one of the following values: {...}");
}
