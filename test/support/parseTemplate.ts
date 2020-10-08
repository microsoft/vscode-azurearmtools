// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { Uri } from 'vscode';
import { parseError } from 'vscode-azureextensionui';
import { DeploymentParametersDoc, DeploymentTemplateDoc, Issue } from "../../extension.bundle";
import { IDeploymentParametersFile, IPartialDeploymentTemplate } from './diagnostics';
import { resolveInTestFolder } from './resolveInTestFolder';
import { stringify } from "./stringify";

/**
 * Given a deployment template (string or object), parses it, optionally verifying expected diagnostic messages
 */
export async function parseTemplate(
    template: string | IPartialDeploymentTemplate,
    expectedDiagnosticMessages?: string[],
    options?: {
        fromFile?: boolean; // if true, template is a path
        ignoreWarnings?: boolean;
        includeDiagnosticLineNumbers?: boolean;
        replacements?: { [key: string]: string | { [key: string]: unknown } };
    }
): Promise<DeploymentTemplateDoc> {
    // Go ahead and allow markers in the document to be removed, we just won't mark them (makes it easier to share the same template in multiple places)
    const { dt } = await parseTemplateWithMarkers(template, expectedDiagnosticMessages, options);
    return dt;
}

interface Marker {
    name: string;
    index: number;
}

interface Markers {
    [markerName: string]: Marker;
}

/**
 * Pass in a template with positions marked using the notation <!tagname!>.  <!> is a shortcut for <!bang!>
 * Returns the parsed document without the tags, plus a dictionary of the tags and their positions
 */
// tslint:disable-next-line: no-suspicious-comment
// TODO: Make synchronous
// tslint:disable-next-line: no-suspicious-comment
export async function parseTemplateWithMarkers(
    template: string | IPartialDeploymentTemplate,
    expectedDiagnosticMessages?: string[],
    options?: {
        fromFile?: boolean; // if true, template is a path
        ignoreWarnings?: boolean;
        includeDiagnosticLineNumbers?: boolean;
        replacements?: { [key: string]: string | { [key: string]: unknown } };
    }
): Promise<{ dt: DeploymentTemplateDoc; markers: Markers }> {
    if (options?.fromFile) {
        const absPath = resolveInTestFolder(<string>template);
        const contents: string = fse.readFileSync(absPath).toString();
        template = contents;
    }

    const withReplacements = options?.replacements ? replaceInTemplate(template, options.replacements) : template;
    const { unmarkedText, markers } = getDocumentMarkers(withReplacements, options);
    const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc(unmarkedText, Uri.file("/parseTemplate template.json"));

    type DiagIssue = {
        line: number;
        msg: string;
        kind: 'Error' | 'Warning';
    };

    // Always run these even if not checking against expected, to verify nothing throws
    const errors: Issue[] = dt.getErrors(undefined);
    const warnings: Issue[] = dt.getWarnings();
    const errorMessages = errors.map(e => <DiagIssue>{ line: e.span.startIndex, msg: getMessage(e, true), kind: 'Error' });
    const warningMessages = warnings.map(e => <DiagIssue>{ line: e.span.startIndex, msg: getMessage(e, false), kind: 'Warning' });

    function getMessage(d: Issue, isError: boolean): string {
        const typeString = isError ? 'Error' : 'Warning';
        let msg = `${typeString}: ${d.message}`;
        if (options?.includeDiagnosticLineNumbers) {
            msg = `${dt.getDocumentPosition(d.span.startIndex).line + 1}: ${msg}`;
        }

        return msg;
    }

    if (expectedDiagnosticMessages) {
        let expected = errorMessages;
        if (!options || !options.ignoreWarnings) {
            expected = expected.concat(warningMessages);
        }
        const sortedExpectedDiag =
            expected.sort(
                options?.includeDiagnosticLineNumbers
                    ? (d1, d2): number => d1.line - d2.line
                    : undefined);
        const expectedMessages = sortedExpectedDiag.map(d => d.msg);

        assert.deepEqual(expectedMessages, expectedDiagnosticMessages);
    }

    return { dt, markers };
}

/**
 * Pass in a parameter file with positions marked using the notation <!tagname!>.  <!> is a shortcut for <!bang!>
 * Returns the parsed document without the tags, plus a dictionary of the tags and their positions
 */
