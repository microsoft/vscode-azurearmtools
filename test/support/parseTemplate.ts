// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { DeploymentTemplate, Issue } from "../../extension.bundle";
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
    const { text: templateWithoutMarkers, markers } = getDocumentMarkers(template);
    const dt: DeploymentTemplate = new DeploymentTemplate(templateWithoutMarkers, "parseTemplate() template");

    // Always run these even if not checking against expected, to verify nothing throws
    const errors: Issue[] = await dt.errorsPromise;
    const warnings: Issue[] = dt.warnings;
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
 * Pass in a template with positions marked using the notation <!tagname!>
 * Returns the document without the tags, plus a dictionary of the tags and their positions
 */
export function getDocumentMarkers(template: object | string): { text: string; markers: Markers } {
    let markers: Markers = {};
    template = typeof template === "string" ? template : stringify(template);

    // tslint:disable-next-line:no-constant-condition
    while (true) {
        let match: RegExpMatchArray | null = template.match(/<!([a-zA-Z][a-zA-Z0-9]*)!>/);
        if (!match) {
            break;
        }

        // tslint:disable-next-line:no-non-null-assertion // Tested above
        const index: number = match.index!;
        const name = match[1];
        const marker: Marker = { name, index };
        markers[marker.name] = marker;

        // Remove marker from the document
        template = template.slice(0, marker.index) + template.slice(index + match[0].length);
    }

    // Also look for shortcut marker "!" with id "bang" used in some tests
    let bangIndex = template.indexOf('!');
    if (bangIndex >= 0) {
        markers.bang = { name: 'bang', index: bangIndex };
        template = template.slice(0, bangIndex) + template.slice(bangIndex + 1);
    }

    return {
        text: template,
        markers
    };
}
