// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length insecure-random
// tslint:disable:object-literal-key-quotes no-function-expression no-non-null-assertion align no-http-string

import * as assert from "assert";
import { Position, Range, Uri } from "vscode";
import { IGotoParameterValueArgs, IParameterValuesSource, IParameterValuesSourceProvider, ParameterDefinitionCodeLens, ParentOrChildCodeLens, ShowCurrentParameterFileCodeLens } from "../extension.bundle";
import { IDeploymentTemplate, IPartialDeploymentTemplate } from "./support/diagnostics";
import { ensureLanguageServerAvailable } from "./support/ensureLanguageServerAvailable";
import { parseParametersWithMarkers, parseTemplate } from "./support/parseTemplate";
import { rangeToString } from "./support/rangeToString";
import { sortBy } from "./support/sortBy";
import { stringify } from "./support/stringify";
import { testWithLanguageServer } from "./support/testWithLanguageServer";

suite("DeploymentTemplate code lenses", () => {
    class FakeParameterValuesSourceProvider implements IParameterValuesSourceProvider {
        public constructor(
            public readonly parameterFileUri: Uri | undefined,
            private readonly parameterValuesSource: IParameterValuesSource) {
        }

        public async getValuesSource(): Promise<IParameterValuesSource> {
            return this.parameterValuesSource;
        }
    }

    const template1: IDeploymentTemplate = {
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            "requiredInt": {
                "type": "int"
            },
            "optionalInt": {
                "type": "int",
                "defaultValue": 123
            },

            "requiredString": {
                "type": "string"
            },
            "optionalString": {
                "type": "string",
                "defaultValue": "abc"
            },
            "optionalString2": {
                "type": "string",
                "defaultValue": "[parameters('optionalString')]"
            },

            "requiredSecureString": {
                "type": "securestring"
            },
            "optionalSecureString": {
                "type": "securestring",
                "defaultValue": "abc"
            },

            "requiredBool": {
                "type": "bool"
            },
            "optionalBool": {
                "type": "bool",
                "defaultValue": true
            },

            "requiredArray": {
                "type": "array"
            },
            "optionalArray": {
                "type": "array",
                "defaultValue": [
                    true
                ]
            },

            "requiredObject": {
                "type": "object"
            },
            "optionalObject": {
                "type": "object",
                "defaultValue": {
                    "myTrueProp": true
                }
            },

            "requiredSecureObject": {
                "type": "secureObject"
            },
            "optionalSecureObject": {
                "type": "secureObject",
                "defaultValue": {
                    "value1": true
                }
            }
        },
        "functions": [
        ],
        "variables": {
        },
        "resources": [
        ],
        "outputs": {
            "output1": {
                "type": "array",
                "value": [
                    // Get rid of unused warnings
                    "[add(parameters('optionalInt'),parameters('requiredInt'))]",
                    "[concat(parameters('optionalString'),parameters('optionalString2'),parameters('requiredString'))]",
                    "[concat(parameters('optionalBool'),parameters('requiredBool'))]",
                    "[concat(parameters('optionalArray'),parameters('requiredArray'))]",
                    "[concat(parameters('optionalObject'),parameters('requiredObject'))]",
                    "[concat(parameters('optionalSecureObject'),parameters('requiredSecureObject'))]",
                    "[concat(parameters('optionalSecureString'),parameters('requiredSecureString'))]"
                ]
            }
        }
    };

    suite("parameters section code lens", () => {
        suite("if no parameter file then", () => {
            test("expect only a single parameters section code lens", async () => {
                const dt = await parseTemplate(template1);
                const lenses = dt.getCodeLenses(undefined);
                assert.equal(lenses.length, 1, "Expecting only a code lens for the parameters section itself");
            });

            test("code lens should show command to select/create one", async () => {
                const dt = await parseTemplate(template1);
                const lenses = dt.getCodeLenses(undefined);
                for (const lens of lenses) {
                    const result = await lens.resolve();
                    assert(result);
                }
                assert.equal(stringify(lenses[0].range), stringify(new Range(new Position(3, 2), new Position(63, 3))));
                assert.equal(lenses[0].command?.title, "Select or create a parameter file to enable full validation...");
                assert.equal(lenses[0].command?.command, "azurerm-vscode-tools.selectParameterFile");
                assert.equal(lenses[0].command?.arguments?.length, 1);
                assert(lenses[0].command?.arguments![0] instanceof Uri);
                assert.equal(lenses[0].command?.arguments![0].toString(), dt.documentUri.toString());
            });
        });

        suite("if there is a parameter file then", () => {
            test("parameter section code lens should show command to open current parameter file and one to change the selection", async () => {
                const dt = await parseTemplate(template1);
                const { dp } = await parseParametersWithMarkers({});
                const lenses = dt.getCodeLenses(new FakeParameterValuesSourceProvider(dp.documentUri, dp.parameterValuesSource));
                assert.equal(lenses.length, 2 + dt.topLevelScope.parameterDefinitions.length);
                for (const lens of lenses) {
                    const result = await lens.resolve();
                    assert(result);
                }

                const openLens = lenses.filter(l => l instanceof ShowCurrentParameterFileCodeLens)[0];
                assert.equal(stringify(openLens.range), stringify(new Range(new Position(3, 2), new Position(63, 3))));
                assert.equal(openLens.command?.title, `Parameter file: "test parameter file.json" $(error) Not found`);
                assert.equal(openLens.command?.command, "azurerm-vscode-tools.openParameterFile");
                assert.equal(openLens.command?.arguments?.length, 1);
                assert(openLens.command?.arguments![0] instanceof Uri);
                assert.equal(openLens.command?.arguments![0].toString(), dt.documentUri.toString());

                const selectLens = lenses[1];
                assert.equal(stringify(selectLens.range), stringify(new Range(new Position(3, 2), new Position(63, 3))));
                assert.equal(selectLens.command?.title, `Change...`);
                assert.equal(selectLens.command?.command, "azurerm-vscode-tools.selectParameterFile");
                assert.equal(selectLens.command?.arguments?.length, 1);
                assert(selectLens.command?.arguments![0] instanceof Uri);
                assert.equal(selectLens.command?.arguments![0].toString(), dt.documentUri.toString());
            });
        });
    });

    suite("parameter definition code lenses", () => {

        suite("with top-level parameter definitions and values in a parameter file", () => {
            function createParamLensTest(topLevelParamName: string, valueInParamFile: { value?: string; reference?: string } | undefined, expectedTitle: string): void {
                const testName = valueInParamFile === undefined ?
                    `${topLevelParamName} with no value in param file` :
                    `${topLevelParamName} with value ${JSON.stringify(valueInParamFile).replace(/\r\n|\n/g, ' ')}`;
                test(testName, async () => {
                    let a = testName;
                    a = a;
                    const dt = await parseTemplate(template1);
                    const param = dt.topLevelScope.getParameterDefinition(topLevelParamName);
                    assert(!!param);
                    const { dp } = await parseParametersWithMarkers(
                        valueInParamFile === undefined ? {
                            "parameters": {}
                        } : valueInParamFile.value ? `{
                        "parameters": {
                            "${topLevelParamName}": {
                                "value": ${valueInParamFile.value}
                            }
                        }
                    }` : `{
                            "parameters": {
                                "${topLevelParamName}": {
                                    "reference": ${valueInParamFile.reference}
                                }
                            }
                        }`);
                    const lenses = dt.getCodeLenses(new FakeParameterValuesSourceProvider(dp.documentUri, dp.parameterValuesSource))
                        .filter(l => l instanceof ParameterDefinitionCodeLens)
                        .map(l => <ParameterDefinitionCodeLens>l);
                    assert.equal(lenses.length, dt.topLevelScope.parameterDefinitions.length);

                    // Find the code lens for the parameter
                    const lens = lenses.find(l => l.parameterDefinition === param);
                    assert(!!lens, `Couldn't find a code lens for parameter ${param.nameValue.unquotedValue}`);

                    const result = await lens.resolve();
                    assert.equal(result, true);
                    assert.equal(lens.command?.command, "azurerm-vscode-tools.codeLens.gotoParameterValue");
                    const expectedArgs: IGotoParameterValueArgs = {
                        inParameterFile: {
                            parameterFileUri: dp.documentUri,
                            parameterName: param.nameValue.unquotedValue
                        }
                    };
                    assert.deepEqual(lens.command?.arguments, [expectedArgs]);
                    assert.equal(lens.command?.title, expectedTitle);
                });
            }

            createParamLensTest('requiredInt', { value: '123' }, 'Value: 123');
            createParamLensTest('requiredInt', { value: '-123' }, 'Value: -123');
            createParamLensTest('optionalInt', undefined, 'Using default value');
            createParamLensTest('requiredInt', undefined, '$(warning) No value found - click here to enter a value');

            createParamLensTest('requiredString', { value: '"def"' }, 'Value: "def"');
            createParamLensTest('optionalString', undefined, 'Using default value');
            createParamLensTest('requiredString', undefined, '$(warning) No value found - click here to enter a value');

            // Value too long
            createParamLensTest(
                'requiredString',
                { value: '"I am a very long string, yes, sir, a very long string indeed.  If I were a very long string, I would say that I am a very long string, yes, sir, a very long string indeed."' },
                'Value: "I am a very long string, yes, sir, a very long string indeed.  If I were a very long string, I would say that I ...');

            createParamLensTest('optionalSecureString', { value: '"def"' }, 'Value: "def"');
            createParamLensTest('optionalSecureString', undefined, 'Using default value');
            createParamLensTest(
                'optionalSecureString',
                {
                    reference: `{
                    "keyVault": {
                        "id": "/subscriptions/*************/resourceGroups/*******/providers/Microsoft.KeyVault/vaults/****"
                    },
                    "secretName": "mysecretpassword"
            }`},
                'Value: (KeyVault reference)');

            createParamLensTest('optionalBool', { value: 'true' }, 'Value: true');
            createParamLensTest('optionalBool', { value: 'false' }, 'Value: false');
            createParamLensTest('optionalBool', undefined, 'Using default value');

            createParamLensTest('optionalArray', { value: '[]' }, 'Value: []');
            createParamLensTest('optionalArray', { value: '[\n]' }, 'Value: []');
            createParamLensTest('optionalArray', { value: '[\r\n]' }, 'Value: []');
            createParamLensTest('optionalArray', { value: '[\r\n\t     123\t\r\n    ]' }, 'Value: [123]');
            createParamLensTest('optionalArray', { value: '[\r\n\t     {"a": "b"}\t\r\n    ]' }, 'Value: [{"a": "b"}]');
            createParamLensTest('optionalArray', undefined, 'Using default value');

            createParamLensTest('optionalObject', { value: '{}' }, 'Value: {}');
            createParamLensTest('optionalObject', { value: '{\r\n"a": "b",\r\n  "i": -123}' }, 'Value: {"a": "b", "i": -123}');
            createParamLensTest('optionalObject', undefined, 'Using default value');

            createParamLensTest('optionalSecureObject', { value: '{}' }, 'Value: {}');
            createParamLensTest('optionalSecureObject', undefined, 'Using default value');

            suite("undefined in param value", () => {
                createParamLensTest('optionalString', { value: 'undefined' }, 'Using default value');
            });
            suite("Expression in default value", () => {
                createParamLensTest('optionalString2', { value: '"123"' }, 'Value: "123"');
                createParamLensTest('optionalString2', undefined, `Using default value`);
            });
        });

        suite("parameters for nested inner-scoped template", () => {
            function createCodeLensTest(testName: string, template: IPartialDeploymentTemplate, expected: string[]): void {
                testWithLanguageServer(testName, async () => {
                    testName = testName;
                    const dt = await parseTemplate(template);

                    await ensureLanguageServerAvailable();

                    let lenses = dt.getCodeLenses(undefined).filter(cl => !(cl instanceof ParentOrChildCodeLens));
                    for (const lens of lenses) {
                        const result = await lens.resolve();
                        assert(result);
                    }

                    lenses = sortBy(lenses, l => l.range);
                    const actual: string[] = lenses.map(l => {
                        return `${l.scope.scopeKind}: "${l.command?.title}" (${l.command?.command}) at ${rangeToString(l.range)}`;
                    });
                    assert.deepEqual(actual, expected);
                });
            }

            createCodeLensTest(
                "nested inner-scope template with parameter values",
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [
                        {
                            "type": "Microsoft.Resources/deployments",
                            "apiVersion": "2019-10-01",
                            "name": "inner1",
                            "properties": {
                                "expressionEvaluationOptions": {
                                    "scope": "inner"
                                },
                                "parameters": {
                                    "p2": {
                                        "value": "p2 value"
                                    },
                                    "p3": {
                                        "value": "[add(1, 2)]"
                                    }
                                },
                                "mode": "Incremental",
                                "template": {
                                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                                    "contentVersion": "1.0.0.0",
                                    "parameters": {
                                        "p1": {
                                            "type": "string",
                                            "defaultValue": "p1 default value"
                                        },
                                        "p2": {
                                            "type": "string"
                                        },
                                        "p3": {
                                            "type": "int"
                                        },
                                        "p4": {
                                            "type": "string"
                                        }
                                    },
                                    "resources": [
                                    ],
                                    "outputs": {
                                        "v1": {
                                            "type": "string",
                                            "value": "[parameters('p1')]"
                                        }
                                    }
                                }
                            }
                        }
                    ]
                },
                [
                    "TopLevel: \"Select or create a parameter file to enable full validation...\" (azurerm-vscode-tools.selectParameterFile) at [1,1-1,1]",
                    "NestedDeploymentWithInnerScope: \"Nested template with inner scope ($(warning)Full validation off)\" () at [22,21-47,10]",
                    "NestedDeploymentWithInnerScope: \"Using default value\" (azurerm-vscode-tools.codeLens.gotoParameterValue) at [26,13-26,17]",
                    "NestedDeploymentWithInnerScope: \"Value: \"p2 value\"\" (azurerm-vscode-tools.codeLens.gotoParameterValue) at [30,13-30,17]",
                    "NestedDeploymentWithInnerScope: \"Value: \"[add(1, 2)]\"\" (azurerm-vscode-tools.codeLens.gotoParameterValue) at [33,13-33,17]",
                    "NestedDeploymentWithInnerScope: \"$(warning) No value found - click here to enter a value\" (azurerm-vscode-tools.codeLens.gotoParameterValue) at [36,13-36,17]",
                ]
            );

            createCodeLensTest(
                "nested inner-scope template with no parameters object",
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [
                        {
                            "type": "Microsoft.Resources/deployments",
                            "apiVersion": "2019-10-01",
                            "name": "inner1",
                            "properties": {
                                "expressionEvaluationOptions": {
                                    "scope": "inner"
                                },
                                "mode": "Incremental",
                                "template": {
                                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                                    "contentVersion": "1.0.0.0",
                                    "parameters": {
                                        "p1": {
                                            "type": "string",
                                            "defaultValue": "p1 default value"
                                        },
                                        "p2": {
                                            "type": "string"
                                        },
                                        "p3": {
                                            "type": "int"
                                        },
                                        "p4": {
                                            "type": "string"
                                        }
                                    },
                                    "resources": [
                                    ],
                                    "outputs": {
                                        "v1": {
                                            "type": "string",
                                            "value": "[parameters('p1')]"
                                        }
                                    }
                                }
                            }
                        }
                    ]
                },
                [
                    "TopLevel: \"Select or create a parameter file to enable full validation...\" (azurerm-vscode-tools.selectParameterFile) at [1,1-1,1]",
                    "NestedDeploymentWithInnerScope: \"Nested template with inner scope ($(warning)Full validation off)\" () at [14,21-39,10]",
                    "NestedDeploymentWithInnerScope: \"Using default value\" (azurerm-vscode-tools.codeLens.gotoParameterValue) at [18,13-18,17]",
                    "NestedDeploymentWithInnerScope: \"$(warning) No value found - click here to enter a value\" (azurerm-vscode-tools.codeLens.gotoParameterValue) at [22,13-22,17]",
                    "NestedDeploymentWithInnerScope: \"$(warning) No value found - click here to enter a value\" (azurerm-vscode-tools.codeLens.gotoParameterValue) at [25,13-25,17]",
                    "NestedDeploymentWithInnerScope: \"$(warning) No value found - click here to enter a value\" (azurerm-vscode-tools.codeLens.gotoParameterValue) at [28,13-28,17]",
                ]
            );

        });
    });

});
