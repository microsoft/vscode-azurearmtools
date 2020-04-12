// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition no-any

import * as assert from 'assert';
import { Uri } from 'vscode';
import { DeploymentTemplate, IVariableDefinition, Json } from "../extension.bundle";
import { createCompletionsTest } from './support/createCompletionsTest';
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate, parseTemplateWithMarkers } from "./support/parseTemplate";
import { stringify } from "./support/stringify";
import { testGetReferences } from './support/testGetReferences';

const fakeId = Uri.file("https://fake-id");

suite("Variable iteration (copy blocks)", () => {

    suite("top-level variable copy blocks", () => {
        const topLevelVariableCopyBlocks = <Partial<IDeploymentTemplate>>{
            variables: {
                copy: [{
                    // This creates a top-level variable 'diskNames' whose value is
                    //   an array of strings with the values
                    //   [
                    //     'myDataDisk1',
                    //     'myDataDisk2',
                    //     'myDataDisk3
                    //   ]
                    name: "<!diskNamesDefName!>diskNames",
                    count: 3,
                    input: "[concat('myDataDisk', copyIndex('diskNames', 1))]"
                }, {
                    name: "disks",
                    count: 3,
                    input: {
                        "name": "[concat('myDataDisk', copyIndex('disks', 1))]",
                        "diskSizeGB": "1",
                        "diskIndex": "[copyIndex('disks')]"
                    }
                }]
            }
        };

        test("'copy' not found as a variable", async () => {
            const dt = await parseTemplate(topLevelVariableCopyBlocks);
            assert(!dt.topLevelScope.getVariableDefinition('copy'));
        });

        test("copy block names are added as variables", async () => {
            const dt = await parseTemplate(topLevelVariableCopyBlocks);

            assert(dt.topLevelScope.variableDefinitions.length === 2);
            assert(dt.topLevelScope.variableDefinitions[0].nameValue.unquotedValue === "diskNames");
            assert(!!dt.topLevelScope.getVariableDefinition('diskNames'));
            assert(!!dt.topLevelScope.getVariableDefinition('disks'));
        });

        test("copy block value is an array of the input property", async () => {
            const dt = await parseTemplate(topLevelVariableCopyBlocks);

            const value = dt.topLevelScope.getVariableDefinition('diskNames')!.value!;
            assert(value);
            assert(value instanceof Json.ArrayValue);
            assert((<Json.ArrayValue>value).elements[0] instanceof Json.StringValue);
            // Right now the value consists of just a single array element of the 'input' property value
            assert.equal((<Json.StringValue>(<Json.ArrayValue>value).elements[0]).unquotedValue, "[concat('myDataDisk', copyIndex('diskNames', 1))]");
        });

        test("copy block usage info", async () => {
            const dt = await parseTemplate(topLevelVariableCopyBlocks);

            const diskNames = dt.topLevelScope.getVariableDefinition('diskNames')!;
            assert.deepStrictEqual(diskNames.usageInfo, {
                description: undefined,
                friendlyType: "iteration variable",
                usage: "diskNames"
            });
        });

        test("Find references at variable reference points to the copy block element's name property", async () => {
            const { dt, markers: { diskNamesDefName, diskNamesRef } } = await parseTemplateWithMarkers(
                {
                    ...topLevelVariableCopyBlocks,
                    outputs: {
                        o1: {
                            type: "string",
                            value: "[variables('<!diskNamesRef!>diskNames')]"
                        }
                    }

                },
                [],
                { ignoreWarnings: true });

            await testGetReferences(dt, diskNamesRef.index, [diskNamesRef.index, diskNamesDefName.index]);

        });

        test("case insensitive keys", () => {
            const dt = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>>{
                    variables: {
                        "COPY": [{
                            NAME: "diskNames",
                            COUNT: 3,
                            INPUT: "[concat('myDataDisk', copyIndex('diskNames', 1))]"
                        }]
                    }
                }),
                fakeId);
            assert(!!dt.topLevelScope.getVariableDefinition('diskNames'));
        });

        test("no input property", () => {
            const dt = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>>{
                    variables: {
                        "COPY": [{
                            name: "diskNames",
                            count: 3
                        }]
                    }
                }),
                fakeId);

            // Right now we still create the variable
            // CONSIDER: Instead add a parse error (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1010078)
            assert(!!dt.topLevelScope.getVariableDefinition('diskNames'));
            const diskNames = dt.topLevelScope.getVariableDefinition('diskNames')!;
            assert(diskNames);
            assert(diskNames.value === undefined);
        });

        test("no name property", () => {
            const dt = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>>{
                    variables: {
                        "COPY": [{
                            count: 3,
                            input: 123
                        }]
                    }
                }),
                fakeId);

            // Right now we just don't create the variable
            // CONSIDER: Instead add a parse error (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1010078)
            assert(dt.topLevelScope.variableDefinitions.length === 0);
        });

        test("bad name property", () => {
            const dt = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>>{
                    variables: {
                        "COPY": [{
                            count: 3,
                            input: 123
                        }]
                    }
                }),
                fakeId);

            // Right now we just don't create the variable
            // CONSIDER: Instead add a parse error (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1010078)
            assert(dt.topLevelScope.variableDefinitions.length === 0);
        });

        test("case insensitive lookup", async () => {
            const dt = await parseTemplate(topLevelVariableCopyBlocks);

            assert(!!dt.topLevelScope.getVariableDefinition('DISKnAMES'));
        });

        test("Regular and iteration vars together", async () => {
            const dt = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>><unknown>{
                    variables: {
                        "var1": "hello",
                        copy: [{ name: "diskNames" }, { name: "disks" }],
                        "var2": "hello 2",
                    }
                }),
                fakeId);

            assert.deepStrictEqual(
                dt.topLevelScope.variableDefinitions.map(v => v.nameValue.unquotedValue),
                ["var1", "diskNames", "disks", "var2"]
            );
        });

        suite("Top-level variable iteration completion", () => {
            const disksTopLevelArrayTemplate: IDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    "copy": [
                        {
                            // Creates variable 'disks-top-level-array-of-object'
                            //   of type arry of {name, diskIndex, data:{ diskSizeGB }}
                            "name": "disks-top-level-array-of-object",
                            "count": 5,
                            "input": {
                                "name": "[concat('myDataDisk', copyIndex('disks-top-level-array-of-object', 1))]",
                                "diskIndex": "[copyIndex('disks-top-level-array-of-object')]",
                                "data": {
                                    "diskSizeGB": "1"
                                }
                            }
                        }
                    ]
                },
                "resources": [],
                "outputs": {
                    "o1ArrayOfObject": {
                        "value": "[variables('disks-top-level-array-of-object')]",
                        "type": "array"
                    },
                    "o2Elem": {
                        "value": "[variables('disks-top-level-array-of-object')[1]]",
                        "type": "object"
                    },
                    "o2ElemDotData": {
                        "value": "[variables('disks-top-level-array-of-object')[1].data]",
                        "type": "object"
                    },
                    "o2ElemDotDataDotDiskSizeGB": {
                        "value": "[variables('disks-top-level-array-of-object')[1].data.diskSizeGB]",
                        "type": "int"
                    },
                    "output1": {
                        "value": "<output1>",
                        "type": "int"
                    }
                }
            };

            createCompletionsTest(disksTopLevelArrayTemplate, '<output1>', '[variables(!)]', ["'disks-top-level-array-of-object'"]);

            // We don't currently support completions from an array, so these should return an empty list
            createCompletionsTest(disksTopLevelArrayTemplate, '<output1>', "[variables('disks-top-level-array-of-object').!]", []);
            createCompletionsTest(disksTopLevelArrayTemplate, '<output1>', "[variables('disks-top-level-array-of-object').data!]", []);

        });

    }); // end suite top-level copy block

    suite("embedded variable copy blocks", async () => {
        let dt: DeploymentTemplate;
        let variable: IVariableDefinition;

        const embeddedVariableCopyBlocks = {
            "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {},
            "variables": {
                // This creates an object variable disk-array-in-object
                //   with two members: disks and member2
                //   Disks is of type array of {name, diskSizeGB, diskIndex}
                "disk-array-in-object": {
                    "copy": [
                        {
                            "name": "disks",
                            "count": 5,
                            "input": {
                                "name": "[concat('myDataDisk', copyIndex('disks', 1))]",
                                "diskSizeGB": "1",
                                "diskIndex": "[copyIndex('disks')]"
                            }
                        }
                    ],
                    "member2": "abc"
                }
            },
            "resources": [],
            "outputs": {
                "disk-array-in-object": {
                    // Returns an object with members disks and member2
                    "value": "[variables('disk-array-in-object')]",
                    "type": "object"
                },
                "disk-array-in-object-disks": {
                    // Returns an array of {name, diskSizeGB, diskIndex}
                    "value": "[variables('disk-array-in-object').disks]",
                    "type": "array"
                },
                "disk-array-in-object-member2": {
                    // Returns a string
                    "value": "[variables('disk-array-in-object').member2]",
                    "type": "array"
                }
            }
        };

        suiteSetup(async () => {
            dt = await parseTemplate(embeddedVariableCopyBlocks);
            variable = dt.topLevelScope.getVariableDefinition('Disk-array-in-object')!;
            assert(variable);
        });

        test("No errors", async () => {
            const errors = await dt.getErrors(undefined);
            assert.deepStrictEqual(errors, []);
        });

        test("'copy' not found as a variable", async () => {
            assert(!dt.topLevelScope.getVariableDefinition('copy'));
        });

        test("'copy' not found as member of the variable's value", async () => {
            assert.equal(Json.asObjectValue(variable.value)!.getPropertyValue('copy'), undefined);
        });

        test("copy block names are added as members of the variable", async () => {
            assert(dt.topLevelScope.variableDefinitions.length === 1);
            const v = dt.topLevelScope.getVariableDefinition('Disk-array-in-object')!;
            const value = Json.asObjectValue(v.value)!;
            assert(value);
            assert.equal(value.propertyNames.length, 2);

            const disks = value.getPropertyValue("disks")!;
            assert(disks);
            const member2 = value.getPropertyValue("member2")!;
            assert(member2);
        });

        test("copy block value is an object with an array 'disks' of the input property's value", async () => {
            const valueObject = Json.asObjectValue(dt.topLevelScope.getVariableDefinition('disk-array-in-object')!.value)!;
            const disksValue = valueObject.getPropertyValue("disks")!;

            // Disks member should be an array
            const disksArrayValue = Json.asArrayValue(disksValue)!;
            assert(disksArrayValue);

            // Copy array should be same as 'input' property
            const element1Object = Json.asObjectValue(disksArrayValue.elements[0])!;
            assert(element1Object);
            assert.deepStrictEqual(element1Object.propertyNames, ["name", "diskSizeGB", "diskIndex"]);
        });

        test("embedded copy block usage info", async () => {
            const diskNames = dt.topLevelScope.getVariableDefinition('disk-array-in-object')!;
            assert.deepStrictEqual(diskNames.usageInfo, {
                description: undefined,
                friendlyType: "variable",
                usage: "disk-array-in-object"
            });
        });

        test("multiple copy members", async () => {
            const dt2: DeploymentTemplate = await parseTemplate({
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    "object": {
                        "copy": [
                            {
                                "name": "array1",
                                "count": 5,
                                "input": true // Note: ARM backend actually only allows string and object
                            },
                            {
                                "name": "array2",
                                "count": 5,
                                "input": false // Note: ARM backend actually only allows string and object
                            }
                        ],
                        "member2": "abc"
                    }
                }
            });

            const vDef = dt2.topLevelScope.getVariableDefinition('object')!;
            assert(vDef);
            const valueObject = Json.asObjectValue(vDef.value)!;
            assert(valueObject);
            assert.deepStrictEqual(valueObject.propertyNames.sort(), ["array1", "array2", "member2"]);
        });

        test("case insensitive keys", () => {
            const dt2 = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>>{
                    "variables": {
                        "object": {
                            "COPY": [
                                {
                                    "name": "array1",
                                    "count": 5,
                                    "input": true // Note: ARM backend actually only allows string and object
                                }
                            ]
                        }
                    }
                }),
                fakeId);
            assert.deepStrictEqual(Json.asObjectValue(dt2.topLevelScope.getVariableDefinition('object')!.value)!.propertyNames, ["array1"]);
        });

        test("no input property", () => {
            const dt2 = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>>{
                    "variables": {
                        "object": {
                            "COPY": [
                                {
                                    "name": "array1",
                                    "count": 5
                                }
                            ]
                        }
                    }
                }),
                fakeId);

            // Right now we don't process as a copy block.  Backend does and gives an error.
            // CONSIDER: Add a parse error (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1010078)
            const objectVar = dt2.topLevelScope.getVariableDefinition('object')!;
            assert(objectVar);
        });

        test("no name property", () => {
            const dt2 = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>>{
                    "variables": {
                        "object": {
                            "COPY": [
                                {
                                    "name": "array1",
                                    "count": 5
                                }
                            ]
                        }
                    }
                }),
                fakeId);

            // Right now we just don't process as a copy block
            // CONSIDER: Instead add a parse error (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1010078)
            assert(!!dt2.topLevelScope.getVariableDefinition('object'));
        });

        test("bad name property", () => {
            const dt2 = new DeploymentTemplate(
                stringify(<Partial<IDeploymentTemplate>>{
                    "variables": {
                        "object": {
                            "COPY": [
                                {
                                    "name": false,
                                    "count": 5
                                }
                            ]
                        }
                    }
                }),
                fakeId);

            // Right now we just don't process as a copy block
            // CONSIDER: Instead add a parse error (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1010078)
            assert(!!dt2.topLevelScope.getVariableDefinition('object'));
        });

        test("deep COPY blocks", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                },
                "variables": {
                    "top": {
                        "copy": [
                            {
                                "name": "array1",
                                "count": 2,
                                "input": "[copyIndex('array1')]"
                            }
                        ],
                        "mid": {
                            "copy": [
                                {
                                    "name": "array2",
                                    "count": 2,
                                    "input": "[copyIndex('array2')]"
                                }
                            ],
                            "bottom": {
                                "copy": [
                                    {
                                        "name": "array3",
                                        "count": 2,
                                        "input": "[copyIndex('array3')]"
                                    }
                                ]
                            }
                        }
                    }
                },
                "resources": [
                ],
                "outputs": {
                    "top": {
                        "type": "object",
                        "value": "[variables('top')]"
                    }
                }
            };

            // Expected resulting structure:
            //
            //     "top": {
            //         "array1": [
            //           0,
            //           1
            //         ],
            //         "mid": {
            //           "array2": [
            //             0,
            //             1
            //           ],
            //           "bottom": {
            //             "array2": [
            //               0,
            //               1
            //             ]
            //           }
            //       }

            const dt2 = await parseTemplate(template);
            const vTop: IVariableDefinition = dt2.topLevelScope.getVariableDefinition('top')!;
            const vTopValue = Json.asObjectValue(vTop.value)!;
            assert.deepStrictEqual(vTopValue.propertyNames.sort(), ["array1", "mid"]);

            const vMidValue = Json.asObjectValue(vTopValue.getPropertyValue('mid'))!;
            assert.deepStrictEqual(vMidValue.propertyNames.sort(), ["array2", "bottom"]);

            const vBottomValue = Json.asObjectValue(vMidValue.getPropertyValue('bottom'))!;
            assert.deepStrictEqual(vBottomValue.propertyNames.sort(), ["array3"]);

            const vArray3Value = vBottomValue.getPropertyValue('array3')!;
            assert(vArray3Value instanceof Json.ArrayValue);
        });

        suite("Embedded variable iteration completion", () => {
            const template = <IDeploymentTemplate><any>{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    "disk-array-in-object": {
                        "member1": "abc",
                        "copy": [
                            {
                                "name": "array1",
                                "count": 5,
                                "input": "[concat('myDataDisk', copyIndex('disks', 1))]"
                            },
                            {
                                "name": "array2",
                                "count": 5,
                                "input": "[concat('myDataDisk', copyIndex('disks', 1))]"
                            }
                        ],
                        "member2": "abc"
                    }
                },
                outputs: {
                    "o1": {
                        type: "object",
                        value: "<output1>"
                    }
                }
            };

            createCompletionsTest(template, '<output1>', '[variables(!)]', ["'disk-array-in-object'"]);
            createCompletionsTest(template, '<output1>', "[variables('disk-array-in-object').!]", ["member1", "member2", "array1", "array2"]);
        });

    }); // end suite embedded variable copy blocks

    suite("Variable iteration sample", () => {
        test("https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-multiple#variable-iteration", async () => {
            const variableCopySampleTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {},
                "variables": {
                    // The variable disk-array-in-object will be of type object and contain two members: disks and diskNames
                    "disk-array-in-object": {
                        "copy": [
                            {
                                "name": "disks",
                                "count": 5,
                                "input": {
                                    "name": "[concat('myDataDisk', copyIndex('disks', 1))]",
                                    "diskSizeGB": "1",
                                    "diskIndex": "[copyIndex('disks')]"
                                }
                            },
                            {
                                "name": "diskNames",
                                "count": 5,
                                "input": "[concat('myDataDisk', copyIndex('diskNames', 1))]"
                            }
                        ]
                    },
                    "copy": [
                        {
                            "name": "top-level-object-array",
                            "count": 5,
                            "input": {
                                "name": "[concat('myDataDisk', copyIndex('top-level-object-array', 1))]",
                                "diskSizeGB": "1",
                                "diskIndex": "[copyIndex('top-level-object-array')]"
                            }
                        },
                        {
                            "name": "top-level-string-array",
                            "count": 5,
                            "input": "[concat('myDataDisk', copyIndex('top-level-string-array', 1))]"
                        },
                        {
                            "name": "top-level-integer-array",
                            "count": 5,
                            "input": "[copyIndex('top-level-integer-array')]"
                        }
                    ]
                },
                "resources": [],
                "outputs": {
                    "exampleObject": {
                        "value": "[variables('disk-array-in-object')]",
                        "type": "object"
                    },
                    "exampleArrayOnObject": {
                        "value": "[variables('disk-array-in-object').disks]",
                        "type": "array"
                    },
                    "exampleObjectArray": {
                        "value": "[variables('top-level-object-array')]",
                        "type": "array"
                    },
                    "exampleStringArray": {
                        "value": "[variables('top-level-string-array')]",
                        "type": "array"
                    },
                    "exampleIntegerArray": {
                        "value": "[variables('top-level-integer-array')]",
                        "type": "array"
                    }
                }
            };

            // Make sure no errors
            await parseTemplate(variableCopySampleTemplate, []);
        });
    }); // end suite Variable iteration sample

});
