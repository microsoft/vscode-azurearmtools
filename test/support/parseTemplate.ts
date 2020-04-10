// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { Uri } from 'vscode';
import { DeploymentParameters, DeploymentTemplate, Issue } from "../../extension.bundle";
import { IDeploymentParametersFile } from './diagnostics';
import { stringify } from "./stringify";

/**
 * Given a deployment template (string or object), parses it, optionally verifying expected diagnostic messages
 */
export async function parseTemplate(template: string | {}, expectedDiagnosticMessages?: string[], options?: { ignoreWarnings: boolean }): Promise<DeploymentTemplate> {
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
 * Pass in a template with positions marked using the notation <!tagname!>
 * Returns the parsed document without the tags, plus a dictionary of the tags and their positions
 */
export async function parseTemplateWithMarkers(
    template: string | {},
    expectedDiagnosticMessages?: string[],
    options?: { ignoreWarnings: boolean }
): Promise<{ dt: DeploymentTemplate; markers: Markers }> {
    const { unmarkedText, markers } = getDocumentMarkers(template);
    const dt: DeploymentTemplate = new DeploymentTemplate(unmarkedText, Uri.file("https://parseTemplate template"));

    // Always run these even if not checking against expected, to verify nothing throws
    const errors: Issue[] = await dt.getErrors(undefined);
    const warnings: Issue[] = dt.getWarnings();
    const errorMessages = errors.map(e => `Error: ${e.message}`);
    const warningMessages = warnings.map(e => `Warning: ${e.message}`);

    if (expectedDiagnosticMessages) {
        let expectedMessages = errorMessages;
        if (!options || !options.ignoreWarnings) {
            expectedMessages = expectedMessages.concat(warningMessages);
        }
        assert.deepStrictEqual(expectedMessages, expectedDiagnosticMessages);
    }

    return { dt, markers };
}

/**
 * Pass in a templateasdf with positions marked using the notation <!tagname!>
 * Returns the parsed document without the tags, plus a dictionary of the tags and their positions
 */
export async function parseParametersWithMarkers(
    json: string | Partial<IDeploymentParametersFile>
): Promise<{ dp: DeploymentParameters; unmarkedText: string; markers: Markers }> {
    const { unmarkedText, markers } = getDocumentMarkers(json);
    const dp: DeploymentParameters = new DeploymentParameters(unmarkedText, Uri.file("https://test parameter file"));

    // Always run these even if not checking against expected, to verify nothing throws asdf
    // const errors: Issue[] = await dt.errorsPromise;
    // const warnings: Issue[] = dt.warnings;
    // const errorMessages = errors.map(e => `Error: ${e.message}`);
    // const warningMessages = warnings.map(e => `Warning: ${e.message}`);

    return { dp, unmarkedText, markers };
}

/**
 * Pass in a template with positions marked using the notation <!tagname!>
 * Returns the document without the tags, plus a dictionary of the tags and their positions
 */
export function getDocumentMarkers(doc: object | string): { unmarkedText: string; markers: Markers } {
    let markers: Markers = {};
    doc = typeof doc === "string" ? doc : stringify(doc);
    let modified = doc;

    // tslint:disable-next-line:no-constant-condition
    while (true) {
        let match: RegExpMatchArray | null = modified.match(/<!([a-zA-Z][a-zA-Z0-9]*)!>/);
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

    // Also look for shortcut marker "!" with id "bang" used in some tests
    let bangIndex = modified.indexOf('!');
    if (bangIndex >= 0) {
        markers.bang = { name: 'bang', index: bangIndex };
        modified = modified.slice(0, bangIndex) + modified.slice(bangIndex + 1);
    }

    const malformed =
        modified.match(/<?!?([a-zA-Z][a-zA-Z0-9]*)>!/)
        || modified.match(/!<([a-zA-Z][a-zA-Z0-9]*)!?>?/)
        || modified.match(/<!?([a-zA-Z][a-zA-Z0-9]*)!?>/)
        || modified.match(/<?!([a-zA-Z][a-zA-Z0-9]*)!>?/)
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
