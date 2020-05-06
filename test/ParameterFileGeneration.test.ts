// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length

import * as assert from "assert";
import { ContentKind, createParameterFileContents, createParameterFromTemplateParameter, IFormatTextOptions, WhichParams } from "../extension.bundle";
import { IDeploymentParameterDefinition, IDeploymentTemplate } from "./support/diagnostics";
import { normalizeString } from "./support/normalizeString";
import { parseTemplate } from "./support/parseTemplate";

suite("parameterFileGeneration tests", () => {
    suite("createParameterFileContents", () => {
        function testCreateFile(
            testName: string,
            whichParams: WhichParams,
            parameters: { [key: string]: Partial<IDeploymentParameterDefinition> },
            expectedContents: string,
            options: IFormatTextOptions = { insertSpaces: true, tabSize: 4 }
        ): void {
            test(`${testName} (${whichParams})`, async () => {
                expectedContents = normalizeString(expectedContents);

                const template: IDeploymentTemplate = {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                    ],
                    parameters: <{ [key: string]: IDeploymentParameterDefinition }>parameters
                };
                const dt = await parseTemplate(template);
                const paramFile = createParameterFileContents(dt, options, whichParams);
                assert.equal(paramFile, expectedContents);
            });
        }

        function testSingleProperty(
            testName: string,
            parameterDefinition: Partial<IDeploymentParameterDefinition>,
            expectedContents: string
        ): void {
            testSinglePropertyWithIndent(testName, 4, parameterDefinition, expectedContents); //asdf
        }

        function testSinglePropertyWithIndent(
            testName: string,
            spacesPerIndent: number,
            parameterDefinition: Partial<IDeploymentParameterDefinition>,
            expectedContentsWithSpaces: string/*,
            expectedContentsWithTabs: string asdf*/
        ): void {
            test(testName, async () => {
                expectedContentsWithSpaces = normalizeString(expectedContentsWithSpaces);

                const parameterName = "parameter1";
                const template: IDeploymentTemplate = {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                    ],
                    parameters: <{ [key: string]: IDeploymentParameterDefinition }>{}
                };
                // tslint:disable-next-line:no-non-null-assertion
                template.parameters![parameterName] = <IDeploymentParameterDefinition>parameterDefinition;

                const templateStringIndent4 = JSON.stringify(template, null, 4);
                const dt = await parseTemplate(templateStringIndent4);
                const foundDefinition = dt.topLevelScope.getParameterDefinition(parameterName);
                assert(foundDefinition);
                // tslint:disable-next-line:no-non-null-assertion
                const param = createParameterFromTemplateParameter(dt, foundDefinition!, ContentKind.text, { insertSpaces: true, tabSize: spacesPerIndent }); // asdf
                assert.equal(param, expectedContentsWithSpaces);
            });
        }

        suite("Create entire param file", () => {
            testCreateFile(
                "single string param, spaces, tabsize=4",
                WhichParams.all,
                {
                    p1: {
                        type: "string"
                    }
                },
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "p1": {
            "value": "value"
        }
    }
}`
            );

            testCreateFile(
                "single string param, spaces, tabsize=7",
                WhichParams.all,
                {
                    p1: {
                        type: "string"
                    }
                },
                `{
       "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
       "contentVersion": "1.0.0.0",
       "parameters": {
              "p1": {
                     "value": "value"
              }
       }
}`,
                {
                    insertSpaces: true,
                    tabSize: 7
                }
            );

            testCreateFile(
                "single string param, tabs",
                WhichParams.all,
                {
                    p1: {
                        type: "string"
                    }
                },
                `{
\t"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
\t"contentVersion": "1.0.0.0",
\t"parameters": {
\t\t"p1": {
\t\t\t"value": "value"
\t\t}
\t}
}`,
                {
                    insertSpaces: false,
                    tabSize: 7
                }
            );

            testCreateFile(
                "no params",
                WhichParams.all,
                {
                },
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
    }
}`
            );

            testCreateFile(
                "multiple parameters, all",
                WhichParams.all,
                {
                    p1: {
                        type: "string",
                        metadata: {
                            description: "my description"
                        }
                    },
                    p2: {
                        type: "int",
                        defaultValue: 123
                    },
                    p3: {
                        type: "int"
                    }
                },
                `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "p1": {
            "value": "value"
        },
        "p2": {
            "value": 123
        },
        "p3": {
            "value": value
        }
    }
}`
            );

        });

        testCreateFile(
            "multiple parameters, only required",
            WhichParams.required,
            {
                p1: {
                    type: "string",
                    metadata: {
                        description: "my description"
                    }
                },
                p2: {
                    type: "int",
                    defaultValue: 123
                },
                p3: {
                    type: "int"
                }
            },
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "p1": {
            "value": "value"
        },
        "p3": {
            "value": value
        }
    }
}`
        );

        suite("Required properties", () => {
            testSingleProperty(
                "required string",
                {
                    type: "string"
                },
                `"parameter1": {
    "value": "value"
}`
            );

            testSingleProperty(
                "required int",
                {
                    type: "int"
                },
                `"parameter1": {
    "value": value
}`
            );

            testSingleProperty(
                "required array",
                {
                    type: "array"
                },
                `"parameter1": {
    "value": [
        value
    ]
}`
            );

            testSingleProperty(
                "required object",
                {
                    type: "object"
                },
                `"parameter1": {
    "value": {
        value
    }
}`);

            suite("Optional parameters", () => {

                testSingleProperty(
                    "string with default value",
                    {
                        type: "string",
                        defaultValue: "abc"
                    },
                    `"parameter1": {
    "value": "abc"
}`);

                testSingleProperty(
                    "object with default value",
                    {
                        type: "object",
                        defaultValue: {
                            abc: "def"
                        }
                    },
                    `"parameter1": {
    "value": {
        "abc": "def"
    }
}`);

                testSingleProperty(
                    "object with nested default value",
                    {
                        type: "object",
                        defaultValue: {
                            abc: {
                                def: "ghi"
                            }
                        }
                    },
                    `"parameter1": {
    "value": {
        "abc": {
            "def": "ghi"
        }
    }
}`);

            });
        });

        suite("with indentation", () => {
            testSinglePropertyWithIndent(
                "indent = 0",
                0,
                {
                    type: "object",
                    defaultValue: "abc"
                },
                `"parameter1": {
"value": "abc"
}`);

            testSinglePropertyWithIndent(
                "indent = 4",
                4,
                {
                    type: "object",
                    defaultValue: "abc"
                },
                `"parameter1": {
    "value": "abc"
}`);

            testSinglePropertyWithIndent(
                "indent = 8",
                8,
                {
                    type: "object",
                    defaultValue: "abc"
                },
                `"parameter1": {
        "value": "abc"
}`);
        });
    });
});
