// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length insecure-random
// tslint:disable:object-literal-key-quotes no-function-expression no-non-null-assertion align no-http-string

import * as assert from "assert";
import { Position, Range, Uri } from "vscode";
import { ParameterDefinitionCodeLens } from "../extension.bundle";
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseParametersWithMarkers, parseTemplate } from "./support/parseTemplate";
import { stringify } from "./support/stringify";

suite("DeploymentTemplate code lenses", () => {
    const template: IDeploymentTemplate = {
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
                const dt = await parseTemplate(template);
                const lenses = dt.getCodeLenses(false);
                assert.equal(lenses.length, 1, "Expecting only a code lens for the parameters section itself");
            });

            test("code lens should show command to select/create one", async () => {
                const dt = await parseTemplate(template);
                const lenses = dt.getCodeLenses(false);
                lenses.forEach(lens => lens.resolve(undefined));
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
                const dt = await parseTemplate(template);
                const { dp } = await parseParametersWithMarkers({});
                const lenses = dt.getCodeLenses(true);
                assert.equal(lenses.length, 2 + dt.topLevelScope.parameterDefinitions.length);
                lenses.forEach(lens => lens.resolve(dp));

                const openLens = lenses[0];
                assert.equal(stringify(openLens.range), stringify(new Range(new Position(3, 2), new Position(63, 3))));
                assert.equal(openLens.command?.title, `Parameter file: "test parameter file.json"`);
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

    suite("parameter definition code lenses with a parameter file", () => {
        function createParamLensTest(topLevelParamName: string, valueInParamFile: string | undefined, expectedTitle: string): void {
            const testName = valueInParamFile === undefined ?
                `${topLevelParamName} with no value in param file` :
                `${topLevelParamName} with value ${valueInParamFile.replace(/\r\n|\n/g, ' ')}`;
            test(testName, async () => {
                const dt = await parseTemplate(template);
                const param = dt.topLevelScope.getParameterDefinition(topLevelParamName);
                assert(!!param);
                const { dp } = await parseParametersWithMarkers(
                    valueInParamFile === undefined ? {
                        "parameters": {}
                    } : `{
                        "parameters": {
                            "${topLevelParamName}": {
                                "value": ${valueInParamFile}
                            }
                        }
                    }`);
                const lenses = dt.getCodeLenses(true)
                    .filter(l => l instanceof ParameterDefinitionCodeLens)
                    .map(l => <ParameterDefinitionCodeLens>l);
                assert.equal(lenses.length, dt.topLevelScope.parameterDefinitions.length);

                // Find the code lens for the parameter
                const lens = lenses.find(l => l.parameterDefinition === param);
                assert(!!lens, `Couldn't find a code lens for parameter ${param.nameValue.unquotedValue}`);

                lens.resolve(dp);
                assert.equal(lens.command?.command, "azurerm-vscode-tools.codeLens.gotoParameterValue");
                assert.deepEqual(lens.command?.arguments, [
                    dp.documentUri,
                    param.nameValue.unquotedValue
                ]);
                assert.equal(lens.command?.title, expectedTitle);
            });
        }

        createParamLensTest('requiredInt', '123', 'Value: 123');
        createParamLensTest('requiredInt', '-123', 'Value: -123');
        createParamLensTest('optionalInt', undefined, 'Using default value: 123');
        createParamLensTest('requiredInt', undefined, '$(warning) No value found');

        createParamLensTest('requiredString', '"def"', 'Value: "def"');
        createParamLensTest('optionalString', undefined, 'Using default value: "abc"');
        createParamLensTest('requiredString', undefined, '$(warning) No value found');

        // Value too long
        createParamLensTest(
            'requiredString',
            '"I am a very long string, yes, sir, a very long string indeed.  If I were a very long string, I would say that I am a very long string, yes, sir, a very long string indeed."',
            'Value: "I am a very long string, yes, sir, a very long string indeed.  If I were a very long string, I would say that I ...');

        createParamLensTest('optionalSecureString', '"def"', 'Value: "def"');
        createParamLensTest('optionalSecureString', undefined, 'Using default value: "abc"');
        createParamLensTest(
            'optionalSecureString',
            `{
                "reference": {
                    "keyVault": {
                        "id": "/subscriptions/*************/resourceGroups/*******/providers/Microsoft.KeyVault/vaults/****"
                    },
                    "secretName": "mysecretpassword"
                }
            }`,
            'Value: (KeyVault reference)');

        createParamLensTest('optionalBool', 'true', 'Value: true');
        createParamLensTest('optionalBool', 'false', 'Value: false');
        createParamLensTest('optionalBool', undefined, 'Using default value: true');

        createParamLensTest('optionalArray', '[]', 'Value: []');
        createParamLensTest('optionalArray', '[\n]', 'Value: []');
        createParamLensTest('optionalArray', '[\r\n]', 'Value: []');
        createParamLensTest('optionalArray', '[\r\n\t     123\t\r\n    ]', 'Value: [123]');
        createParamLensTest('optionalArray', '[\r\n\t     {"a": "b"}\t\r\n    ]', 'Value: [{"a": "b"}]');
        createParamLensTest('optionalArray', undefined, 'Using default value: [true]');

        createParamLensTest('optionalObject', '{}', 'Value: {}');
        createParamLensTest('optionalObject', '{\r\n"a": "b",\r\n  "i": -123}', 'Value: {"a": "b", "i": -123}');
        createParamLensTest('optionalObject', undefined, 'Using default value: {"myTrueProp": true}');

        createParamLensTest('optionalSecureObject', '{}', 'Value: {}');
        createParamLensTest('optionalSecureObject', undefined, 'Using default value: {"value1": true}');

        suite("undefined in param value", () => {
            createParamLensTest('optionalString', 'undefined', 'Using default value: "abc"');
        });
        suite("Expression in default value", () => {
            createParamLensTest('optionalString2', '"123"', 'Value: "123"');
            createParamLensTest('optionalString2', undefined, `Using default value: "[parameters('optionalString')]"`);
        });
    });
});
