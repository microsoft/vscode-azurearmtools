// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: max-func-body-length

import { IDeploymentParametersFile, IDeploymentTemplate } from "./support/diagnostics";
import { parseParametersWithMarkers, parseTemplateWithMarkers } from "./support/parseTemplate";
import { testGetReferences } from "./support/testGetReferences";

suite("Find References for parameters", () => {
    const template1: IDeploymentTemplate = {
        $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        contentVersion: "1.0.0.0",
        parameters: {
            "<!topLevelParameter1Definition!>parameter1": { // TOP-LEVEL Parameter1 definition
                type: "string",
                metadata: {
                    description: "top-level parameter1 definition"
                }
            }
        },
        resources: [
            {
                name: "[parameters('<!topLevelParameter1Usage!>parameter1')]", // TOP-LEVEL parameter1 usage
                type: "Microsoft.Resources/deployments",
                apiVersion: "2020-10-01",
                properties: {
                    expressionEvaluationOptions: {
                        scope: "inner"
                    },
                    mode: "Incremental",
                    parameters: {
                        "<!nestedParameter1Value!>parameter1": {  // NESTED parameter1 value
                            value: "nested template param1 value"
                        }
                    },
                    template: {
                        $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                        contentVersion: "1.0.0.0",
                        parameters: {
                            "<!nestedParameter1Definition!>parameter1": { // NESTED Parameter1 definition (different from top-level parameter1)
                                type: "string",
                                metadata: {
                                    description: "nested template parameter1 definition"
                                }
                            }
                        },
                        variables: {},
                        resources: [],
                        outputs: {
                            output1: {
                                type: "string",
                                value: "[parameters('<!nestedParameter1Usage!>parameter1')]" // <<<< NESTED Paramter1 usage
                            }
                        }
                    }
                }
            }
        ],
        outputs: {}
    };

    const paramsFile1: IDeploymentParametersFile = {
        $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        contentVersion: "1.0.0.0",
        parameters: {
            "<!topLevelParameter1Value!>parameter1": {
                value: "Top-level parameter 1 value in parameter file"
            }
        }
    };

    suite("#1237 Don't mix up params in param file with params with same name in a nested template", () => {
        const {
            dt,
            markers: {
                topLevelParameter1Definition,
                topLevelParameter1Usage,
                nestedParameter1Definition,
                nestedParameter1Usage,
                nestedParameter1Value
            }
        } = parseTemplateWithMarkers(template1, [], { ignoreWarnings: true });
        const {
            dp,
            markers: {
                topLevelParameter1Value
            }
        } = parseParametersWithMarkers(paramsFile1);

        suite("Top-level parameter1", () => {
            test("Cursor at definition", () => {
                testGetReferences(dt, topLevelParameter1Definition.index, dp, [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index]);
            });

            test("Cursor at usage", () => {
                testGetReferences(dt, topLevelParameter1Usage.index, dp, [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index]);
            });

            test("Cursor at value in parameters file", () => {
                testGetReferences(dp, topLevelParameter1Value.index, dt, [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index]);
            });
        });

        suite("Parameter1 in nested template", () => {
            test("Cursor at definition", () => {
                testGetReferences(dt, nestedParameter1Definition.index, dp, [nestedParameter1Definition.index, nestedParameter1Usage.index, nestedParameter1Value.index]);
            });

            test("Cursor at usage", () => {
                testGetReferences(dt, nestedParameter1Usage.index, dp, [nestedParameter1Definition.index, nestedParameter1Usage.index, nestedParameter1Value.index]);
            });

            test("Cursor at value in parameters file", () => {
                testGetReferences(dt, nestedParameter1Value.index, dp, [nestedParameter1Definition.index, nestedParameter1Usage.index, nestedParameter1Value.index]);
            });
        });
    });

});
