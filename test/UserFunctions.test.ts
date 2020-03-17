// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import * as assert from "assert";
import * as os from 'os';
import { DefinitionKind, DeploymentTemplate, HoverInfo, IReferenceSite, Language } from "../extension.bundle";
import { createCompletionsTest } from "./support/createCompletionsTest";
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate, parseTemplateWithMarkers } from "./support/parseTemplate";
import { testGetReferences } from "./support/testGetReferences";
import { allTestDataExpectedCompletions } from "./TestData";

suite("User functions", () => {

    const userFuncsTemplate1: IDeploymentTemplate = {
        "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "functions": [
            {
                "namespace": "<!udfDef!>udf",
                "members": {
                    "<!udfStringDefinition!>string": {
                        "parameters": [
                            {
                                "name": "<!udfyearDefinition!>year",
                                "type": "Int"
                            },
                            {
                                "name": "month",
                                // tslint:disable-next-line:no-any
                                "type": <any>123 // invalid type
                            },
                            {
                                "name": "day",
                                "type": "int"
                            }
                        ],
                        "output": {
                            "type": "string",
                            "value": "[concat(<!stringRef1!>string(parameters('<!udfyearReference!>year')), '-', <!stringRef2!>string(<!addReferenceInUdfString!>add(parameters('month'), 1)), '-', <!stringRef3!>string(parameters('day')))]"
                        }
                    }
                }
            }
        ],
        "resources": [
            {
                "type": "Microsoft.Storage/storageAccounts",
                "name": "[parameters('<!yearReference!>year')]",
                "apiVersion": "[parameters('<!apiVersionReference!>apiVersion')]",
                "location": "westus"
            }
        ],
        "parameters": {
            "<!yearDefinition!>year": {
                "type": "int",
                "defaultValue": 2010
            },
            "<!apiVersionDef!>apiVersion": {
                "type": "int",
                "defaultValue": 2010
            }
        },
        "variables": {
            "<!var1Definition!>var1": {
                "a": {
                    "b": {
                        "c": 16180339887498948482
                    },
                    "d": 42
                }
            },
            "<!var2Definition!>var2": "[variables('<!var1Reference1!>var1')]"
        },
        "outputs": {
            "output1": {
                "type": "int",
                "value": "[variables('<!var1Reference2!>var1')]"
            },
            "output2": {
                "type": "string",
                "value": "[<!udfReferenceAtNamespace!>udf.<!udfReferenceAtName!>string(2019, 10, 5)]" // Using user function udf.string
            },
            "output3": {
                "type": "string",
                "value": "[<!stringRef4!>string(2019)]" // using built-in function 'string'
            },
            "output4": {
                "type": "int",
                "value": "[mul(<!addReferenceInOutput4!>add(1, 2), 2)]"
            }
        }
    };

    // #region
    suite("UDF Malformed", () => {
        test("missing namespace name", async () => {
            // tslint:disable-next-line:no-any
            const template = <IDeploymentTemplate><any>{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [
                    {
                        "members": {
                            "odd": {
                                "parameters": [
                                    {
                                        "name": "number",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": "[equals(mod(parameters('number'), 2), 1)]"
                                }
                            }
                        }
                    }
                ]
            };

            const dt = await parseTemplate(template, [
                "Error: Undefined parameter reference: 'number'"
            ]);
            assert.equal(0, dt.topLevelScope.namespaceDefinitions.length);
        });

        test("missing function name", async () => {
            const template =
                `"$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "functions": [
                {
                    "namespace": "udf",
                    "members": {
                        : {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[equals(mod(parameters('number'), 2), 1)]"
                            }
                        }
                    }
                }
            ]`;

            const dt = await parseTemplate(template, [
            ]);
            assert.equal(0, dt.topLevelScope.namespaceDefinitions.length);
        });

        test("Empty function name", async () => {
            // tslint:disable-next-line:no-any
            const template = <IDeploymentTemplate><any>{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "param1": {
                        "name": "number",
                        "type": "Int"
                    }
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "": {
                            "parameters": [
                                {
                                    "name": "param1",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[parameters('param1')]"
                            }
                        }
                    }
                }]
            };

            await parseTemplate(template, [
                "Warning: The parameter 'param1' is never used.",
                'Warning: The user-defined function \'udf.(none)\' is never used.'
            ]);
        });

        test("Empty namespace name", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [{
                    "namespace": "",
                    "members": {
                        "odd": {
                            "parameters": [
                                {
                                    "name": "udfParam1",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[parameters('udfParam1')]"
                            }
                        }
                    }
                }],
                "resources": []
            };

            await parseTemplate(template, [
                'Warning: The user-defined function \'(none).odd\' is never used.'
            ]);
        });

        test("Empty namespace name with unused top-level parameter", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "param1": {
                        "name": "number",
                        "type": "Int"
                    }
                },
                "functions": [{
                    "namespace": "",
                    "members": {
                        "odd": {
                            "parameters": [
                                {
                                    "name": "udfParam1",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[parameters('udfParam1')]"
                            }
                        }
                    }
                }]
            };

            await parseTemplate(template, [
                "Warning: The parameter 'param1' is never used.",
                'Warning: The user-defined function \'(none).odd\' is never used.'
            ]);
        });

        test("No top-level object value", async () => {
            const template = [{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [
                    {
                        "members": {
                            "odd": {
                                "parameters": [
                                    {
                                        "name": "number",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": "[equals(mod(parameters('number'), 2), 1)]"
                                }
                            }
                        }
                    }
                ]
            }];

            // tslint:disable-next-line:no-any
            const dt = await parseTemplate(<any>template, [
            ]);
            assert.equal(0, dt.topLevelScope.namespaceDefinitions.length);
        });

    });
    // #endregion

    // #region
    suite("UDF Function definitions", () => {
        test("simple function definition", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "odd": {
                        }
                    }
                }],
                "outputs": {
                    "o1": {
                        "value": "[udf.odd()]",
                        "type": "string"
                    }
                }
            };

            await parseTemplate(template, []);
        });

        test("function definition with local parameter reference in output", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [
                    {
                        "namespace": "udf",
                        "members": {
                            "odd": {
                                "parameters": [
                                    {
                                        "name": "number",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": "[equals(mod(parameters('number'), 2), 1)]"
                                }
                            }
                        }
                    }
                ]
            };

            await parseTemplate(template, [
                'Warning: The user-defined function \'udf.odd\' is never used.'
            ]);
        });

        test("Case insensitive keys in definition", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "Functions": [
                    {
                        "NAMEspace": "udf",
                        "Members": {
                            "odd": {
                                "PARAMETERs": [
                                    {
                                        "NAme": "NUmber",
                                        "typeE": "Int"
                                    }
                                ],
                                "outPUT": {
                                    "tyPE": "bOol",
                                    "valUe": "[equals(mod(parameters('number'), 2), 1)]"
                                }
                            },
                            "even": {
                            }
                        }
                    }
                ]
            };

            const dt = await parseTemplate(template);
            assert.equal(dt.topLevelScope.parameterDefinitions.length, 0);
            assert(!dt.topLevelScope.getParameterDefinition('notfound'));
            assert.equal(dt.topLevelScope.namespaceDefinitions.length, 1);
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].members.length, 2);
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].nameValue.toFriendlyString(), "udf");
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].getMemberDefinition('odd')!.nameValue.toString(), "odd");
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].getMemberDefinition('ODD')!.nameValue.toString(), "odd");
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].members[0].parameterDefinitions.length, 1);
        });

        test("function definition with local parameter reference in output", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "odd": {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[equals(mod(parameters('number'), 2), 1)]"
                            }
                        }
                    }
                }]
            };

            await parseTemplate(template, [
                'Warning: The user-defined function \'udf.odd\' is never used.'
            ]);
        });

        test("function definition can't access parameter from outer scope", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "outerParam": {
                        "name": "number",
                        "type": "Int"
                    }
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "odd": {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[parameters('outerParam')]"
                            }
                        }
                    }
                }]
            };

            await parseTemplate(
                template,
                [
                    "Error: Undefined parameter reference: 'outerParam'"
                ],
                {
                    ignoreWarnings: true
                });
        });

        // CONSIDER: Better error message
        // Right now we get:
        //   Template validation failed: The template function 'a' at line '11' and column '22' is not valid. These function calls are not supported in a function definition: 'variables'. Please see https://aka.ms/arm-template/#functions for usage details.
        //   Undefined variable reference: 'var1'
        test("function definition can't access variables", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [
                    {
                        "namespace": "udf",
                        "members": {
                            "a": {
                                "output": {
                                    "value": "[variables('var1')]",
                                    "type": "int"
                                }
                            }
                        }
                    }
                ],
                "resources": [],
                "variables": {
                    "var1": 1
                }
            };

            await parseTemplate(
                template,
                [
                    "Error: User functions cannot reference variables"
                ],
                {
                    ignoreWarnings: true
                });
        });

        test("function can't access parameter from outer scope", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "outerParam": {
                        "name": "number",
                        "type": "Int"
                    }
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "odd": {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[parameters('outerParam')]"
                            }
                        }
                    }
                }]
            };

            await parseTemplate(
                template,
                [
                    "Error: Undefined parameter reference: 'outerParam'"
                ],
                {
                    ignoreWarnings: true
                });
        });

        test("function parameter names are case insensitive", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "odd": {
                            "parameters": [
                                {
                                    "name": "NUMBER",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[parameters('nuMber')]"
                            }
                        }
                    }
                }]
            };

            await parseTemplate(template, [
                'Warning: The user-defined function \'udf.odd\' is never used.'
            ]);
        });

    });

    // #endregion

    // #region

    suite("UDF Calling user functions", () => {

        test("Calling function with no parameters and no output", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf.func1()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "func1": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);
        });

        test("Calling function with no parameters", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf.nothing()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "nothing": {
                            "output": {
                                "type": "bool",
                                "value": true
                            }
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);
        });

        test("Calling function with no parameters, with extra arg", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    tooManyArgs: "[udf.nothing('this arg doesn''t belong here')]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "nothing": {
                            "output": {
                                "type": "bool",
                                "value": true
                            }
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('tooManyArgs')]"
                    }
                }
            };

            await parseTemplate(template, [
                'Error: The function \'udf.nothing\' takes 0 arguments.'
            ]);
        });

        test("Unrecognized function name", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf.boo()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "hoo": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, [
                'Error: Unrecognized function name \'boo\' in user-defined namespace \'udf\'.',
                'Warning: The user-defined function \'udf.hoo\' is never used.'
            ]);
        });

        test("Unrecognized namespace", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[ufo.boo()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "boo": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, [
                'Error: Unrecognized user-defined function namespace \'ufo\'.',
                'Warning: The user-defined function \'udf.boo\' is never used.'
            ]);
        });

        test("Missing function argument list 1", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf.boo]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "boo": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, [
                'Error: Missing function argument list.'
            ]);
        });

        test("Missing function argument list 2", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[ufo.boo(]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "boo": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, [
                'Error: Expected a right parenthesis (\')\').',
                'Error: Unrecognized user-defined function namespace \'ufo\'.',
                'Warning: The user-defined function \'udf.boo\' is never used.'
            ]);
        });

        test("Calling functions from two namespaces", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf1.oddSum(udf2.oddSum(2))]"
                },
                "functions": [
                    {
                        "namespace": "udf1",
                        "members": {
                            "oddSum": {
                                "parameters": [
                                    {
                                        "name": "number",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": "[equals(mod(parameters('number'), 2), 0)]"
                                }
                            }
                        }
                    },
                    {
                        "namespace": "udf2",
                        "members": {
                            "oddSum": {
                                "parameters": [
                                    {
                                        "name": "number",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": "[equals(mod(parameters('number'), 2), 0)]"
                                }
                            }
                        }
                    }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);
        });

        test("Calling function with one parameter", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf.oddSum(1)]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "oddSum": {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[equals(mod(parameters('number'), 2), 0)]"
                            }
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);
        });

        test("Calling function with one parameter, only giving one argument", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    notEnoughArgs: "[udf.odd()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "odd": {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[equals(mod(parameters('number'), 2), 0)]"
                            }
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('notEnoughArgs')]"
                    }
                }
            };

            await parseTemplate(template, [
                "Error: The function 'udf.odd' takes 1 argument."
            ]);
        });

        test("Calling function with one parameter, giving an extra argument", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    tooManyArgs: "[udf.odd()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "odd": {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[equals(mod(parameters('number'), 2), 0)]"
                            }
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('tooManyArgs')]"
                    }
                }
            };

            await parseTemplate(template, [
                "Error: The function 'udf.odd' takes 1 argument."
            ]);
        });

        test("Calling function with two parameters", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                outputs: {
                    output1: {
                        type: 'bool',
                        value: "[udf.oddSum(1, 2)]"
                    }
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "oddSum": {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                },
                                {
                                    "name": "sum",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[equals(mod(add(parameters('number'),parameters('sum')), 2), 0)]"
                            }
                        }
                    }
                }]
            };

            await parseTemplate(template, []);
        });

        test("Calling function with two parameters", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                outputs: {
                    output1: {
                        type: 'bool',
                        value: "[udf.oddSum(1, 2)]"
                    }
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "oddSum": {
                            "parameters": [
                                {
                                    "name": "number",
                                    "type": "Int"
                                },
                                {
                                    "name": "sum",
                                    "type": "Int"
                                }
                            ],
                            "output": {
                                "type": "bool",
                                "value": "[equals(mod(add(parameters('number'),parameters('sum')), 2), 0)]"
                            }
                        }
                    }
                }]
            };

            await parseTemplate(template, []);
        });

        test("Namespaces are case insensitive", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udF.boo()]"
                },
                "functions": [{
                    "namespace": "UDF",
                    "members": {
                        "boo": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);
        });

        test("Function names are case insensitive", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf.bOO()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "Boo": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);
        });

        // CONSIDER: Give better error message.  Right now we get this (from backend validation):
        //  Template validation failed: The template function 'b' at line '15' and column '22' is not valid. These function calls are not supported in a function definition: 'udf.a'. Please see https://aka.ms/arm-template/#functions for usage details.
        test("User function can't call another user function", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "functions": [
                    {
                        "namespace": "udf",
                        "members": {
                            "a": {
                                "output": {
                                    "value": {
                                    },
                                    "type": "Object"
                                }
                            },
                            "b": {
                                "output": {
                                    "type": "int",
                                    "value": "[udf.a()]"
                                }
                            }
                        }
                    }
                ],
                "resources": [],
                "outputs": {
                    "o1": {
                        type: "int",
                        value: "[add(udf.a(), udf.b())]"
                    }
                }
            };

            await parseTemplate(template, [
                // tslint:disable-next-line: no-suspicious-comment
                // TODO: Better error message?
                'Error: Unrecognized user-defined function namespace \'udf\'.'
            ]);
        });

        test("Calling user function with same name as built-in function", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf.add()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "add": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);
        });

        test("Calling user function with namespace name same as built-in function", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[add.add()]"
                },
                "functions": [{
                    "namespace": "add",
                    "members": {
                        "add": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);

        });

        test("Function names are case insensitive", async () => {
            const template = {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "variables": {
                    v1: "[udf.bOO()]"
                },
                "functions": [{
                    "namespace": "udf",
                    "members": {
                        "Boo": {
                        }
                    }
                }],
                "outputs": {
                    "output1": {
                        "type": "object",
                        "value": "[variables('v1')]"
                    }
                }
            };

            await parseTemplate(template, []);
        });

    });
    // #endregion

    suite("UDF Find References", () => {

        suite("Find parameter references", () => {
            test("At reference to top-level parameter", async () => {
                const { dt, markers: { apiVersionDef, apiVersionReference } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "apiVersion" inside resources
                await testGetReferences(dt, apiVersionReference.index, [apiVersionReference.index, apiVersionDef.index]);
            });

            test("At definition of top-level parameter", async () => {
                const { dt, markers: { apiVersionDef, apiVersionReference } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition of "apiVersion" parameter
                await testGetReferences(dt, apiVersionDef.index, [apiVersionDef.index, apiVersionReference.index]);
            });

            test("At reference to user function parameter", async () => {
                const { dt, markers: { udfyearReference, udfyearDefinition } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "year" inside user function output
                await testGetReferences(dt, udfyearReference.index, [udfyearReference.index, udfyearDefinition.index]);
            });

            test("At definition of user function parameter", async () => {
                const { dt, markers: { udfyearReference, udfyearDefinition } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition of "year" inside user function
                await testGetReferences(dt, udfyearDefinition.index, [udfyearReference.index, udfyearDefinition.index]);
            });

            test("At reference to parameter in user function only finds UDF scope parameter, not top-level param", async () => {
                const { dt, markers: { udfyearReference, udfyearDefinition } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "year" inside user function output
                await testGetReferences(dt, udfyearReference.index, [udfyearReference.index, udfyearDefinition.index]);
            });

            test("At definition to parameter in user function only finds UDF scope parameter, not top-level param", async () => {
                const { dt, markers: { udfyearReference, udfyearDefinition } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition of "year" inside user function
                await testGetReferences(dt, udfyearDefinition.index, [udfyearReference.index, udfyearDefinition.index]);
            });

            test("At reference to top-level parameter only finds top-level parameter definition, not param in user function", async () => {
                const { dt, markers: { udfyearReference, udfyearDefinition } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "year" inside user function output
                await testGetReferences(dt, udfyearReference.index, [udfyearReference.index, udfyearDefinition.index]);
            });
        });

        suite("UDF Find variable references", () => {
            test("At reference to variable", async () => {
                const { dt, markers: { var1Definition, var1Reference1, var1Reference2 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "var1" inside var2
                await testGetReferences(dt, var1Reference1.index, [var1Definition.index, var1Reference1.index, var1Reference2.index]);

                // Cursor at reference to "var1" inside outputs2
                await testGetReferences(dt, var1Reference2.index, [var1Definition.index, var1Reference1.index, var1Reference2.index]);
            });

            test("Deeply nested", async () => {
                const { dt, markers: { var1Definition, var1Reference1, var1Reference2 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "var1" inside var2
                await testGetReferences(dt, var1Reference1.index, [var1Definition.index, var1Reference1.index, var1Reference2.index]);

                // Cursor at reference to "var1" inside outputs2
                await testGetReferences(dt, var1Reference2.index, [var1Definition.index, var1Reference1.index, var1Reference2.index]);
            });

            test("At definition of variable", async () => {
                const { dt, markers: { var1Definition, var1Reference1, var1Reference2 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition to "var1" variable
                await testGetReferences(dt, var1Definition.index, [var1Definition.index, var1Reference1.index, var1Reference2.index]);
            });
        });

        suite("UDF Find user function references", () => {
            // tslint:disable-next-line: no-suspicious-comment
            test("At reference to user-defined function, cursor inside the namespace portion", async () => {
                const { dt, markers: { udfDef, udfReferenceAtNamespace } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "udf.string" inside the namespace
                await testGetReferences(dt, udfReferenceAtNamespace.index, [udfDef.index, udfReferenceAtNamespace.index]);
            });

            test("At reference to user-defined function, cursor inside the name portion", async () => {
                const { dt, markers: { udfStringDefinition, udfReferenceAtName } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "udf.string" inside the name
                await testGetReferences(dt, udfReferenceAtName.index, [udfStringDefinition.index, udfReferenceAtName.index]);
            });

            test("At definition of user-defined function", async () => {
                const { dt, markers: { udfStringDefinition, udfReferenceAtName } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition of "udf.string"
                await testGetReferences(dt, udfStringDefinition.index, [udfStringDefinition.index, udfReferenceAtName.index]);
            });

            test("At definition of user-defined namespace", async () => {
                const { dt, markers: { udfDef, udfReferenceAtNamespace } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition of "udf.string"
                await testGetReferences(dt, udfDef.index, [udfDef.index, udfReferenceAtNamespace.index]);
            });

            test("Reference to built-in function with same name as UDF function doesn't find UDF", async () => {
                const { dt, markers: { stringRef1, stringRef2, stringRef3, stringRef4 } } = await parseTemplateWithMarkers(userFuncsTemplate1);
                await testGetReferences(dt, stringRef4.index, [stringRef1.index, stringRef2.index, stringRef3.index, stringRef4.index]);
            });

            test("Reference to built-in function in outer scope finds it in all scopes", async () => {
                const { dt, markers: { addReferenceInUdfString, addReferenceInOutput4 } } = await parseTemplateWithMarkers(userFuncsTemplate1);

                // Cursor at "add" in output4
                await testGetReferences(dt, addReferenceInOutput4.index, [addReferenceInOutput4.index, addReferenceInUdfString.index]);
            });

            test("Reference to built-in function in function scope finds it in all scopes", async () => {
                const { dt, markers: { addReferenceInUdfString, addReferenceInOutput4 } } = await parseTemplateWithMarkers(userFuncsTemplate1);

                // Cursor at "add" in udf 'string's output
                await testGetReferences(dt, addReferenceInUdfString.index, [addReferenceInOutput4.index, addReferenceInUdfString.index]);
            });
        });

    }); // suite References

    suite("UDF Hover Info", () => {
        async function testHover(
            dt: DeploymentTemplate,
            cursorIndex: number,
            expectedHoverText: string,
            expectedSpan?: Language.Span
        ): Promise<void> {
            const pc = dt.getContextFromDocumentCharacterIndex(cursorIndex);
            let hoverInfo: HoverInfo = pc.getHoverInfo()!;
            assert(hoverInfo, "Expected non-empty hover info");
            hoverInfo = hoverInfo!;

            const text: string = hoverInfo.getHoverText();
            const span: Language.Span = hoverInfo.span;

            assert.equal(text, expectedHoverText);
            if (expectedSpan) {
                assert.equal(span, expectedSpan);
            }
        }

        test("Hover over top-level parameter reference", async () => {
            const { dt, markers: { yearReference } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, yearReference.index, `**year**${os.EOL}*(parameter)*`);
        });

        test("Hover over UDF parameter reference", async () => {
            const { dt, markers: { udfyearReference } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, udfyearReference.index, `**year**${os.EOL}*(function parameter)*`);
        });

        test("Hover over top-level variable reference", async () => {
            const { dt, markers: { var1Reference1 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, var1Reference1.index, `**var1**${os.EOL}*(variable)*`);
        });

        test("Hover over built-in function reference", async () => {
            const { dt, markers: { stringRef4 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, stringRef4.index, `**string(valueToConvert)**${os.EOL}*(function)*${os.EOL}${os.EOL}Converts the specified value to String.`);
        });

        test("Hover over user-defined function reference's name", async () => {
            const { dt, markers: { udfReferenceAtName } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, udfReferenceAtName.index, `**udf.string(year [int], month, day [int]) [string]**${os.EOL}*(user-defined function)*`);
        });

        test("Hover over user-defined function reference's namespace", async () => {
            const { dt, markers: { udfReferenceAtNamespace } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(
                dt,
                udfReferenceAtNamespace.index,
                `**udf**${os.EOL}*(user-defined namespace)*${os.EOL}${os.EOL}Members:${os.EOL}* string(year [int], month, day [int]) [string]`);
        });
    }); // suite UDF Hover Info

    suite("UDF Go To Definition", async () => {
        async function testGoToDefinition(
            dt: DeploymentTemplate,
            cursorIndex: number,
            expectedReferenceKind: DefinitionKind,
            expectedDefinitionStart: number
        ): Promise<void> {
            const pc = dt.getContextFromDocumentCharacterIndex(cursorIndex);
            const refInfo: IReferenceSite = pc.getReferenceSiteInfo()!;
            assert(refInfo, "Expected non-null IReferenceSite");

            assert.deepStrictEqual(refInfo.definition.definitionKind, expectedReferenceKind);
            assert.deepStrictEqual(refInfo.definition.nameValue!.span.startIndex, expectedDefinitionStart);
        }

        test("Top-level parameter", async () => {
            const { dt, markers: { apiVersionDef, apiVersionReference } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "apiVersion" inside resources
            // -1 because go to definition currently goes to the quote at the start of the string
            await testGoToDefinition(dt, apiVersionReference.index, DefinitionKind.Parameter, apiVersionDef.index - 1);
        });
        test("User function parameter", async () => {
            const { dt, markers: { udfyearReference, udfyearDefinition } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "year" inside user function output
            await testGoToDefinition(dt, udfyearReference.index, DefinitionKind.Parameter, udfyearDefinition.index - 1);
        });

        test("Variable reference", async () => {
            const { dt, markers: { var1Definition, var1Reference1, var1Reference2 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "var1" inside var2
            await testGoToDefinition(dt, var1Reference1.index, DefinitionKind.Variable, var1Definition.index - 1);

            // Cursor at reference to "var1" inside outputs2
            await testGoToDefinition(dt, var1Reference2.index, DefinitionKind.Variable, var1Definition.index - 1);
        });

        test("User-defined function, cursor inside the namespace portion", async () => {
            const { dt, markers: { udfDef, udfReferenceAtNamespace } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "udf.string" inside the namespace -> goes to namespace definition
            await testGoToDefinition(dt, udfReferenceAtNamespace.index, DefinitionKind.Namespace, udfDef.index - 1);
        });

        test("User-defined function, cursor inside the name portion", async () => {
            const { dt, markers: { udfStringDefinition, udfReferenceAtName } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "udf.string" inside the name
            await testGoToDefinition(dt, udfReferenceAtName.index, DefinitionKind.UserFunction, udfStringDefinition.index - 1);
        });
    }); // suite UDF Go To Definition

    suite("Warnings", () => {
        suite("Unused parameters", () => {
            test("Unused top-level parameter", async () => {
                const template = {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "param1": {
                            "name": "number",
                            "type": "Int"
                        }
                    }
                };

                await parseTemplate(template, [
                    "Warning: The parameter 'param1' is never used."
                ]);
            });

            test("Unused top-level parameter when UDF param has same name", async () => {
                const template = {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "param1": {
                            "name": "number",
                            "type": "Int"
                        }
                    },
                    "functions": [{
                        "namespace": "udf",
                        "members": {
                            "odd": {
                                "parameters": [
                                    {
                                        "name": "param1",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": "[parameters('param1')]"
                                }
                            }
                        }
                    }]
                };

                await parseTemplate(template, [
                    "Warning: The parameter 'param1' is never used.",
                    "Warning: The user-defined function 'udf.odd' is never used."
                ]);
            });

            test("Unused UDF parameter", async () => {
                const template = {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "functions": [{
                        "namespace": "udf",
                        "members": {
                            "odd": {
                                "parameters": [
                                    {
                                        "name": "param1",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": 123
                                }
                            }
                        }
                    }]
                };

                await parseTemplate(template, [
                    "Warning: The parameter 'param1' of function 'udf.odd' is never used.",
                    "Warning: The user-defined function 'udf.odd' is never used."
                ]);
            });

            test("Unused UDF parameter when top-level param has same name", async () => {
                const template = {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "param1": {
                            "name": "number",
                            "type": "Int"
                        }
                    },
                    "functions": [{
                        "namespace": "udf",
                        "members": {
                            "odd": {
                                "parameters": [
                                    {
                                        "name": "param1",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": 123
                                }
                            }
                        }
                    }],
                    "outputs": {
                        "output1": {
                            "type": "int",
                            "value": "[parameters('param1')]"
                        }
                    }
                };

                await parseTemplate(template, [
                    "Warning: The parameter 'param1' of function 'udf.odd' is never used.",
                    "Warning: The user-defined function 'udf.odd' is never used."
                ]);
            });

            test("Unused top-level and unused UDF parameter", async () => {
                const template = {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "param1": {
                            "name": "number",
                            "type": "Int"
                        }
                    },
                    "functions": [{
                        "namespace": "udf",
                        "members": {
                            "odd": {
                                "parameters": [
                                    {
                                        "name": "param1",
                                        "type": "Int"
                                    }
                                ],
                                "output": {
                                    "type": "bool",
                                    "value": 123
                                }
                            }
                        }
                    }]
                };

                await parseTemplate(template, [
                    "Warning: The parameter 'param1' is never used.",
                    "Warning: The parameter 'param1' of function 'udf.odd' is never used.",
                    'Warning: The user-defined function \'udf.odd\' is never used.'
                ]);
            });
        });

        suite("Unused UDFs", () => {
            test("Unused function", async () => {
                const template = {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "functions": [{
                        "namespace": "myNamespace",
                        "members": {
                            "used": {
                            },
                            "unused": {
                            }
                        }
                    }],
                    "variables": {
                        "v1": "[myNamespace.used()]"
                    },
                    "outputs": {
                        "o1": {
                            "type": "string",
                            "value": "[variables('v1')]"
                        }
                    }

                };

                await parseTemplate(template, [
                    "Warning: The user-defined function 'myNamespace.unused' is never used."
                ]);
            });

            // test("Unused namespace", async () => {
            //     const template = {
            //         "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            //         "contentVersion": "1.0.0.0",
            //         "functions": [{
            //             "namespace": "myNamespace",
            //             "members": {
            //                 "used": {
            //                 }
            //             }
            //         },
            //         {
            //             "namespace": "unusedNamespace1",
            //             "members": {
            //                 "unused": {
            //                 }
            //             }
            //         },
            //         {
            //             "namespace": "unusedNamespace2"
            //         }],
            //         "variables": {
            //             "v1": "[myNamespace.used()]"
            //         },
            //         "outputs": {
            //             "o1": {
            //                 "type": "string",
            //                 "value": "[variables('v1')]"
            //             }
            //         }
            //     };

            //     await parseTemplate(template, [
            //         "Warning: The user-defined namespace 'unusedNamespace1' is never used.",
            //         "Warning: The user-defined namespace 'unusedNamespace2' is never used."
            //     ]);
            // });
        });
    }); // suite Warnings

    suite("UDF Completions", async () => {
        const userFuncsTemplate2: IDeploymentTemplate = {
            "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "functions": [
                {
                    "namespace": "mixedCaseNamespace",
                    "members": {
                        "howdy": {}
                    }
                },
                {
                    "namespace": "udf",
                    "members": {
                        string: {
                            "parameters": [
                                {
                                    "name": "year",
                                    "type": "Int"
                                },
                                {
                                    "name": "month",
                                    // tslint:disable-next-line:no-any
                                    "type": <any>123 // invalid type
                                },
                                {
                                    "name": "day",
                                    "type": "int"
                                }
                            ],
                            "output": {
                                "type": "string",
                                "value": "[<stringOutputValue>]" // This will get replaced in the tests
                            }
                        },
                        parameters: {
                            "parameters": [
                                {
                                    "name": "year",
                                    "type": "Int"
                                },
                                {
                                    "name": "month",
                                    // tslint:disable-next-line:no-any
                                    "type": <any>123 // invalid type
                                },
                                {
                                    "name": "day",
                                    "type": "int"
                                }
                            ],
                            "output": {
                                "type": "string",
                                "value": "[concat(string(parameters('year')), '-', string(parameters('month')), '-', string(parameters('day')))]"
                            }
                        },
                        udf: {
                            "parameters": [
                                {
                                    "name": "year",
                                    "type": "Int"
                                },
                                {
                                    "name": "month",
                                    // tslint:disable-next-line:no-any
                                    "type": <any>123 // invalid type
                                },
                                {
                                    "name": "day",
                                    "type": "int"
                                }
                            ],
                            "output": {
                                "type": "string",
                                "value": "[concat(string(parameters('year')), '-', string(parameters('month')), '-', string(parameters('day')))]"
                            }
                        },
                        udf2: {
                        },
                        udf3: {
                        },
                        udf34: {
                        },
                        mixedCaseFunc: {
                        }
                    }
                }
            ],
            "resources": [
                {
                    "type": "Microsoft.Storage/storageAccounts",
                    "name": "[parameters('year')]",
                    "apiVersion": "[parameters('apiVersion')]",
                    "location": "westus"
                }
            ],
            "parameters": {
                "year": {
                    "type": "int",
                    "defaultValue": 2010
                },
                "apiVersion": {
                    "type": "int",
                    "defaultValue": 2010
                }
            },
            "variables": {
                "var1": {
                    "a": {
                        "b": {
                            "c": 16180339887498948482
                        },
                        "d": 42
                    }
                },
                "var2": "[variables('var1')]"
            },
            "outputs": {
                "output1": {
                    "type": "int",
                    "value": "[<output1>]" // This will get replaced in the tests
                },
                "output2": {
                    "type": "string",
                    "value": "[udf.string(2019, 10, 5)]" // Using user function udf.string
                },
                "output3": {
                    "type": "string",
                    "value": "[string(2019)]" // using built-in function 'string'
                },
                "output4": {
                    "type": "string",
                    "value": "<output4BeforeBrackets>['hello']"
                }
            }
        };

        const allBuiltinsExpectedCompletions = allTestDataExpectedCompletions(0, 0).map(c => <[string, string]>[c.label, c.insertText]);
        const allNamespaceExpectedCompletions: [string, string][] = [["mixedCaseNamespace", "mixedCaseNamespace.$0"], ["udf", "udf.$0"]];
        const allUdfNsFunctionsCompletions: [string, string][] = [
            ["udf.mixedCaseFunc", "mixedCaseFunc()$0"],
            ["udf.string", "string($0)"],
            ["udf.parameters", "parameters($0)"],
            ["udf.udf", "udf($0)"],
            ["udf.udf2", "udf2()$0"],
            ["udf.udf3", "udf3()$0"],
            ["udf.udf34", "udf34()$0"]];
        const allMixedCaseNsFunctionsCompletions: [string, string][] = [["mixedCaseNamespace.howdy", "howdy()$0"]];

        suite("Completing UDF function names", () => {
            suite("Completing udf.xxx gives udf's functions starting with xxx - not found", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.x!', []);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.udf35!', []);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.udf1!', []);
            });

            suite("Completing inside xxx in udf.xxx gives only udf's functions starting with xxx", () => {
                // $0 indicates where the cursor should be placed after replacement
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.p!', [["udf.parameters", "parameters($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.u!', [["udf.udf", "udf($0)"], ["udf.udf2", "udf2()$0"], ["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.ud!', [["udf.udf", "udf($0)"], ["udf.udf2", "udf2()$0"], ["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.udf!', [["udf.udf", "udf($0)"], ["udf.udf2", "udf2()$0"], ["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.udf2!', [["udf.udf2", "udf2()$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.udf3!', [["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.udf34!', [["udf.udf34", "udf34()$0"]]);
            });

            suite("Completing udf.xxx gives udf's functions starting with xxx - case insensitive", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.P!', [["udf.parameters", "parameters($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.U!', [["udf.udf", "udf($0)"], ["udf.udf2", "udf2()$0"], ["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.uD!', [["udf.udf", "udf($0)"], ["udf.udf2", "udf2()$0"], ["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.udF!', [["udf.udf", "udf($0)"], ["udf.udf2", "udf2()$0"], ["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.MIXEDCase!', [["udf.mixedCaseFunc", "mixedCaseFunc()$0"]]);
            });

            suite("Completing built-in functions inside functions", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'param!', [["parameters", "parameters($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'p!', [["padLeft", "padLeft($0)"], ["parameters", "parameters($0)"], ["providers", "providers($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'P!', [["padLeft", "padLeft($0)"], ["parameters", "parameters($0)"], ["providers", "providers($0)"]]);
            });

            suite("Completing built-in functions with UDF function names returns empty", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf1!', []);
            });

            suite("Completing udf.param does not find built-in parameters function", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.param!', [["udf.parameters", "parameters($0)"]]);
            });

            suite("Completing udf. gives udf's functions", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf.!', allUdfNsFunctionsCompletions);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'mixedCaseNamespace.!', allMixedCaseNsFunctionsCompletions);
            });

            suite("Completing udf. case-insensitive", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'MIXEDCASENAMESPACE.!', allMixedCaseNsFunctionsCompletions);
            });

            suite("Completing <unknownnamespace>. gives empty", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'ud2.!', []);
            });

            suite("Completing in middle of function name", () => {
                createCompletionsTest(userFuncsTemplate2, "<output1>", "udf.!udf34", [["udf.mixedCaseFunc", "mixedCaseFunc()$0"], ["udf.string", "string($0)"], ["udf.parameters", "parameters($0)"], ["udf.udf", "udf($0)"], ["udf.udf2", "udf2()$0"], ["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", "udf.u!df34", [["udf.udf", "udf($0)"], ["udf.udf2", "udf2()$0"], ["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", "udf.udf3!4", [["udf.udf3", "udf3()$0"], ["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", "udf.udf34!", [["udf.udf34", "udf34()$0"]]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", "udf.udf345!", []);
            });
        }); // end Completing UDF function names

        suite("Completing UDF namespaces before a function name is typed", () => {
            suite("Unknown namespace or built-in", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'xyz!', []);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf2!', []);
            });

            suite("Only matches namespace", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'ud!', [["udf", "udf.$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf!', [["udf", "udf.$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'mixedCase!', [["mixedCaseNamespace", "mixedCaseNamespace.$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'mixedCaseNamespace!', [["mixedCaseNamespace", "mixedCaseNamespace.$0"]]);
            });

            suite("Only matches namespace - case insensitive", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'ud!', [["udf", "udf.$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf!', [["udf", "udf.$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'MIXEDCASE!', [["mixedCaseNamespace", "mixedCaseNamespace.$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'mixedCASENAMESPACE!', [["mixedCaseNamespace", "mixedCaseNamespace.$0"]]);
            });

            suite("Matches namespaces and built-in functions", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'u!', [["udf", "udf.$0"], ["uniqueString", "uniqueString($0)"], ["uri", "uri($0)"]]);
            });
        }); // end Completing UDF namespaces

        suite("Completing UDF namespaces after a function name already exists", () => {
            suite("Unknown namespace or built-in", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'x!yz.', []);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf2!.', []);
            });

            suite("Matches namespaces and built-in functions", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', '!udf.string', [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'u!df.string', [["udf", "udf.$0"], ["uniqueString", "uniqueString($0)"], ["uri", "uri($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'ud!f.abc', [["udf", "udf.$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'udf!.abc', [["udf", "udf.$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'mixed!Ca.abc', [["mixedCaseNamespace", "mixedCaseNamespace.$0"]]);
            });

            suite("Parameters in outer scope", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'parameters!', [["parameters", "parameters($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'parameters(!', [["'year'", "'year')$0"], ["'apiVersion'", "'apiVersion')$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'parameters(!)', [["'year'", "'year')$0"], ["'apiVersion'", "'apiVersion')$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', "parameters('!y", [["'year'", "'year')$0"], ["'apiVersion'", "'apiVersion')$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', "parameters('y!", [["'year'", "'year')$0"]]);

                // Don't complete parameters against UDF with same name
                createCompletionsTest(userFuncsTemplate2, '<output1>', "udf.parameters('y!", []);
            });

            suite("Parameters in function scope", () => {
                // Parameter completions should only be parameters inside the function
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', 'parameters!', [["parameters", "parameters($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', 'parameters(!', [["'year'", "'year')$0"], ["'day'", "'day')$0"], ["'month'", "'month')$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', "parameters('y!", [["'year'", "'year')$0"]]);
            });

            suite("Variables in outer scope", () => {
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'variables!', [["variables", "variables($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'variables(!', [["'var1'", "'var1')$0"], ["'var2'", "'var2')$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', 'variables(!)', [["'var1'", "'var1')$0"], ["'var2'", "'var2')$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', "variables('!y", [["'var1'", "'var1')$0"], ["'var2'", "'var2')$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', "variables('y!", []);
                createCompletionsTest(userFuncsTemplate2, '<output1>', "variables('v!", [["'var1'", "'var1')$0"], ["'var2'", "'var2')$0"]]);
                createCompletionsTest(userFuncsTemplate2, '<output1>', "variables('var1!", [["'var1'", "'var1')$0"]]);

                // Don't complete variables against UDF with same name
                createCompletionsTest(userFuncsTemplate2, '<output1>', "udf.variables('var1!", []);
            });

            suite("Variables in function scope", () => {
                // CONSIDER: Ideally this would not return a 'variables' completion at all
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', 'variables!', [["variables", "variables($0)"]]);

                // No variables availabe in function scope
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', 'variables(!', []);
            });

            suite("User namespaces and functions not available in function scope", () => {
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', '!udf.string', [...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', 'u!df.string', [["uniqueString", "uniqueString($0)"], ["uri", "uri($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', 'u!', [["uniqueString", "uniqueString($0)"], ["uri", "uri($0)"]]);
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', 'udf!.string', []);
                createCompletionsTest(userFuncsTemplate2, '<stringOutputValue>', 'udf.!', []);
            });

            suite("Property access completions from a function call", () => {
                // Built-in function
                createCompletionsTest(userFuncsTemplate2, "<output1>", 'resourceGroup().!', ["id", "location", "name", "properties", "tags"]);

                // UDF function - don't pick up built-in function members
                createCompletionsTest(userFuncsTemplate2, "<output1>", 'udf.resourceGroup().!', []);
            });

            suite("Property access completions from a properties call", () => {
                const template: Partial<IDeploymentTemplate> = {
                    "parameters": {
                        "param1": {
                            "type": "object",
                            "defaultValue": {
                                a: {
                                    b: 123
                                }
                            }
                        }
                    },
                    "outputs": {
                        o1: {
                            type: "int",
                            value: "[<propaccess>]"
                        }
                    }
                };

                // Parameters call
                createCompletionsTest(template, "<propaccess>", "parameters('param1').!", ["a"]);
                createCompletionsTest(template, "<propaccess>", "parameters('param1').a.!", ["b"]);

                // UDF function with name "parameters"
                createCompletionsTest(template, "<propaccess>", "udf.parameters('param1').!", []);
                createCompletionsTest(template, "<propaccess>", "udf.parameters('param1').a.!", []);
            });

            suite("Property access completions from a variables call", () => {
                const template: Partial<IDeploymentTemplate> = {
                    "variables": {
                        "var1": {
                            a: {
                                b: 123
                            }
                        }
                    },
                    "outputs": {
                        o1: {
                            type: "int",
                            value: "[<varaccess>]"
                        }
                    }
                };

                // Parameters call
                createCompletionsTest(template, "<varaccess>", "variables('var1').!", ["a"]);
                createCompletionsTest(template, "<varaccess>", "variables('var1').a.!", ["b"]);

                // UDF function with name "variables"
                createCompletionsTest(template, "<varaccess>", "udf.variables('var1').!", []);
                createCompletionsTest(template, "<varaccess>", "udf.variables('var1').a.!", []);
            });

        }); // end Completing UDF namespaces after a function name already exists

        suite("UDF completions in larger expression context", () => {
            suite("Starting a new call", () => {
                createCompletionsTest(userFuncsTemplate2, "<output1>", "!", [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", ".!", [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", " . !", [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", " abc !", [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", 'udf.string !', [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", '! udf.string', [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", '!udf .string()', [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", 'udf.string(!)', [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
                createCompletionsTest(userFuncsTemplate2, "<output1>", "udf.string('a', !)", [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);

                // The result here is somwhat ambiguous, but this is good enough
                createCompletionsTest(userFuncsTemplate2, "<output1>", ' udf. ! string()', [...allNamespaceExpectedCompletions, ...allBuiltinsExpectedCompletions]);
            });

            suite("Whitespace not affecting the results", () => {
                createCompletionsTest(userFuncsTemplate2, "<output1>", 'udf. !string()', allUdfNsFunctionsCompletions);
                createCompletionsTest(userFuncsTemplate2, "<output1>", ' udf. !string()', allUdfNsFunctionsCompletions);
            });

            suite("Not in context of an expression", () => {
                createCompletionsTest(userFuncsTemplate2, "<output4BeforeBrackets>", "!", []);
                createCompletionsTest(userFuncsTemplate2, "<output4BeforeBrackets>", " !", []);
                createCompletionsTest(userFuncsTemplate2, "<output4BeforeBrackets>", " ! ", []);
            });
        });

    }); // suite UDF Completions

}); // suite User Functions
