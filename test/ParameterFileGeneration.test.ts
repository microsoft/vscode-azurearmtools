// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length

import * as assert from "assert";
import { createParameterFileContents, createParameterFromTemplateParameter } from "../extension.bundle";
import { IDeploymentParameterDefinition, IDeploymentTemplate } from "./support/diagnostics";
import { normalizeString } from "./support/normalizeString";
import { parseTemplate } from "./support/parseTemplate";

suite("parameterFileGeneration tests", () => {
    suite("createParameterFileContents", () => {
        function testCreateFile(
            testName: string,
            onlyRequiredParams: boolean,
            parameters: { [key: string]: Partial<IDeploymentParameterDefinition> },
            expectedContents: string
        ): void {
            test(`${testName} (${onlyRequiredParams ? 'all params' : 'required params'})`, async () => {
                expectedContents = normalizeString(expectedContents);

                const template: IDeploymentTemplate = {
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    contentVersion: "1.0.0.0",
                    resources: [
                    ],
                    parameters: <{ [key: string]: IDeploymentParameterDefinition }>parameters
                };
                const dt = await parseTemplate(template);
                const paramFile = createParameterFileContents(dt.topLevelScope, 4, onlyRequiredParams);
                assert.equal(paramFile, expectedContents);
            });
        }

        function testSingleProperty(
            testName: string,
            parameterDefinition: Partial<IDeploymentParameterDefinition>,
            expectedContents: string
        ): void {
            testSinglePropertyWithIndent(testName, 4, parameterDefinition, expectedContents);
        }

        function testSinglePropertyWithIndent(
            testName: string,
            spacesPerIndent: number,
            parameterDefinition: Partial<IDeploymentParameterDefinition>,
            expectedContents: string
        ): void {
            test(testName, async () => {
                expectedContents = normalizeString(expectedContents);

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
                const param = createParameterFromTemplateParameter(dt.topLevelScope, foundDefinition!, undefined, spacesPerIndent);
                assert.equal(param, expectedContents);
            });
        }

        suite("Create entire param file", () => {
            testCreateFile(
                "single string param",
                false, // onlyRequiredParams
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
            "value": "" // TODO: Fill in parameter value
        }
    }
}`
            );

            testCreateFile(
                "no params",
                false, // onlyRequiredParams
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
                false,
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
            "value": "" // TODO: Fill in parameter value
        },
        "p2": {
            "value": 123
        },
        "p3": {
            "value": 0 // TODO: Fill in parameter value
        }
    }
}`
            );

        });

        suite("Required properties", () => {
            testSingleProperty(
                "required string",
                {
                    type: "string"
                },
                `"parameter1": {
    "value": "" // TODO: Fill in parameter value
}`
            );

            testSingleProperty(
                "required int",
                {
                    type: "int"
                },
                `"parameter1": {
    "value": 0 // TODO: Fill in parameter value
}`
            );

            testSingleProperty(
                "required array",
                {
                    type: "array"
                },
                `"parameter1": {
    "value": [
        // TODO: Fill in parameter value
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
        // TODO: Fill in parameter value
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
