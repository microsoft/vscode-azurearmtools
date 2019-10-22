// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { DeploymentTemplate } from "../../extension.bundle";
import { Issue } from '../../src/Language';
import { stringify } from "./stringify";

export async function parseTemplate(template: string | {}, expected?: string[], options?: { ignoreWarnings: boolean }): Promise<DeploymentTemplate> {
    const json = typeof template === "string" ? template : stringify(template);
    const dt = new DeploymentTemplate(json, "id");

    // Always run these even if not checking against expected, to verify nothing throws
    const errors: Issue[] = await dt.errorsPromise;
    const warnings: Issue[] = dt.warnings;
    const errorMessages = errors.map(e => `Error: ${e.message}`);
    const warningMessages = warnings.map(e => `Warning: ${e.message}`);

    if (expected) {
        let expectedMessages = errorMessages;
        if (!options || !options.ignoreWarnings) {
            expectedMessages = expectedMessages.concat(warningMessages);
        }
        assert.deepStrictEqual(expectedMessages, expected);
    }

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
    expected?: string[],
    options?: { ignoreWarnings: boolean }
): Promise<{ dt: DeploymentTemplate; markers: Markers }> {
    const { text: templateWithoutMarkers, markers } = getDocumentMarkers(template);
    const dt: DeploymentTemplate = await parseTemplate(templateWithoutMarkers, expected, options);

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

    return {
        text: template,
        markers
    };
}
