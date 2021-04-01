// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: max-func-body-length

import { IDeploymentParametersFile, IPartialDeploymentTemplate } from "./support/diagnostics";
import { parseParametersWithMarkers, parseTemplateWithMarkers } from "./support/parseTemplate";
import { testGetReferences } from "./support/testGetReferences";

suite("Find References for parameters", () => {

    suite("#1237 Don't mix up params in param file with params with same name in a nested template", () => {
        suite("Nested template", () => {
            const templateWithNestedTemplate: IPartialDeploymentTemplate = {
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
                ]
            };

            const paramsFile1: Partial<IDeploymentParametersFile> = {
                parameters: {
                    "<!topLevelParameter1Value!>parameter1": {
                        value: "Top-level parameter 1 value in parameter file"
                    }
                }
            };

            const {
                dt,
                markers: {
                    topLevelParameter1Definition,
                    topLevelParameter1Usage,
                    nestedParameter1Definition,
                    nestedParameter1Usage,
                    nestedParameter1Value
                }
            } = parseTemplateWithMarkers(templateWithNestedTemplate, [], { ignoreWarnings: true });
            const {
                dp,
                markers: {
                    topLevelParameter1Value
                }
            } = parseParametersWithMarkers(paramsFile1);

            suite("Top-level parameter1", () => {
                test("Cursor at definition", () => {
                    testGetReferences(
                        dt,
                        topLevelParameter1Definition.index,
                        [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index],
                        {
                            associatedDoc: dp
                        }
                    );
                });

                test("Cursor at usage", () => {
                    testGetReferences(
                        dt,
                        topLevelParameter1Usage.index,
                        [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index],
                        {
                            associatedDoc: dp
                        }
                    );
                });

                test("Cursor at value in parameters file", () => {
                    testGetReferences(
                        dp,
                        topLevelParameter1Value.index,
                        [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index],
                        {
                            associatedDoc: dp
                        }
                    );
                });
            });

            suite("Parameter1 in linked template", () => {
                test("Cursor at definition", () => {
                    testGetReferences(
                        dt,
                        nestedParameter1Definition.index,
                        [nestedParameter1Definition.index, nestedParameter1Usage.index, nestedParameter1Value.index],
                        {
                            associatedDoc: dp
                        }
                    );
                });

                test("Cursor at usage", () => {
                    testGetReferences(
                        dt,
                        nestedParameter1Usage.index,
                        [nestedParameter1Definition.index, nestedParameter1Usage.index, nestedParameter1Value.index],
                        {
                            associatedDoc: dp
                        }
                    );
                });

                test("Cursor at value in parameters file", () => {
                    testGetReferences(
                        dt,
                        nestedParameter1Value.index,
                        [nestedParameter1Definition.index, nestedParameter1Usage.index, nestedParameter1Value.index],
                        {
                            associatedDoc: dp
                        }
                    );
                });
            });
        });

    });

    suite("Linked template", () => {
        const templateWithLinkedTemplate: IPartialDeploymentTemplate = {
            parameters: {
                "<!topLevelParameter1Definition!>parameter1": { // TOP-LEVEL Parameter1 definition
                    type: "string",
                    metadata: {
                        description: "description"
                    }
                }
            },
            resources: [
                {
                    name: "linkedDeployment1",
                    type: "Microsoft.Resources/deployments",
                    apiVersion: "2020-10-01",
                    properties: {
                        mode: "Incremental",
                        templateLink: {
                            relativePath: "childTemplate.json",
                            contentVersion: "1.0.0.0"
                        },
                        parameters: {
                            "<!linkedParameter1Value!>parameter1": { // LINKED TEMPLATE Parameter1 value
                                value: "[parameters('<!topLevelParameter1Usage!>parameter1')]" // TOP-LEVEL Parameter1 usage
                            }
                        }
                    }
                }
            ]
        };

        // const linkedTemplate: IPartialDeploymentTemplate = {
        //     parameters: {
        //         parameter1: { // LINKED TEMPLATE Parameter1 definition (in child template)
        //             type: "string",
        //             metadata: {
        //                 description: "parameter1 definition in linked template"
        //             }
        //         }
        //     },
        //     variables: {
        //         variable1: "[parameters('parameter1')]" // LINKED TEMPLATE Parameter1 usage (in child template)
        //     },
        // };

        const paramsFile1: IDeploymentParametersFile = {
            $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
            contentVersion: "1.0.0.0",
            parameters: {
                "<!topLevelParameter1Value!>parameter1": {
                    value: "Top-level parameter 1 value in parameter file"
                }
            }
        };

        const {
            dt,
            markers: {
                topLevelParameter1Definition,
                topLevelParameter1Usage,
                linkedParameter1Value,
            }
        } = parseTemplateWithMarkers(templateWithLinkedTemplate, [], { ignoreWarnings: true });
        // const {
        //     dtChild,
        //     markers: {
        //         linkedParameter1Definition,
        //     }
        // } = parseTemplateWithMarkers(linkedTemplate, [], { ignoreWarnings: true });
        const {
            dp,
            markers: {
                topLevelParameter1Value
            }
        } = parseParametersWithMarkers(paramsFile1);

        suite("Top-level parameter1", () => {
            test("Cursor at definition", () => {
                testGetReferences(
                    dt,
                    topLevelParameter1Definition.index,
                    [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index],
                    {
                        associatedDoc: dp
                    }
                );
                test("Cursor at usage", () => {
                    testGetReferences(
                        dt,
                        topLevelParameter1Usage.index,
                        [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index],
                        {
                            associatedDoc: dp
                        }
                    );
                });
            });

            test("Cursor at value in parameters file", () => {
                testGetReferences(
                    dp,
                    topLevelParameter1Value.index,
                    [topLevelParameter1Definition.index, topLevelParameter1Usage.index, topLevelParameter1Value.index],
                    {
                        associatedDoc: dp
                    }
                );
            });
        });

        suite("Parameter1 in linked template", () => {
            test("Cursor at value (in main template)", () => {
                testGetReferences(
                    dt,
                    linkedParameter1Value.index,
                    [linkedParameter1Value.index],
                    {
                        associatedDoc: dp
                    }
                );
            });

            // test("Cursor at definition (in linked template) asdf", () => {
            //     testGetReferences(
            //         dt,
            //         linkedParameter1Definition.index,
            //         [nestedParameter1Definition.index, nestedParameter1Usage.index, nestedParameter1Value.index],
            //         {
            //             associatedDoc: dp
            //         }
            //     );
            // });
        });
    });

});
