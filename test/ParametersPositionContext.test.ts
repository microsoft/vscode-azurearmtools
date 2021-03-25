// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-func-body-length s

import { Uri } from 'vscode';
import { canAddPropertyValueHere, DeploymentParametersDoc } from '../extension.bundle';
import { testStringAtEachIndex } from './support/testStringAtEachIndex';

suite("ParametersPositionContext", () => {
    suite("canAddPropertyValueHere", () => {
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
        function createCanAddPropertyValueHereTest(
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
                        const dp = new DeploymentParametersDoc(text, Uri.file("test parameter file"), 0);
                        const pc = dp.getContextFromDocumentCharacterIndex(index, undefined);
                        const canAddHere = canAddPropertyValueHere(pc.document.topLevelParameterValuesSource, pc.documentCharacterIndex);
                        return canAddHere;
                    }
                );
            });
        }

        createCanAddPropertyValueHereTest(
            "No parameters section",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0"
        }`);

        createCanAddPropertyValueHereTest(
            "Empty parameters section with whitespace",
            `<!false!>{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {<!true!>}<!false!>
            }`);

        createCanAddPropertyValueHereTest(
            "Empty parameters section, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>}<!false!>`
            + `}`);

        createCanAddPropertyValueHereTest(
            "Empty parameters section with newline",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
            }<!false!>
        }`);

        createCanAddPropertyValueHereTest(
            "Empty parameters section with blank line",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>

            }<!false!>
        }`);

        createCanAddPropertyValueHereTest(
            "Empty parameters section with block comment, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>/<!false!>* comment */<!true!>}<!false!>`
            + `}`);

        createCanAddPropertyValueHereTest(
            "Empty parameters section with two block comments, no whitespace or newlines anywhere",
            `<!false!>{$schema:"https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",`
            + `"contentVersion":"1.0.0.0",`
            + `"parameters":{<!true!>/<!false!>* one */<!true!>/<!false!>* two */<!true!>}<!false!>`
            + `}`);

        createCanAddPropertyValueHereTest(
            "Empty parameters section with line comment",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
                /<!false!>/ This is a comment
<!true!>    }<!false!>
        }`);

        createCanAddPropertyValueHereTest(
            "Empty parameters section with two line comments",
            `<!false!>{
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {<!true!>
                /<!false!>/ This is a comment
<!true!>        /<!false!>/ This is a comment
<!true!>        }<!false!>
            }`);

        createCanAddPropertyValueHereTest(
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

        createCanAddPropertyValueHereTest(
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

        createCanAddPropertyValueHereTest(
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
