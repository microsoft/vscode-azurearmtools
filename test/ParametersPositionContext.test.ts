// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-func-body-length s

import * as assert from 'assert';
import { __debugMarkPositionInString } from "../extension.bundle";
import { parseParametersWithMarkers } from "./support/parseTemplate";

suite("ParametersPositionContext", () => {
    suite("canAddPropertyHere", () => {

        /* parameterFileContents = Parameter file with <!true!> and <!false!> markers
            indicating where we expect a true or false return from canAddPropertyHere, e.g.:

                <!false!>{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {<!true!>
                    <!false!>"p1": {
                        "value": {
                            "abc": "def"
                        }<!true!>
                    <!false!>}
                }
            }
         */
        function testCanAddPropertyHere(
            testName: string,
            parameterFileWithMarkers: string,
        ): void {
            test(testName, async () => {
                // Make the true/false markers unique so we can pass them to parseParametersWithMarkers
                for (let marker of ['true', 'false']) {
                    for (let i = 1; ; ++i) {
                        // Add a unique integer to the first non-unique marker found
                        const newString = parameterFileWithMarkers.replace(`<!${marker}!>`, `<!${marker}${i}!>`);
                        if (newString === parameterFileWithMarkers) {
                            break;
                        } else {
                            parameterFileWithMarkers = newString;
                        }
                    }
                }

                const { dp, markers, unmarkedText } = await parseParametersWithMarkers(parameterFileWithMarkers);

                // Perform actual test at each possible position
                let expectedResultHere: boolean | undefined;
                for (let i = 0; i < unmarkedText.length; ++i) {
                    // Determine expected result
                    const matchingMarker: string | undefined = Object.getOwnPropertyNames(markers).find(key => markers[key].index === i);
                    if (matchingMarker) {
                        if (matchingMarker.startsWith('true')) {
                            expectedResultHere = true;
                        } else if (matchingMarker.startsWith('false')) {
                            expectedResultHere = false;
                        } else {
                            assert.fail(`Unexpected marker name "${matchingMarker}"`);
                        }
                    }

                    assert(expectedResultHere !== undefined, "Expected a marker at the beginning of the string");

                    const pc = dp.getContextFromDocumentCharacterIndex(i, undefined);

                    // Make test call
                    const actualResultHere = pc.canAddPropertyHere;

                    // Validate
                    assert.equal(
                        actualResultHere,
                        expectedResultHere,
                        `At index ${i}: ${__debugMarkPositionInString(unmarkedText, i)}`);
                }
            });
        }

        testCanAddPropertyHere(
            "No parameters section",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0"
        }`);

        testCanAddPropertyHere(
            "Empty parameters section with whitespace",
            `<!false!>{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {<!true!>}<!false!>
            }`);

        testCanAddPropertyHere(
            "Empty parameters section, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>}<!false!>`
            + `}`);

        testCanAddPropertyHere(
            "Empty parameters section with newline",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
            }<!false!>
        }`);

        testCanAddPropertyHere(
            "Empty parameters section with blank line",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>

            }<!false!>
        }`);

        testCanAddPropertyHere(
            "Empty parameters section with block comment, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>/<!false!>* comment */<!true!>}<!false!>`
            + `}`);

        testCanAddPropertyHere(
            "Empty parameters section with two block comments, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>/<!false!>* one */<!true!>/<!false!>* two */<!true!>}<!false!>`
            + `}`);

        testCanAddPropertyHere(
            "Empty parameters section with line comment",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
                /<!false!>/ This is a comment
<!true!>    }<!false!>
        }`);

        testCanAddPropertyHere(
            "Empty parameters section with two line comments",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
                /<!false!>/ This is a comment
<!true!>        /<!false!>/ This is a comment
<!true!>        }<!false!>
            }`);

        testCanAddPropertyHere(
            "Empty parameters section with block and line comments",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
                /<!false!>/ This is a comment
<!true!>
                /<!false!>* And this is another comment:
                    Hi, Mom */<!true!>

            }<!false!>
        }`);

        testCanAddPropertyHere(
            "Single parameter",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
                "<!false!>p1": {
                    "value": {
                        "abc": "def"
                    }
                }<!true!>
            }<!false!>
        }`);

        testCanAddPropertyHere(
            "Multiple parameters",
            `<!false!>{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {<!true!>
                    "<!false!>p1": {
                        "value": {
                            "abc": "def"
                        }
                    <!false!>}<!true!>,

                    "<!false!>p1": {
                        "value": "ghi"
                    }<!true!>
                }<!false!>
            }`);
    });
});
