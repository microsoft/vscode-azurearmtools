// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length cyclomatic-complexity promise-function-async align max-line-length max-line-length no-undefined-keyword
// tslint:disable:no-non-null-assertion object-literal-key-quotes

import * as assert from "assert";
import { Uri } from "vscode";
import { Completion, DeploymentTemplateDoc, strings, TemplatePositionContext } from "../extension.bundle";
import { IPartialDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate, parseTemplateWithMarkers } from "./support/parseTemplate";
import { stringify } from "./support/stringify";
import { UseNoSnippets } from "./support/TestSnippets";
import { testWithPrep } from "./support/testWithPrep";
import { allTestDataCompletionNames, allTestDataExpectedCompletions, parameterCompletion, propertyCompletion, variableCompletion } from "./TestData";

const fakeId = Uri.file("https://doc-id");

suite("TemplatePositionContext.completions", () => {
    suite("completionItems", async () => {
        function addCursor(documentText: string, markerIndex: number): string {
            return `${documentText.slice(0, markerIndex)}<CURSOR>${documentText.slice(markerIndex)}`;
        }

        function completionItemsTest(documentText: string, index: number, expectedCompletionItems: Completion.Item[]): void {
            const testName = `with ${strings.escapeAndQuote(addCursor(documentText, index))} at index ${index}`;
            testWithPrep(
                testName,
                [UseNoSnippets.instance],
                async () => {
                    let keepInClosureForEasierDebugging = testName;
                    keepInClosureForEasierDebugging = keepInClosureForEasierDebugging;

                    const dt = new DeploymentTemplateDoc(documentText, fakeId);
                    const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(index, undefined);

                    let completionItems: Completion.Item[] = (await pc.getCompletionItems(undefined)).items;
                    const completionItems2: Completion.Item[] = (await pc.getCompletionItems(undefined)).items;
                    assert.deepStrictEqual(completionItems, completionItems2, "Got different results");

                    compareTestableCompletionItems(completionItems, expectedCompletionItems);
                });
        }

        function compareTestableCompletionItems(actualItems: Completion.Item[], expectedItems: Completion.Item[]): void {
            let isFunctionCompletions = expectedItems.some(item => allTestDataCompletionNames.has(item.label));

            // Ignore functions that aren't in our testing list
            if (isFunctionCompletions) {
                // Unless it's an empty list - then we want to ensure the actual list is empty, too
                if (expectedItems.length > 0) {
                    actualItems = actualItems.filter(item => allTestDataCompletionNames.has(item.label));
                }
            }

            // Make it easier to see missing names quickly
            let actualNames = actualItems.map(item => item.label);
            let expectedNames = expectedItems.map(item => typeof item === 'string' ? item : item.label);
            assert.deepStrictEqual(actualNames, expectedNames);

            assert.deepEqual(actualItems, expectedItems);
        }

        // NOTE: We are testing against test metadata, not the real data

        suite("test 01", () => {
            for (let i = 0; i <= 24; ++i) {
                completionItemsTest(`{ 'a': "[concat('B')]" }`, i,
                    (i >= 9 && i <= 15) ? allTestDataExpectedCompletions(9, i - 9) :
                        (i === 20) ? allTestDataExpectedCompletions(20, 0) :
                            []);
            }
        });

        const repetitions = 1;
        for (let repetition = 0; repetition < repetitions; ++repetition) {
            suite("test 02", () => {
                for (let i = 9; i <= 9; ++i) {
                    completionItemsTest(`{ "variables": { "v1": "value1" }, "v": "V" }`, i, []);
                }
            });

            suite("test 03", () => {
                for (let i = 0; i <= 25; ++i) {
                    completionItemsTest(`{ 'a': 'A', 'b': "[concat`, i,
                        (i >= 19 && i <= 25) ? allTestDataExpectedCompletions(19, i - 19) : []);
                }
            });

            suite("test 04", () => {
                for (let i = 0; i <= 23; ++i) {
                    completionItemsTest(`{ 'a': 'A', 'b': "[spif`, i,
                        (i >= 19 && i <= 23) ? allTestDataExpectedCompletions(19, i - 19) : []);
                }
            });

            suite("test 05", () => {
                for (let i = 0; i <= 33; ++i) {
                    completionItemsTest(`{ 'a': 'A', 'b': "[concat  ()]" }`, i,
                        (i >= 19 && i <= 25) ? allTestDataExpectedCompletions(19, i - 19) :
                            (26 <= i && i <= 29) ? allTestDataExpectedCompletions(i, 0) :
                                []);
                }
            });

            suite("test 06", () => {
                for (let i = 0; i <= 80; ++i) {
                    completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': "[concat(')]"`, i,
                        (i >= 69 && i <= 75) ? allTestDataExpectedCompletions(69, i - 69) :
                            (i === 80) ? allTestDataExpectedCompletions(80, 0) :
                                []);
                }
            });

            suite("test 07", () => {
                for (let i = 0; i <= 24; ++i) {
                    completionItemsTest(`{ 'a': "[variables()]" }`, i,
                        (i >= 9 && i <= 18) ? allTestDataExpectedCompletions(9, i - 9) :
                            (i === 20) ? allTestDataExpectedCompletions(20, 0) :
                                []);
                }
            });

            suite("test 08", () => {
                for (let i = 0; i <= 56; ++i) {
                    completionItemsTest(`{ 'variables': { 'v1': 'value1' }, 'a': "[variables(]" }`, i,
                        // after the "[": all
                        (i >= 42 && i <= 51) ? allTestDataExpectedCompletions(42, i - 42) :
                            // after "[variables(": "v1" is only completion
                            (i === 52) ? [
                                variableCompletion("v1", 52, 0)
                            ] :
                                []);
                }
            });

            suite("test 09", () => {
                for (let i = 0; i <= 57; ++i) {
                    completionItemsTest(`{ 'variables': { 'v1': 'value1' }, 'a': "[variables()]" }`, i,
                        (i === 42 || i === 53) ? allTestDataExpectedCompletions(i, 0) :
                            (i >= 43 && i <= 51) ? allTestDataExpectedCompletions(42, i - 42) :
                                (i === 52) ? [
                                    variableCompletion("v1", 52, 1)
                                ] :
                                    []);
                }
            });

            suite("test 10", () => {
                for (let i = 0; i <= 52; ++i) {
                    completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables(')]`, i,
                        (i >= 39 && i <= 48) ? allTestDataExpectedCompletions(39, i - 39) :
                            (i === 49) ? [variableCompletion("vName", 49, 0, false)] :
                                (i === 50 || i === 51) ? [variableCompletion("vName", 49, 2)] :
                                    []);
                }
            });

            suite("test 11", () => {
                for (let i = 0; i <= 53; ++i) {
                    completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('v)]`, i,
                        (i >= 39 && i <= 48) ? allTestDataExpectedCompletions(39, i - 39) :
                            (i === 49) ? [variableCompletion("vName", 49, 0, false)] :
                                (50 <= i && i <= 52) ? [variableCompletion("vName", 49, 3)] :
                                    []);
                }
            });

            suite("test 12", () => {
                for (let i = 0; i <= 56; ++i) {
                    completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('')]" }`, i,
                        (i === 39 || i === 52) ? allTestDataExpectedCompletions(i, 0) :
                            (i >= 40 && i <= 48) ? allTestDataExpectedCompletions(39, i - 39) :
                                (i === 49) ? [variableCompletion("vName", 49, 0, false)] :
                                    (i === 50) ? [variableCompletion("vName", 49, 3)] :
                                        []);
                }
            });

            suite("test 13", () => {
                for (let i = 0; i <= 140; ++i) {
                    // 70: ''Microsoft...
                    completionItemsTest(`{ "parameters": { "adminUsername": {} }, "a": "[resourceId(parameters(''Microsoft.Networks/virtualNetworks', parameters('adminUsername'))]" }`, i,
                        (i === 48 || i === 59 || (73 <= i && i <= 138)) ? allTestDataExpectedCompletions(i, 0) :
                            (49 <= i && i <= 58) ?
                                allTestDataExpectedCompletions(48, i - 48)
                                : (60 <= i && i <= 69) ?
                                    allTestDataExpectedCompletions(59, i - 59)
                                    :
                                    (i === 70) ? [parameterCompletion("adminUsername", 70, 0, false)] // before the string
                                        : (i === 71) ? [parameterCompletion("adminUsername", 70, 2)] : // in the string
                                            []);
                }
            });

            suite("test 14", () => {
                for (let i = 0; i <= 140; ++i) {
                    // 48: resourceId
                    // 59: parameters
                    // 70: 'Microsoft.Networks/virtualNetworks'
                    // 106: comma
                    // 108: parameters('adminUsername')
                    // 119: 'adminUsername'
                    completionItemsTest(`{ "parameters": { "adminUsername": {} }, "a": "[resourceId(parameters('Microsoft.Networks/virtualNetworks', parameters('adminUsername'))]" }`, i,
                        (48 <= i && i <= 58) ? allTestDataExpectedCompletions(48, i - 48) :
                            (59 <= i && i <= 69) ? allTestDataExpectedCompletions(59, i - 59) :
                                (i === 70) ? [parameterCompletion("adminUsername", 70, 0, false)] :
                                    (71 <= i && i <= 105) ? [parameterCompletion("adminUsername", 70, 36, false)] :
                                        (i === 107) ? allTestDataExpectedCompletions(107, 0) :
                                            (108 <= i && i <= 118) ? allTestDataExpectedCompletions(108, i - 108) :
                                                (i === 119) ? [parameterCompletion("adminUsername", 119, 0, false)] :
                                                    (i >= 120 && i <= 133) ? [parameterCompletion("adminUsername", 119, 16)] :
                                                        (i >= 135 && i <= 136) ? allTestDataExpectedCompletions(i, 0) :
                                                            []);
                }
            });

            suite("test 15", () => {
                for (let i = 0; i <= 137; ++i) {
                    // 47: resourceId(
                    // 58: variables(
                    // 68: 'Microsoft...
                    // 104: comma
                    // 106: variables('adminUsername')
                    // 116: 'adminUsername'
                    completionItemsTest(`{ "variables": { "adminUsername": "" }, "a": "[resourceId(variables('Microsoft.Networks/virtualNetworks', variables('adminUsername'))]" }`, i,
                        (i >= 47 && i <= 57) ? allTestDataExpectedCompletions(47, i - 47) :
                            (i >= 58 && i <= 67) ? allTestDataExpectedCompletions(58, i - 58) :
                                (i === 68) ? [variableCompletion("adminUsername", 68, 0, false)] :
                                    (i >= 69 && i <= 103) ? [variableCompletion("adminUsername", 68, 36, false)] :
                                        (i === 105) ? allTestDataExpectedCompletions(105, 0) : // space after comma
                                            (106 <= i && i <= 115) ? allTestDataExpectedCompletions(106, i - 106) :
                                                (i === 116) ? [variableCompletion("adminUsername", 116, 0, false)] :
                                                    (117 <= i && i <= 130) ? [variableCompletion("adminUsername", 116, 16)] :
                                                        (i >= 132 && i <= 133) ? allTestDataExpectedCompletions(i, 0) :
                                                            []);
                }
            });

            suite("test 16", () => {
                for (let i = 0; i <= 25; ++i) {
                    completionItemsTest(`{ 'a': "[parameters()]" }`, i,
                        (i >= 9 && i <= 19) ? allTestDataExpectedCompletions(9, i - 9) :
                            (i === 20) ? [] :
                                (i === 21) ? allTestDataExpectedCompletions(21, 0) :
                                    []);
                }
            });

            suite("test 17", () => {
                for (let i = 0; i <= 52; ++i) {
                    completionItemsTest(`{ 'parameters': { 'p1': {} }, 'a': "[parameters(]" }`, i,
                        (i >= 37 && i <= 47) ? allTestDataExpectedCompletions(37, i - 37) :
                            (i === 48) ? [parameterCompletion("p1", 48, 0)] :
                                []);
                }
            });

            suite("test 18", () => {
                for (let i = 0; i <= 81; ++i) {
                    completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': "[parameters('`, i,
                        (i >= 69 && i <= 79) ? allTestDataExpectedCompletions(69, i - 69) :
                            (i === 80) ? [parameterCompletion("pName", 80, 0, false)] :
                                []);
                }
            });

            suite("test 19", () => {
                for (let i = 0; i <= 76; ++i) {
                    completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': "[parameters(')]" }`, i,
                        (i >= 59 && i <= 69) ? allTestDataExpectedCompletions(59, i - 59) :
                            (i === 70) ? [parameterCompletion("pName", 70, 0, false)] :
                                (i >= 71 && i <= 72) ? [parameterCompletion("pName", 70, 2)] : // Don't replace the "]"
                                    []);
                }
            });

            suite("test 20", () => {
                for (let i = 0; i <= 75; ++i) {
                    completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': "[parameters(']" }`, i,
                        (i >= 59 && i <= 69) ? allTestDataExpectedCompletions(59, i - 59) :
                            (i === 70) ? [parameterCompletion("pName", 70, 0, false)] :
                                (i === 71) ? [parameterCompletion("pName", 70, 1)] : // Don't replace the "]"
                                    []);
                }
            });

            suite("test 21", () => {
                for (let i = 0; i <= 53; ++i) {
                    completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('p)]`, i,
                        (i >= 39 && i <= 48) ? allTestDataExpectedCompletions(39, i - 39) :
                            (i === 49) ? [variableCompletion("vName", 49, 0, false)] :
                                (i >= 50 && i <= 52) ? [variableCompletion("vName", 49, 3)] : // Don't replace the "]"
                                    []);
                }
            });

            suite("test 22", () => {
                for (let i = 0; i <= 65; ++i) {
                    completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': 'A', 'b': "[concat  spam  ('`, i,
                        (i >= 49 && i <= 55) ? allTestDataExpectedCompletions(49, i - 49) :
                            (56 <= i && i <= 63) ? allTestDataExpectedCompletions(i, 0) :
                                []);
                }
            });

            suite("test 23", () => {
                for (let i = 0; i <= 28; ++i) {
                    completionItemsTest(`{ "a": "[resourceGroup()]" }`, i,
                        (i >= 9 && i <= 22) ? allTestDataExpectedCompletions(9, i - 9) :
                            (i === 23) ? allTestDataExpectedCompletions(23, 0) :
                                (i === 24) ? allTestDataExpectedCompletions(24, 0) :
                                    []);
                }
            });

            suite("test 24", () => {
                for (let i = 0; i <= 29; ++i) {
                    completionItemsTest(`{ "a": "[resourceGroup().]" }`, i,
                        (i >= 9 && i <= 22) ? allTestDataExpectedCompletions(9, i - 9) :
                            (i === 23) ? allTestDataExpectedCompletions(23, 0) :
                                (24 <= i && i <= 25) ? [
                                    propertyCompletion("id", i, 0),
                                    propertyCompletion("location", i, 0),
                                    propertyCompletion("name", i, 0),
                                    propertyCompletion("properties", i, 0),
                                    propertyCompletion("tags", i, 0)
                                ] :
                                    []);
                }
            });

            suite("test 25", () => {
                for (let i = 0; i <= 31; ++i) {
                    completionItemsTest(`{ "a": "[resourceGroup().lo]" }`, i,
                        (i >= 9 && i <= 22) ? allTestDataExpectedCompletions(9, i - 9) :
                            (i === 23) ? allTestDataExpectedCompletions(23, 0) :
                                (24 <= i && i <= 25) ? [
                                    propertyCompletion("id", 25, 2),
                                    propertyCompletion("location", 25, 2),
                                    propertyCompletion("name", 25, 2),
                                    propertyCompletion("properties", 25, 2),
                                    propertyCompletion("tags", 25, 2)
                                ] :
                                    (26 <= i && i <= 27) ? [
                                        propertyCompletion("location", 25, 2),
                                    ] :
                                        []);
                }
            });

            suite("Variable value deep completion for objects", () => {
                suite("test vvdc 01", () => {
                    for (let i = 0; i <= 28; ++i) {
                        completionItemsTest(`{ "b": "[variables('a').]" }`, i,
                            (9 <= i && i <= 18) ? allTestDataExpectedCompletions(9, i - 9) :
                                []);
                    }
                });

                suite("test vvdc 02", () => {
                    for (let i = 0; i <= 55; ++i) {
                        completionItemsTest(`{ "variables": { "a": "A" }, "b": "[variables('a').]" }`, i,
                            (36 <= i && i <= 45) ? allTestDataExpectedCompletions(36, i - 36) :
                                (i === 46) ? [variableCompletion("a", 46, 0, false)] :
                                    (47 <= i && i <= 48) ? [variableCompletion("a", 46, 4)] :
                                        []);
                    }
                });

                suite("test vvdc 03", () => {
                    for (let i = 0; i <= 55; ++i) {
                        completionItemsTest(`{ "variables": { "a": 123 }, "b": "[variables('a').]" }`, i,
                            (36 <= i && i <= 45) ? allTestDataExpectedCompletions(36, i - 36) :
                                (i === 46) ? [variableCompletion("a", 46, 0, false)] :
                                    (47 <= i && i <= 48) ? [variableCompletion("a", 46, 4)] :
                                        []);
                    }
                });

                suite("test vvdc 04", () => {
                    for (let i = 0; i <= 56; ++i) {
                        completionItemsTest(`{ "variables": { "a": true }, "b": "[variables('a').]" }`, i,
                            (37 <= i && i <= 46) ? allTestDataExpectedCompletions(37, i - 37) :
                                (i === 47) ? [variableCompletion("a", 47, 0, false)] :
                                    (48 <= i && i <= 49) ? [variableCompletion("a", 47, 4)] :
                                        []);
                    }
                });

                suite("test vvdc 05", () => {
                    for (let i = 0; i <= 56; ++i) {
                        completionItemsTest(`{ "variables": { "a": null }, "b": "[variables('a').]" }`, i,
                            (37 <= i && i <= 46) ? allTestDataExpectedCompletions(37, i - 37) :
                                (i === 47) ? [variableCompletion("a", 47, 0, false)] :
                                    (48 <= i && i <= 49) ? [variableCompletion("a", 47, 4)] :
                                        []);
                    }
                });

                suite("test vvdc 06", () => {
                    for (let i = 0; i <= 54; ++i) {
                        completionItemsTest(`{ "variables": { "a": [] }, "b": "[variables('a').]" }`, i,
                            (35 <= i && i <= 44) ? allTestDataExpectedCompletions(35, i - 35) :
                                (i === 45) ? [variableCompletion("a", 45, 0, false)] :
                                    (46 <= i && i <= 47) ? [variableCompletion("a", 45, 4)] :
                                        []);
                    }
                });

                suite("test vvdc 07", () => {
                    for (let i = 0; i <= 54; ++i) {
                        completionItemsTest(`{ "variables": { "a": {} }, "b": "[variables('a').]" }`, i,
                            (35 <= i && i <= 44) ? allTestDataExpectedCompletions(35, i - 35) :
                                (i === 45) ? [variableCompletion("a", 45, 0, false)] :
                                    (46 <= i && i <= 47) ? [variableCompletion("a", 45, 4)] :
                                        []);
                    }
                });

                suite("test vvdc 08", () => {
                    for (let i = 0; i <= 67; ++i) {
                        completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').]" }`, i,
                            (48 <= i && i <= 57) ? allTestDataExpectedCompletions(48, i - 48) :
                                (i === 58) ? [variableCompletion("a", 58, 0, false)] :
                                    (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                        (62 <= i && i <= 63) ? [propertyCompletion("name", i, 0)] :
                                            []);
                    }
                });

                suite("test vvdc 09", () => {
                    for (let i = 0; i <= 69; ++i) {
                        completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').na]" }`, i,
                            (48 <= i && i <= 57) ? allTestDataExpectedCompletions(48, i - 48) :
                                (i === 58) ? [variableCompletion("a", 58, 0, false)] :
                                    (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                        (62 <= i && i <= 65) ? [propertyCompletion("name", 63, 2)] :
                                            []);
                    }
                });

                suite("test vvdc 10", () => {
                    for (let i = 0; i <= 69; ++i) {
                        completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').ab]" }`, i,
                            (48 <= i && i <= 57) ? allTestDataExpectedCompletions(48, i - 48) :
                                (i === 58) ? [variableCompletion("a", 58, 0, false)] :
                                    (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                        (62 <= i && i <= 63) ? [propertyCompletion("name", 63, 2)] :
                                            []);
                    }
                });

                suite("test vvdc 11", () => {
                    for (let i = 0; i <= 78; ++i) {
                        completionItemsTest(`{ "variables": { "a": { "bb": { "cc": 200 } } }, "b": "[variables('a').bb.]" }`, i,
                            (56 <= i && i <= 65) ? allTestDataExpectedCompletions(56, i - 56) :
                                (i === 66) ? [variableCompletion("a", 66, 0, false)] :
                                    (67 <= i && i <= 68) ? [variableCompletion("a", 66, 4)] :
                                        (70 <= i && i <= 73) ? [propertyCompletion("bb", 71, 2)] :
                                            (i === 74) ? [propertyCompletion("cc", 74, 0)] :
                                                []);
                    }
                });

                suite("test vvdc 12", () => {
                    // Should retain original casing when completing
                    for (let i = 0; i <= 78; ++i) {
                        completionItemsTest(`{ "variables": { "A": { "Bb": { "cC": 200 } } }, "b": "[variables('a').Bb.]" }`, i,
                            (56 <= i && i <= 65) ? allTestDataExpectedCompletions(56, i - 56) :
                                (i === 66) ? [variableCompletion("A", 66, 0, false)] :
                                    (67 <= i && i <= 68) ? [variableCompletion("A", 66, 4)] :
                                        (70 <= i && i <= 73) ? [propertyCompletion("Bb", 71, 2)] :
                                            (i === 74) ? [propertyCompletion("cC", 74, 0)] :
                                                []);
                    }
                });

                suite("test vvdc 13", () => {
                    // Casing shouldn't matter for finding completions
                    for (let i = 0; i <= 78; ++i) {
                        completionItemsTest(`{ "variables": { "A": { "Bb": { "cC": 200 } } }, "b": "[variables('a').BB.Cc]" }`, i,
                            (56 <= i && i <= 65) ? allTestDataExpectedCompletions(56, i - 56) :
                                (i === 66) ? [variableCompletion("A", 66, 0, false)] :
                                    (67 <= i && i <= 68) ? [variableCompletion("A", 66, 4)] :
                                        (70 <= i && i <= 73) ? [propertyCompletion("Bb", 71, 2)] :
                                            (74 <= i && i <= 76) ? [propertyCompletion("cC", 74, 2)] :
                                                []);
                    }
                });

            });

            // CONSIDER: Use parseTemplateWithMarkers
            function getDocumentAndMarkers(document: object | string): { documentText: string; tokens: number[] } {
                let tokens: number[] = [];
                document = typeof document === "string" ? document : JSON.stringify(document);

                // tslint:disable-next-line:no-constant-condition
                while (true) {
                    let tokenPos: number = document.indexOf("!");
                    if (tokenPos < 0) {
                        break;
                    }
                    tokens.push(tokenPos);
                    document = document.slice(0, tokenPos) + document.slice(tokenPos + 1);
                }

                return {
                    documentText: document,
                    tokens
                };
            }

            suite("Parameter defaultValue deep completion for objects", () => {
                let { documentText, tokens } = getDocumentAndMarkers({
                    parameters: {
                        a: {
                            type: "object",
                            defaultValue: {
                                aa: {
                                    bb: {
                                        cc: 200
                                    }
                                }
                            }
                        }
                    },
                    variables: {
                        b: "[parameters('a').!aa.!bb.!]"
                    }
                });
                let [dotAa, dotBb, dot] = tokens;

                completionItemsTest(
                    documentText,
                    dotAa,
                    [propertyCompletion("aa", dotAa, 2)]);
                completionItemsTest(
                    documentText,
                    dotBb,
                    [propertyCompletion("bb", dotBb, 2)]);
                completionItemsTest(
                    documentText,
                    dot,
                    [propertyCompletion("cc", dot, 0)]);
            });

            suite("Parameter defaultValue with array nested in object", () => {
                let { documentText, tokens } = getDocumentAndMarkers({
                    "parameters": {
                        "location": {
                            "type": "object",
                            "defaultValue": {
                                "a": [ // array inside an object
                                    1
                                ]
                            }
                        }
                    },
                    "outputs": {
                        "output1": {
                            "type": "bool",
                            "value": "[parameters('location').a.b.!]"
                        }
                    }
                });
                let [dotB] = tokens;

                completionItemsTest(
                    documentText,
                    dotB,
                    // We should get any completions because we don't handle completions
                    // for arrays (shouldn't throw, either)
                    // See https://github.com/microsoft/vscode-azurearmtools/issues/441
                    []);
            });

            suite("Variable value with array nested in object", () => {
                test("variables('v1').a.b.c", async () => {
                    // Shouldn't throw - see https://github.com/microsoft/vscode-azurearmtools/issues/441
                    await parseTemplate(
                        {
                            "variables": {
                                "v1": {
                                    "a": [
                                        1
                                    ]
                                }
                            },
                            "outputs": {
                                "output1": {
                                    "type": "bool",
                                    "value": "[variables('v1').a.b.c]"
                                }
                            }
                        },
                        []);
                });
            });
        }

        suite("Completion items usability", () => {

            // <!replstart!> - indicates the start of the replacement range
            // ! - indicates location of the cursor
            function testCompletionItemsWithRange(
                nameSuffix: string,
                templateWithReplacement: string | IPartialDeploymentTemplate,
                expression: string,
                expectedExample: undefined | { // Expected representation of one of the completion items, we'll search for it by label (the others are not tested, assumed to be similar)
                    label: string;
                    insertText: string;
                    replaceSpanText: string;
                }
            ): void {
                // tslint:disable-next-line: prefer-template
                let testName = `${expression}${nameSuffix ? ' (' + nameSuffix + ')' : ''}`;
                testWithPrep(
                    testName,
                    [UseNoSnippets.instance],
                    async () => {
                        testName = testName;

                        templateWithReplacement = stringify(templateWithReplacement);
                        const template = templateWithReplacement.replace(/TESTEXPRESSION/, expression);
                        const { dt, markers: { cursor, replstart } } = await parseTemplateWithMarkers(template);
                        // tslint:disable-next-line: strict-boolean-expressions
                        assert(!!replstart!, "Didn't find <!replstart!> in test expression");
                        // tslint:disable-next-line: strict-boolean-expressions
                        assert(!!cursor!, "Didn't find <!cursor!> in test expression");
                        const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(cursor.index, undefined);

                        let completionItems: Completion.Item[] = (await pc.getCompletionItems(undefined)).items;
                        if (!expectedExample) {
                            assert.equal(completionItems.length, 0, "Expected 0 completion items");
                            return;
                        }

                        let foundItem = completionItems.find(ci => ci.label === expectedExample.label);
                        assert(!!foundItem, `Did not find a completion item with the label "${expectedExample.label}"`);

                        const actual = {
                            label: foundItem.label,
                            insertText: foundItem.insertText,
                            replaceSpanStart: foundItem.span.startIndex,
                            replaceSpanText: dt.getDocumentText(foundItem.span),
                        };
                        const expected = {
                            label: expectedExample.label,
                            insertText: expectedExample.insertText,
                            replaceSpanStart: replstart.index,
                            replaceSpanText: expectedExample.replaceSpanText,
                        };
                        assert.deepEqual(actual, expected);
                    });
            }

            const template1: IPartialDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "outputs": {
                    "testExpression": {
                        "type": "string",
                        "value": "TESTEXPRESSION"
                    }
                },
                "parameters": {
                    "subnet1Name": {
                        "type": "object",
                        "defaultValue": {
                            "property1": "hi",
                            "property2": {
                                "property2a": "2a"
                            }
                        }
                    },
                    "sku": {
                        "type": "string"
                    }
                },
                "variables": {
                    "subnet1Name": {
                        "property1": "hi",
                        "property2": {
                            "property2a": "2a"
                        }
                    },
                    "subnet2Name": "subnet2"
                },
                "resources": [],
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
                            "myfunction": {
                                "parameters": [
                                    {
                                        "name": "year",
                                        "type": "Int"
                                    },
                                    {
                                        "name": "month",
                                        "type": "int"
                                    },
                                    {
                                        "name": "day",
                                        "type": "int"
                                    }
                                ],
                                "output": {
                                    "type": "string",
                                    "value": "[<stringOutputValue>]"
                                }
                            },
                            "udf2": {},
                            "udf3": {},
                            "udf34": {},
                            "mixedCaseFunc": {}
                        }
                    }
                ]
            };

            suite("Simple function completions", () => {

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!><!cursor!>]`,
                    {
                        label: "add",
                        insertText: "add",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!><!cursor!>param]`,
                    {
                        label: "add",
                        insertText: "add",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!>param<!cursor!>]`,
                    {
                        label: "parameters",
                        insertText: "parameters",
                        replaceSpanText: "param"
                    }
                );

                testCompletionItemsWithRange(
                    "Don't replace the entire function name, just what's to the left of the cursor",
                    template1,
                    `[<!replstart!>param<!cursor!>eters]`,
                    {
                        label: "parameters",
                        insertText: "parameters",
                        replaceSpanText: "param"
                    }
                );

            });

            suite("User-defined function namespace completions", () => {

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!><!cursor!>]`,
                    {
                        label: "udf",
                        insertText: "udf",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!><!cursor!>ud]`,
                    {
                        label: "udf",
                        insertText: "udf",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!>ud<!cursor!>]`,
                    {
                        label: "udf",
                        insertText: "udf",
                        replaceSpanText: "ud"
                    }
                );

                testCompletionItemsWithRange(
                    "Don't replace the entire namespace, just what's to the left of the cursor",
                    template1,
                    `[<!replstart!>ud<!cursor!>f]`,
                    {
                        label: "udf",
                        insertText: "udf",
                        replaceSpanText: "ud"
                    }
                );

            });

            suite("User-defined function name completions", () => {

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[udf.<!replstart!><!cursor!>myfunction]`,
                    {
                        label: "udf.myfunction",
                        insertText: "myfunction",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[udf.<!replstart!>myfunction<!cursor!>]`,
                    {
                        label: "udf.myfunction",
                        insertText: "myfunction",
                        replaceSpanText: "myfunction"
                    }
                );

                testCompletionItemsWithRange(
                    "Don't replace the entire function name, just what's to the left of the cursor",
                    template1,
                    `[udf.<!replstart!>myf<!cursor!>unction]`,
                    {
                        label: "udf.myfunction",
                        insertText: "myfunction",
                        replaceSpanText: "myf"
                    }
                );

            });

            suite("Parameters/variables argument replacements", () => {

                // Include closing parenthesis and single quote in the replacement span and insertion text,
                // so that the cursor ends up after them once the replacement happens.
                // This way the user can immediately start typing the rest of the expression after the parameters call.

                // Also, note that we replace the entire string argument (unlike for function name replacements)

                suite("empty parentheses", () => {
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[parameters(<!replstart!><!cursor!>)]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: ")"
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!><!cursor!>)]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: ")"
                        }
                    );

                    testCompletionItemsWithRange(
                        "with whitespace",
                        template1,
                        `[parameters(<!replstart!><!cursor!> )]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: " )"
                        }
                    );
                    testCompletionItemsWithRange(
                        "with whitespace",
                        template1,
                        `[variables(<!replstart!><!cursor!> )]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: " )"
                        }
                    );

                    testCompletionItemsWithRange(
                        "with whitespace #2",
                        template1,
                        `[parameters( <!replstart!><!cursor!>)]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: ")"
                        }
                    );

                    testCompletionItemsWithRange(
                        "no closing paren",
                        template1,
                        `[parameters(<!replstart!><!cursor!>]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: ""
                        }
                    );
                    testCompletionItemsWithRange(
                        "no closing paren",
                        template1,
                        `[variables(<!replstart!><!cursor!>]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: ""
                        }
                    );
                });

                suite("cursor before string - insert completion, don't remove anything", () => {

                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[parameters(<!replstart!><!cursor!>'hi')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: ""
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!><!cursor!>'hi')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name'",
                            replaceSpanText: ""
                        }
                    );

                    testCompletionItemsWithRange(
                        "with whitespace before string, cursor after whitespace",
                        template1,
                        `[parameters( <!replstart!><!cursor!>'hi')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: ""
                        }
                    );

                    testCompletionItemsWithRange(
                        "no closing paren",
                        template1,
                        `[parameters(<!replstart!><!cursor!>'hi']`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: ""
                        }
                    );
                });

                suite("cursor inside string - replace entire string and closing paren", () => {
                    testCompletionItemsWithRange(
                        "empty string",
                        template1,
                        `[parameters(<!replstart!>'<!cursor!>')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: "'')"
                        }
                    );
                    testCompletionItemsWithRange(
                        "empty string",
                        template1,
                        `[variables(<!replstart!>'<!cursor!>')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: "'')"
                        }
                    );

                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[parameters(<!replstart!>'<!cursor!>hi')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: "'hi')"
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!>'<!cursor!>hi')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: "'hi')"
                        }
                    );

                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[parameters(<!replstart!>'h<!cursor!>i')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: "'hi')"
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!>'h<!cursor!>i')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: "'hi')"
                        }
                    );

                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[parameters(<!replstart!>'hi<!cursor!>')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: "'hi')"
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!>'hi<!cursor!>')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: "'hi')"
                        }
                    );

                    suite("Make sure we don't erase the closing ']' if the closing paren or quote are missing (perhaps Auto Closing Brackets settings if off)", () => {

                        testCompletionItemsWithRange(
                            "no closing paren",
                            template1,
                            `[parameters(<!replstart!>'hi<!cursor!>']`,
                            {
                                label: "'sku'",
                                insertText: "'sku')",
                                replaceSpanText: "'hi'"
                            }
                        );

                        testCompletionItemsWithRange(
                            "no closing quote",
                            template1,
                            `[parameters(<!replstart!>'hi<!cursor!>)]`,
                            {
                                label: "'sku'",
                                insertText: "'sku')",
                                replaceSpanText: "'hi)"
                            }
                        );
                        testCompletionItemsWithRange(
                            "no closing quote or paren",
                            template1,
                            `[parameters(<!replstart!>'hi<!cursor!>]`,
                            {
                                label: "'sku'",
                                insertText: "'sku')",
                                replaceSpanText: "'hi"
                            }
                        );
                        testCompletionItemsWithRange(
                            "no closing quote or paren",
                            template1,
                            `[variables(<!replstart!>'hi<!cursor!>]`,
                            {
                                label: "'subnet1Name'",
                                insertText: "'subnet1Name')",
                                replaceSpanText: "'hi"
                            }
                        );

                    });

                    testCompletionItemsWithRange(
                        "extra (invalid) args",
                        template1,
                        `[parameters(<!replstart!>'hi<!cursor!>', 'there']`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: "'hi'"
                        }
                    );
                    testCompletionItemsWithRange(
                        "extra (invalid) args",
                        template1,
                        `[variables(<!replstart!>'hi<!cursor!>', 'there']`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name'",
                            replaceSpanText: "'hi'"
                        }
                    );

                    testCompletionItemsWithRange(
                        "before second (invalid) arg",
                        template1,
                        `[parameters('hi', <!cursor!><!replstart!>'there']`,
                        undefined
                    );

                    testCompletionItemsWithRange(
                        "in second (invalid) arg",
                        template1,
                        `[parameters('hi', '<!replstart!><!cursor!>there']`,
                        undefined
                    );
                    testCompletionItemsWithRange(
                        "in second (invalid) arg",
                        template1,
                        `[variables('hi', '<!cursor!><!replstart!><!cursor!>there']`,
                        undefined
                    );
                });

                suite("#349 tab completion of params/vars shouldn't wipe out remainder of existing string when adding new parameters call before existing string", () => {
                    // E.g.: "[resourceId(<CURSOR>'Microsoft.Network/virtualNetworks', parameters('subnet2Name'))]",

                    testCompletionItemsWithRange(
                        "user typed parameters( without apostrophe before completing",
                        template1,
                        `[resourceId(parameters(<!replstart!><!cursor!>'Microsoft.Network/virtualNetworks', parameters('subnet2Name'))]`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: ""
                        }
                    );

                    testCompletionItemsWithRange(
                        "user typed parameters(' with an apostrophe before completing",
                        template1,
                        `[resourceId(parameters(<!replstart!>'<!cursor!>''Microsoft.Network/virtualNetworks', parameters('subnet2Name'))]`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: "''"
                        }
                    );
                });

            });

        });
    });

});
