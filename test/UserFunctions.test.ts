// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import * as assert from "assert";
import { DeploymentTemplate, Hover, IReferenceSite, Language, Reference } from "../extension.bundle";
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate, parseTemplateWithMarkers } from "./support/parseTemplate";

suite("User functions", () => {

    const userFuncsTemplate1: IDeploymentTemplate = {
        "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "functions": [
            {
                "namespace": "<!udfDef!>udf",
                "members": {
                    "<!udfStringDef!>string": {
                        "parameters": [
                            {
                                "name": "<!udfYearDef!>year",
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
                            "value": "[concat(string(parameters('<!udfYearRef!>year')), '-', string(parameters('month')), '-', string(parameters('day')))]"
                        }
                    }
                }
            }
        ],
        "resources": [
            {
                "type": "Microsoft.Storage/storageAccounts",
                "name": "[parameters('<!yearRef!>year')]",
                "apiVersion": "[parameters('<!apiVersionRef!>apiVersion')]",
                "location": "westus"
            }
        ],
        "parameters": {
            "<!yearDef!>year": {
                "type": "int",
                "defaultValue": 2010
            },
            "<!apiVersionDef!>apiVersion": {
                "type": "int",
                "defaultValue": 2010
            }
        },
        "variables": {
            "<!var1Def!>var1": {
                "a": {
                    "b": {
                        "c": 16180339887498948482
                    },
                    "d": 42
                }
            },
            "<!var2Def!>var2": "[variables('<!var1Ref1!>var1')]"
        },
        "outputs": {
            "output1": {
                "type": "int",
                "value": "[variables('<!var1Ref2!>var1')]"
            },
            "output2": {
                "type": "string",
                "value": "[<!udfRefAtNs!>udf.<!udfRefAtName!>string(2019, 10, 5)]" // Using user function udf.string
            },
            "output3": {
                "type": "string",
                "value": "[<!stringRef!>string(2019)]" // using built-in function 'string'
            }
        }
    };

    // #region
    suite("UDF Malformed", () => {
        test("missing namespace name", async () => {
            const template = {
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
                "Warning: The parameter 'param1' is never used."
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
                }]
            };

            await parseTemplate(template, []);
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
                "Warning: The parameter 'param1' is never used."
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

            const dt = await parseTemplate(template, [
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
                }]
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

            await parseTemplate(template, []);
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

            const dt = await parseTemplate(template, []);
            assert.equal(dt.topLevelScope.parameterDefinitions.length, 0);
            assert(!dt.topLevelScope.getParameterDefinition('notfound'));
            assert.equal(dt.topLevelScope.namespaceDefinitions.length, 1);
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].members.length, 2);
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].namespaceName.toFriendlyString(), "udf");
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].getMemberDefinition('odd')!.name.toString(), "odd");
            assert.equal(dt.topLevelScope.namespaceDefinitions[0].getMemberDefinition('ODD')!.name.toString(), "odd");
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

            await parseTemplate(template, []);
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

            await parseTemplate(template, []);
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
                'Error: Unrecognized function name \'boo\' in user-defined namespace \'udf\'.'
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
                'Error: Unrecognized user-defined function namespace \'ufo\'.'
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
                'Error: Unrecognized user-defined function namespace \'ufo\'.'
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
                "resources": []
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

        async function testReferences(dt: DeploymentTemplate, cursorIndex: number, expectedReferenceIndices: number[]): Promise<void> {
            const pc = dt.getContextFromDocumentCharacterIndex(cursorIndex);
            const references: Reference.List = (await pc.getReferences())!;
            assert(references, "Expected non-empty list of references");

            const indices = references.spans.map(r => r.startIndex).sort();
            expectedReferenceIndices = expectedReferenceIndices.sort();

            assert.deepStrictEqual(indices, expectedReferenceIndices);
        }

        suite("Find parameter references", () => {
            test("At reference to top-level parameter", async () => {
                const { dt, markers: { apiVersionDef, apiVersionRef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "apiVersion" inside resources
                await testReferences(dt, apiVersionRef.index, [apiVersionRef.index, apiVersionDef.index]);
            });

            test("At definition of top-level parameter", async () => {
                const { dt, markers: { apiVersionDef, apiVersionRef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition to "apiVersion" parameter
                await testReferences(dt, apiVersionDef.index, [apiVersionDef.index, apiVersionRef.index]);
            });

            test("At reference to user function parameter", async () => {
                const { dt, markers: { udfYearRef, udfYearDef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "year" inside user function output
                await testReferences(dt, udfYearRef.index, [udfYearRef.index, udfYearDef.index]);
            });

            test("At definition of user function parameter", async () => {
                const { dt, markers: { udfYearRef, udfYearDef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition of "year" inside user function
                await testReferences(dt, udfYearDef.index, [udfYearRef.index, udfYearDef.index]);
            });

            test("At reference to parameter in user function only finds UDF scope parameter, not top-level param", async () => {
                const { dt, markers: { udfYearRef, udfYearDef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "year" inside user function output
                await testReferences(dt, udfYearRef.index, [udfYearRef.index, udfYearDef.index]);
            });

            test("At definition to parameter in user function only finds UDF scope parameter, not top-level param", async () => {
                const { dt, markers: { udfYearRef, udfYearDef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition of "year" inside user function
                await testReferences(dt, udfYearDef.index, [udfYearRef.index, udfYearDef.index]);
            });

            test("At reference to top-level parameter only finds top-level parameter definition, not param in user function", async () => {
                const { dt, markers: { udfYearRef, udfYearDef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "year" inside user function output
                await testReferences(dt, udfYearRef.index, [udfYearRef.index, udfYearDef.index]);
            });
        });

        suite("UDF Find variable references", () => {
            test("At reference variable", async () => {
                const { dt, markers: { var1Def, var1Ref1, var1Ref2 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at reference to "var1" inside var2
                await testReferences(dt, var1Ref1.index, [var1Def.index, var1Ref1.index, var1Ref2.index]);

                // Cursor at reference to "var1" inside outputs2
                await testReferences(dt, var1Ref2.index, [var1Def.index, var1Ref1.index, var1Ref2.index]);
            });

            test("At definition of variable", async () => {
                const { dt, markers: { var1Def, var1Ref1, var1Ref2 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                // Cursor at definition to "var1" variable
                await testReferences(dt, var1Def.index, [var1Def.index, var1Ref1.index, var1Ref2.index]);
            });
        });

        suite("UDF Find user function references", () => {
            // tslint:disable-next-line: no-suspicious-comment
            if (false) { // TODO: feature not yet implemented
                test("At reference to user-defined function, cursor inside the namespace portion", async () => {
                    const { dt, markers: { udfDef, udfRefAtNs } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                    // Cursor at reference to "udf.string" inside the namespace
                    await testReferences(dt, udfRefAtNs.index, [udfDef.index, udfRefAtNs.index]);
                });

                test("At reference to user-defined function, cursor inside the name portion", async () => {
                    const { dt, markers: { udfStringDef, udfRefAtName } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                    // Cursor at reference to "udf.string" inside the name
                    await testReferences(dt, udfRefAtName.index, [udfStringDef.index, udfRefAtName.index]);
                });

                test("At definition of user-defined function", async () => {
                    const { dt, markers: { udfStringDef, udfRefAtName } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

                    // Cursor at definition of "udf.string"
                    await testReferences(dt, udfStringDef.index, [udfRefAtName.index]);
                });
            }

            test("Reference to built-in function with same name as UDF function doesn't find UDF", async () => {
                const { dt, markers: { stringRef } } = await parseTemplateWithMarkers(userFuncsTemplate1);
                const pc = dt.getContextFromDocumentCharacterIndex(stringRef.index);
                const references: Reference.List | null = (await pc.getReferences());
                assert(!references, "Expected no references");
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
            let hoverInfo: Hover.Info = (await pc.getHoverInfo())!;
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
            const { dt, markers: { yearRef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, yearRef.index, "**year** (parameter)");
        });

        test("Hover over UDF parameter reference", async () => {
            const { dt, markers: { udfYearRef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, udfYearRef.index, "**year** (parameter)");
        });

        test("Hover over top-level variable reference", async () => {
            const { dt, markers: { var1Ref1 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, var1Ref1.index, "**var1** (variable)");
        });

        test("Hover over built-in function reference", async () => {
            const { dt, markers: { stringRef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, stringRef.index, "**string(valueToConvert)**\nConverts the specified value to String.");
        });

        test("Hover over user-defined function reference's name", async () => {
            const { dt, markers: { udfRefAtName } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(dt, udfRefAtName.index, "**udf.string(year [int], month, day [int])** User-defined function");
        });

        test("Hover over user-defined function reference's namespace", async () => {
            const { dt, markers: { udfRefAtNs } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
            await testHover(
                dt,
                udfRefAtNs.index,
                "**udf** User-defined namespace\n\nMembers:\n* string(year [int], month, day [int])");
        });
    }); // suite UDF Hover Info

    suite("UDF Go To Definition", async () => {
        async function testGoToDefinition(
            dt: DeploymentTemplate,
            cursorIndex: number,
            expectedReferenceKind: string,
            expectedDefinitionStart: number
        ): Promise<void> {
            const pc = dt.getContextFromDocumentCharacterIndex(cursorIndex);
            const refInfo: IReferenceSite = (await pc.getReferenceSiteInfo())!;
            assert(refInfo, "Expected non-null IReferenceSite");

            assert.deepStrictEqual(refInfo.kind, expectedReferenceKind);
            assert.deepStrictEqual(refInfo.definitionSpan!.startIndex, expectedDefinitionStart);
        }

        test("Top-level parameter", async () => {
            const { dt, markers: { apiVersionDef, apiVersionRef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "apiVersion" inside resources
            // -1 because go to definition currently goes to the quote at the start of the string
            await testGoToDefinition(dt, apiVersionRef.index, "parameter", apiVersionDef.index - 1);
        });
        test("User function parameter", async () => {
            const { dt, markers: { udfYearRef, udfYearDef } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "year" inside user function output
            await testGoToDefinition(dt, udfYearRef.index, "parameter", udfYearDef.index - 1);
        });

        test("Variable reference", async () => {
            const { dt, markers: { var1Def, var1Ref1, var1Ref2 } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "var1" inside var2
            await testGoToDefinition(dt, var1Ref1.index, "variable", var1Def.index - 1);

            // Cursor at reference to "var1" inside outputs2
            await testGoToDefinition(dt, var1Ref2.index, "variable", var1Def.index - 1);
        });

        test("User-defined function, cursor inside the namespace portion", async () => {
            const { dt, markers: { udfDef, udfRefAtNs } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "udf.string" inside the namespace -> goes to namespace definition
            await testGoToDefinition(dt, udfRefAtNs.index, "userNamespace", udfDef.index - 1);
        });

        test("User-defined function, cursor inside the name portion", async () => {
            const { dt, markers: { udfStringDef, udfRefAtName } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });

            // Cursor at reference to "udf.string" inside the name
            await testGoToDefinition(dt, udfRefAtName.index, "userFunction", udfStringDef.index - 1);
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
                    "Warning: The parameter 'param1' is never used."
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
                    "Warning: The parameter 'param1' of function 'udf.odd' is never used."
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
                    "Warning: The parameter 'param1' of function 'udf.odd' is never used."
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
                    "Warning: The parameter 'param1' of function 'udf.odd' is never used."
                ]);
            });
        });
    });

}); // suite User Functions
