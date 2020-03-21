// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-func-body-length s

import { Uri } from 'vscode';
import { DeploymentParameters } from '../extension.bundle';
import { testStringAtEachIndex } from './support/testStringAtEachIndex';

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
        function createCanAddPropertyHereTest(
            testName: string,
            parameterFileWithMarkers: string,
        ): void {
            test(testName, async () => {
                await testStringAtEachIndex(
                    parameterFileWithMarkers,
                    {
                        true: true,
                        false: false
                    },
                    (text: string, index: number) => {
                        const dp = new DeploymentParameters(text, Uri.file("test parameter file"));
                        const pc = dp.getContextFromDocumentCharacterIndex(index, undefined);
                        const canAddHere = pc.canAddPropertyHere;
                        return canAddHere;
                    }
                );
            });
        }

        createCanAddPropertyHereTest(
            "No parameters section",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0"
        }`);

        createCanAddPropertyHereTest(
            "Empty parameters section with whitespace",
            `<!false!>{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {<!true!>}<!false!>
            }`);

        createCanAddPropertyHereTest(
            "Empty parameters section, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>}<!false!>`
            + `}`);

        createCanAddPropertyHereTest(
            "Empty parameters section with newline",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
            }<!false!>
        }`);

        createCanAddPropertyHereTest(
            "Empty parameters section with blank line",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>

            }<!false!>
        }`);

        createCanAddPropertyHereTest(
            "Empty parameters section with block comment, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>/<!false!>* comment */<!true!>}<!false!>`
            + `}`);

        createCanAddPropertyHereTest(
            "Empty parameters section with two block comments, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>/<!false!>* one */<!true!>/<!false!>* two */<!true!>}<!false!>`
            + `}`);

        createCanAddPropertyHereTest(
            "Empty parameters section with line comment",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
                /<!false!>/ This is a comment
<!true!>    }<!false!>
        }`);

        createCanAddPropertyHereTest(
            "Empty parameters section with two line comments",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
                /<!false!>/ This is a comment
<!true!>        /<!false!>/ This is a comment
<!true!>        }<!false!>
            }`);

        createCanAddPropertyHereTest(
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

        createCanAddPropertyHereTest(
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

        createCanAddPropertyHereTest(
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
