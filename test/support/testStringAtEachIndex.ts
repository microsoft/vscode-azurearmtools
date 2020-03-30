/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { __debugMarkPositionInString } from '../../extension.bundle';
import { getDocumentMarkers } from "./parseTemplate";

// See testCanAddPropertyHere for example usage
export async function testStringAtEachIndex<T>(
    textWithMarkers: string,
    expectedValues: { [marker: string]: T },
    getTestResult: (text: string, index: number) => T
): Promise<void> {
    // Make the true/false markers unique so we can pass them to parseParametersWithMarkers
    for (let marker of Object.keys(expectedValues)) {
        for (let i = 1; ; ++i) {
            // Add a unique integer to the first non-unique marker found
            const newString = textWithMarkers.replace(`<!${marker}!>`, `<!${marker}$${i}!>`);
            if (newString === textWithMarkers) {
                break;
            } else {
                textWithMarkers = newString;
            }
        }
    }

    const { markers, unmarkedText } = getDocumentMarkers(textWithMarkers);

    // Perform actual test at each possible position
    let expectedResultHere: T | undefined;
    for (let i = 0; i < unmarkedText.length; ++i) {
        // Determine expected result
        const currentMarker: string | undefined = Object.getOwnPropertyNames(markers).find(key => markers[key].index === i);
        if (currentMarker) {
            const nonUniqueMarkerName = currentMarker.replace(/\$[0-9]+$/, '');
            if (!(nonUniqueMarkerName in expectedValues)) {
                assert.fail(`Unexpected marker name "${nonUniqueMarkerName}"`);
            }

            expectedResultHere = expectedValues[nonUniqueMarkerName];
        } else {
            if (i === 0) {
                assert.fail("Must have a marker at the very beginning of the string");
            }
        }

        // Make test call
        const actualResultHere: T = getTestResult(unmarkedText, i);

        // Validate
        assert.equal(
            actualResultHere,
            expectedResultHere,
            `At index ${i}: ${__debugMarkPositionInString(unmarkedText, i)}`);
    }
}