export async function parseParametersWithMarkers(
    json: string | Partial<IDeploymentParametersFile>
): Promise<{ dp: DeploymentParametersDoc; unmarkedText: string; markers: Markers }> {
    const { unmarkedText, markers } = getDocumentMarkers(json);
    const dp: DeploymentParametersDoc = new DeploymentParametersDoc(unmarkedText, Uri.file("/test parameter file.json"));

    // Always run these even if not checking against expected, to verify nothing throws
    // tslint:disable-next-line:no-unused-expression
    dp.parametersObjectValue;
    // tslint:disable-next-line:no-unused-expression
    dp.parameterValueDefinitions;

    return { dp, unmarkedText, markers };
}

export function removeEOLMarker(s: string): string {
    // Remove {EOL} markers (as convenience for some test results expressed as strings to
    //   express in a literal string where the end of line is, etc.)
    return s.replace(/{EOL}/g, '');
}

/**
 * Pass in a template with positions marked using the notation <!tagname!>
 * Returns the document without the tags, plus a dictionary of the tags and their positions
 */
export function getDocumentMarkers(doc: object | string, options?: {}): { unmarkedText: string; markers: Markers } {
    let markers: Markers = {};
    doc = typeof doc === "string" ? doc : stringify(doc);
    let modified = doc;

    modified = removeEOLMarker(modified);

    // Change <!> to <!bang!>
    modified = modified.replace('<!>', '<!bang!>');

    // tslint:disable-next-line:no-constant-condition
    while (true) {
        let match: RegExpMatchArray | null = modified.match(/<!([a-zA-Z][a-zA-Z0-9$]*)!>/);
        if (!match) {
            break;
        }

        // tslint:disable-next-line:no-non-null-assertion // Tested above
        const index: number = match.index!;
        const name = match[1];
        const marker: Marker = { name, index };
        markers[marker.name] = marker;

        // Remove marker from the document
        modified = modified.slice(0, marker.index) + modified.slice(index + match[0].length);
    }

    const malformed =
        modified.match(/<?!?([a-zA-Z][a-zA-Z0-9]*)>!/)
        || modified.match(/!<([a-zA-Z][a-zA-Z0-9]*)!?>?/)
        || modified.match(/<!([a-zA-Z][a-zA-Z0-9]*)!?>?/)
        || modified.match(/<?!?([a-zA-Z][a-zA-Z0-9]*)!>/)
        ;
    if (malformed) {
        throw new Error(`Malformed marker "${malformed[0]}" in text: ${doc}`);
    }

    return {
        unmarkedText: modified,
        markers
    };
}

export function replaceInTemplate(
    template: string | IPartialDeploymentTemplate,
    replacements: { [key: string]: string | { [key: string]: unknown } }
): IPartialDeploymentTemplate {
    let templateString = stringify(template);

    // $REPLACE_PROP_LINE$
    function getPropLineReplacementString(s: string, addComma: boolean): string {
        const result = templateString.replace(
            /"\$REPLACE_PROP_LINE\$": "([^"]*)"\s*,?/g,
            // tslint:disable-next-line: no-any
            (_substring: string, ...args: any[]) => {
                const key = args[0];
                const replacement = replacements[key];
                assert(replacement !== undefined, `Replacement not specified for $REPLACE_PROP_LINE$ with key '${key}'`);
                if (typeof replacement === 'string') {
                    return replacement;
                }

                const props = Object.getOwnPropertyNames(replacement).map(
                    propName =>
                        `"${propName}": ${stringify(replacement[propName])}`)
                    .join(',');

                return addComma ? `${props},` : props;
            });
        return result;
    }

    // First try with comma
    try {
        const newTemplateWithComma = getPropLineReplacementString(templateString, true);
        return <IPartialDeploymentTemplate>JSON.parse(newTemplateWithComma);
    } catch (err) {
        // ignore
    }

    // Then try without comma
    try {
        const newTemplateWithoutComma = getPropLineReplacementString(templateString, false);
        return <IPartialDeploymentTemplate>JSON.parse(newTemplateWithoutComma);
    } catch (err) {
        throw new Error(`replaceInTemplate: Could not parse resulting template:\n${parseError(err).message}\nTemplate:\n${templateString}`);
    }
}
