// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import * as Completion from "../src/Completion";
import * as Hover from "../src/Hover";
import * as Json from "../src/JSON";
import * as language from "../src/Language";
import * as Tle from "../src/TLE";
import * as Utilities from "../src/Utilities";

import { AzureRMAssets } from "../src/AzureRMAssets";
import { DeploymentTemplate } from "../src/DeploymentTemplate";
import { ParameterDefinition } from "../src/ParameterDefinition";
import { PositionContext } from "../src/PositionContext";

import * as jsonTest from "./JSON.test";

suite("PositionContext", () => {
    suite("fromDocumentLineAndColumnIndexes(DeploymentTemplate,number,number)", () => {
        test("with null deploymentTemplate", () => {
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(null, 1, 2); });
        });

        test("with undefined deploymentTemplate", () => {
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(undefined, 1, 2); });
        });

        test("with null documentLineIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, null, 2); });
        });

        test("with undefined documentLineIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, undefined, 2); });
        });

        test("with negative documentLineIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, -1, 2); });
        });

        test("with documentLineIndex equal to document line count", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.deepStrictEqual(1, dt.lineCount);
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, 1, 0); });
        });

        test("with null documentColumnIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, 0, null); });
        });

        test("with undefined documentColumnIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, 0, undefined); });
        });

        test("with negative documentColumnIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, 0, -2); });
        });

        test("with documentColumnIndex greater than line length", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, 0, 3); });
        });

        test("with valid arguments", () => {
            let dt = new DeploymentTemplate("{}", "id");
            let documentLineIndex = 0;
            let documentColumnIndex = 2;
            let pc = PositionContext.fromDocumentLineAndColumnIndexes(dt, documentLineIndex, documentColumnIndex);
            assert.deepStrictEqual(new language.Position(0, 2), pc.documentPosition);
            assert.deepStrictEqual(0, pc.documentLineIndex);
            assert.deepStrictEqual(2, pc.documentColumnIndex);
        });
    });

    suite("fromDocumentCharacterIndex(DeploymentTemplate,number)", () => {
        test("with null deploymentTemplate", () => {
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(null, 1); });
        });

        test("with undefined deploymentTemplate", () => {
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(undefined, 1); });
        });

        test("with null documentCharacterIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(dt, null); });
        });

        test("with undefined documentCharacterIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(dt, undefined); });
        });

        test("with negative documentCharacterIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(dt, -1); });
        });

        test("with documentCharacterIndex greater than the maximum character index", () => {
            let dt = new DeploymentTemplate("{}", "id");
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(dt, 3); });
        });

        test("with valid arguments", () => {
            let dt = new DeploymentTemplate("{}", "id");
            let documentCharacterIndex = 2;
            let pc = PositionContext.fromDocumentCharacterIndex(dt, documentCharacterIndex);
            assert.deepStrictEqual(2, pc.documentCharacterIndex);
        });
    });

    suite("documentPosition", () => {
        test("with PositionContext from line and column indexes", () => {
            let pc = PositionContext.fromDocumentLineAndColumnIndexes(new DeploymentTemplate("{\n}", "id"), 1, 0);
            assert.deepStrictEqual(new language.Position(1, 0), pc.documentPosition);
        });

        test("with PositionContext from characterIndex", () => {
            let pc = PositionContext.fromDocumentCharacterIndex(new DeploymentTemplate("{\n}", "id"), 2);
            assert.deepStrictEqual(new language.Position(1, 0), pc.documentPosition);
        });
    });

    suite("documentCharacterIndex", () => {
        test("with PositionContext from line and column indexes", () => {
            let pc = PositionContext.fromDocumentLineAndColumnIndexes(new DeploymentTemplate("{\n}", "id"), 1, 0);
            assert.deepStrictEqual(2, pc.documentCharacterIndex);
        });

        test("with PositionContext from characterIndex", () => {
            let pc = PositionContext.fromDocumentCharacterIndex(new DeploymentTemplate("{\n}", "id"), 2);
            assert.deepStrictEqual(2, pc.documentCharacterIndex);
        });
    });

    suite("jsonToken", () => {
        test("with characterIndex in whitespace", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(1);
            assert.deepStrictEqual(null, pc.jsonToken);
        });

        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(0);
            assert.deepStrictEqual(Json.LeftCurlyBracket(0), pc.jsonToken);
        });

        test("with characterIndex at the start of a QuotedString", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(2);
            assert.deepStrictEqual(pc.jsonToken, jsonTest.parseQuotedString(`'a'`, 2));
        });

        test("with characterIndex inside of a QuotedString", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(3);
            assert.deepStrictEqual(pc.jsonToken, jsonTest.parseQuotedString(`'a'`, 2));
        });

        test("with characterIndex at the end of a closed QuotedString", () => {
            let dt = new DeploymentTemplate("{ 'a'", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(5);
            assert.deepStrictEqual(pc.jsonToken, jsonTest.parseQuotedString(`'a'`, 2));
        });

        test("with characterIndex at the end of an unclosed QuotedString", () => {
            let dt = new DeploymentTemplate("{ 'a", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(4);
            assert.deepStrictEqual(pc.jsonToken, jsonTest.parseQuotedString(`'a`, 2));
        });
    });

    suite("tleParseResult", () => {
        test("with characterIndex in whitespace", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(1);
            assert.deepStrictEqual(pc.tleParseResult, null);
        });

        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(0);
            assert.deepStrictEqual(pc.tleParseResult, null);
        });

        test("with characterIndex at the start of a Colon", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(5);
            assert.deepStrictEqual(null, pc.tleParseResult);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(2);
            assert.deepStrictEqual(Tle.Parser.parse("'a'"), pc.tleParseResult);
        });

        test("with characterIndex at the start of a closed TLE QuotedString", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(17);

            const tleParseResult: Tle.ParseResult = pc.tleParseResult;
            assert(tleParseResult);
            assert.deepStrictEqual(tleParseResult.errors, []);
            assert.deepStrictEqual(tleParseResult.leftSquareBracketToken, Tle.Token.createLeftSquareBracket(1));
            assert.deepStrictEqual(tleParseResult.rightSquareBracketToken, Tle.Token.createRightSquareBracket(13));

            const concat: Tle.FunctionValue = Tle.asFunctionValue(tleParseResult.expression);
            assert(concat);
            assert.deepStrictEqual(concat.parent, undefined);
            assert.deepStrictEqual(concat.nameToken, Tle.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, Tle.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, Tle.Token.createRightParenthesis(12));
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: Tle.StringValue = Tle.asStringValue(concat.argumentExpressions[0]);
            assert(arg1);
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, Tle.Token.createQuotedString(9, "'B'"));
        });

        test("with characterIndex at the start of an unclosed TLE QuotedString", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(17);

            const tleParseResult: Tle.ParseResult = pc.tleParseResult;
            assert(tleParseResult);
            assert.deepStrictEqual(
                tleParseResult.errors,
                [
                    new language.Issue(new language.Span(11, 1), "Expected a right square bracket (']').")
                ]);
            assert.deepStrictEqual(tleParseResult.leftSquareBracketToken, Tle.Token.createLeftSquareBracket(1));
            assert.deepStrictEqual(tleParseResult.rightSquareBracketToken, null);

            const concat: Tle.FunctionValue = Tle.asFunctionValue(tleParseResult.expression);
            assert(concat);
            assert.deepStrictEqual(concat.parent, undefined);
            assert.deepStrictEqual(concat.nameToken, Tle.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, Tle.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, null);
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: Tle.StringValue = Tle.asStringValue(concat.argumentExpressions[0]);
            assert(arg1);
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, Tle.Token.createQuotedString(9, "'B'"));
        });
    });

    suite("tleCharacterIndex", () => {
        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(0);
            assert.deepStrictEqual(null, pc.tleCharacterIndex);
        });

        test("with characterIndex in whitespace", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(1);
            assert.deepStrictEqual(null, pc.tleCharacterIndex);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(2);
            assert.deepStrictEqual(0, pc.tleCharacterIndex);
        });

        test("with characterIndex at the start of a TLE", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(17);
            assert.deepStrictEqual(0, pc.tleCharacterIndex);
        });

        test("with characterIndex inside of a TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(21);
            assert.deepStrictEqual(pc.tleCharacterIndex, 4);
        });

        test("with characterIndex after the end of a closed TLE", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(32);
            assert.deepStrictEqual(null, pc.tleCharacterIndex);
        });

        test("with characterIndex after the end of an unclosed TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(29);
            assert.deepStrictEqual(12, pc.tleCharacterIndex);
        });
    });

    suite("tleValue", () => {
        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(0);
            assert.deepStrictEqual(null, pc.tleValue);
        });

        test("with characterIndex in whitespace", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(1);
            assert.deepStrictEqual(null, pc.tleValue);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(2);
            assert.deepStrictEqual(
                pc.tleValue,
                new Tle.StringValue(Tle.Token.createQuotedString(0, "'a'")));
        });

        test("with characterIndex at the start of a TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': ".length);
            assert.deepStrictEqual(pc.tleValue, null);
        });

        test("with characterIndex inside of a TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(21);

            const concat: Tle.FunctionValue = Tle.asFunctionValue(pc.tleValue);
            assert(concat);
            assert.deepStrictEqual(concat.nameToken, Tle.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, Tle.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, Tle.Token.createRightParenthesis(12));
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: Tle.StringValue = Tle.asStringValue(concat.argumentExpressions[0]);
            assert(arg1);
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, Tle.Token.createQuotedString(9, "'B'"));
        });

        test("with characterIndex after the end of a closed TLE", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(32);
            assert.deepStrictEqual(null, pc.tleValue);
        });

        test("with characterIndex after the end of an unclosed TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[concat('B'".length);

            const b: Tle.StringValue = Tle.asStringValue(pc.tleValue);
            assert(b);
            assert.deepStrictEqual(b.token, Tle.Token.createQuotedString(9, "'B'"));
            const concat: Tle.FunctionValue = Tle.asFunctionValue(b.parent);
            assert(concat);
            assert.deepStrictEqual(concat.nameToken, Tle.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, Tle.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, null);
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);

        });
    });

    suite("hoverInfo", () => {
        test("in non-string json token", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            return dt.getContextFromDocumentCharacterIndex(0).hoverInfo.then((hoverInfo: Hover.Info) => {
                assert.deepStrictEqual(hoverInfo, null);
            });
        });

        test("in property name json token", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            return dt.getContextFromDocumentCharacterIndex(3).hoverInfo.then((hoverInfo: Hover.Info) => {
                assert.deepStrictEqual(hoverInfo, null);
            });
        });

        test("in unrecognized function name", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[toads('B'", "id");
            return dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[to".length).hoverInfo
                .then((hoverInfo: Hover.Info) => {
                    assert.deepStrictEqual(hoverInfo, null);
                });
        });

        test("in recognized function name", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const pc = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[c".length);
            return pc.hoverInfo.then((hi: Hover.Info) => {
                assert(hi instanceof Hover.FunctionInfo);
                if (hi instanceof Hover.FunctionInfo) {
                    assert.deepStrictEqual(hi.functionName, "concat");
                    assert.deepStrictEqual(hi.span, new language.Span("{ 'a': 'A', 'b': \"[".length, 6));
                }
            });
        });

        test("in unrecognized parameter reference", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[parameters('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters('".length);
            return pc.hoverInfo.then((hi: Hover.Info) => {
                assert.deepStrictEqual(hi, null);
            });
        });

        test("in recognized parameter reference name", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters('pName')\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters('pN".length);
            return pc.hoverInfo.then((hi: Hover.Info) => {
                assert(hi instanceof Hover.ParameterReferenceInfo);
                if (hi instanceof Hover.ParameterReferenceInfo) {
                    assert.deepStrictEqual("**pName** (parameter)", hi.getHoverText());
                    assert.deepStrictEqual(new language.Span("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters(".length, 7), hi.span);
                }
            });
        });

        test("in parameter reference function with empty string parameter", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[parameters('')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters('".length);
            return pc.hoverInfo.then((hi: Hover.Info) => {
                assert.deepStrictEqual(hi, null);
            });
        });

        test("in parameter reference function with no arguments", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[parameters()]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters(".length);
            return pc.hoverInfo.then((hi: Hover.Info) => {
                assert.deepStrictEqual(hi, null);
            });
        });

        test("in unrecognized variable reference", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[variables('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[variables('".length);
            return pc.hoverInfo.then((hi: Hover.Info) => {
                assert.deepStrictEqual(hi, null);
            });
        });

        test("in recognized variable reference name", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables('vName')\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables('vNam".length);
            return pc.hoverInfo.then((hi: Hover.Info) => {
                assert(hi instanceof Hover.VariableReferenceInfo);
                if (hi instanceof Hover.VariableReferenceInfo) {
                    assert.deepStrictEqual("**vName** (variable)", hi.getHoverText());
                    assert.deepStrictEqual(new language.Span("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables(".length, 7), hi.span);
                }
            });
        });
    });

    suite("completionItems", () => {
        function completionItemsTest(documentText: string, index: number, expectedCompletionItems: Completion.Item[]): void {
            test(`with ${Utilities.escapeAndQuote(documentText)} at index ${index}`, () => {
                const dt = new DeploymentTemplate(documentText, "id");
                const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(index);
                return pc.completionItems.then((completionItems: Completion.Item[]) => {
                    compareCompletionItems(completionItems, expectedCompletionItems);
                });
            });
        }

        let allTestCompletionNames = allCompletions(0, 0).map(item => item.name);

        function compareCompletionItems(actualItems: Completion.Item[], expectedItems: Completion.Item[]): void {
            if (expectedItems.length > 0) {
                // Ignore items that aren't in our testing list
                actualItems = actualItems.filter(item => allTestCompletionNames.some(n => n === item.name));
            }

            // Make it easier to see missing names quickly
            let actualNames = actualItems.map(item => item.name);
            let expectedNames = expectedItems.map(item => typeof item === 'string' ? item : item.name);
            assert.deepStrictEqual(actualNames, expectedNames, "Names in the completion items did not match");

            assert.deepStrictEqual(actualItems, expectedItems);
        }

        function allCompletions(startIndex: number, length: number): Completion.Item[] {
            return [
                addCompletion(startIndex, length),
                base64Completion(startIndex, length),
                concatCompletion(startIndex, length),
                copyIndexCompletion(startIndex, length),
                deploymentCompletion(startIndex, length),
                divCompletion(startIndex, length),
                intCompletion(startIndex, length),
                lengthCompletion(startIndex, length),
                listKeysCompletion(startIndex, length),
                listPackageCompletion(startIndex, length),
                modCompletion(startIndex, length),
                mulCompletion(startIndex, length),
                padLeftCompletion(startIndex, length),
                parametersCompletion(startIndex, length),
                providersCompletion(startIndex, length),
                referenceCompletion(startIndex, length),
                replaceCompletion(startIndex, length),
                resourceGroupCompletion(startIndex, length),
                resourceIdCompletion(startIndex, length),
                skipCompletion(startIndex, length),
                splitCompletion(startIndex, length),
                stringCompletion(startIndex, length),
                subCompletion(startIndex, length),
                subscriptionCompletion(startIndex, length),
                substringCompletion(startIndex, length),
                takeCompletion(startIndex, length),
                toLowerCompletion(startIndex, length),
                toUpperCompletion(startIndex, length),
                trimCompletion(startIndex, length),
                uniqueStringCompletion(startIndex, length),
                uriCompletion(startIndex, length),
                variablesCompletion(startIndex, length)
            ];
        }

        function addCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("add", "add($0)", new language.Span(startIndex, length), "(function) add(operand1, operand2)", "Returns the sum of the two provided integers.", Completion.Type.Function);
        }

        function base64Completion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("base64", "base64($0)", new language.Span(startIndex, length), "(function) base64(inputString)", "Returns the base64 representation of the input string.", Completion.Type.Function);
        }

        function concatCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("concat", "concat($0)", new language.Span(startIndex, length), "(function) concat(arg1, arg2, arg3, ...)", "Combines multiple values and returns the concatenated result. This function can take any number of arguments, and can accept either strings or arrays for the parameters.", Completion.Type.Function);
        }

        function copyIndexCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("copyIndex", "copyIndex($0)", new language.Span(startIndex, length), "(function) copyIndex([offset])", "Returns the current index of an iteration loop.\nThis function is always used with a copy object.", Completion.Type.Function);
        }

        function deploymentCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("deployment", "deployment()$0", new language.Span(startIndex, length), "(function) deployment()", "Returns information about the current deployment operation. This function returns the object that is passed during deployment. The properties in the returned object will differ based on whether the deployment object is passed as a link or as an in-line object.", Completion.Type.Function);
        }

        function divCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("div", "div($0)", new language.Span(startIndex, length), "(function) div(operand1, operand2)", "Returns the integer division of the two provided integers.", Completion.Type.Function)
        }

        function intCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("int", "int($0)", new language.Span(startIndex, length), "(function) int(valueToConvert)", "Converts the specified value to Integer.", Completion.Type.Function);
        }

        function lengthCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("length", "length($0)", new language.Span(startIndex, length), "(function) length(array/string)", "Returns the number of elements in an array or the number of characters in a string. You can use this function with an array to specify the number of iterations when creating resources.", Completion.Type.Function);
        }

        function listKeysCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("listKeys", "listKeys($0)", new language.Span(startIndex, length), "(function) listKeys(resourceName/resourceIdentifier, apiVersion)", "Returns the keys of a storage account. The resourceId can be specified by using the resourceId function or by using the format providerNamespace/resourceType/resourceName. You can use the function to get the primaryKey and secondaryKey.", Completion.Type.Function);
        }

        function listPackageCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("listPackage", "listPackage($0)", new language.Span(startIndex, length), "(function) listPackage(resourceId, apiVersion)", undefined, Completion.Type.Function);
        }

        function modCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("mod", "mod($0)", new language.Span(startIndex, length), "(function) mod(operand1, operand2)", "Returns the remainder of the integer division using the two provided integers.", Completion.Type.Function);
        }

        function mulCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("mul", "mul($0)", new language.Span(startIndex, length), "(function) mul(operand1, operand2)", "Returns the multiplication of the two provided integers.", Completion.Type.Function);
        }

        function padLeftCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("padLeft", "padLeft($0)", new language.Span(startIndex, length), "(function) padLeft(stringToPad, totalLength, paddingCharacter)", "Returns a right-aligned string by adding characters to the left until reaching the total specified length.", Completion.Type.Function);
        }

        function parametersCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("parameters", "parameters($0)", new language.Span(startIndex, length), "(function) parameters(parameterName)", "Returns a parameter value. The specified parameter name must be defined in the parameters section of the template.", Completion.Type.Function);
        }

        function providersCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("providers", "providers($0)", new language.Span(startIndex, length), "(function) providers(providerNamespace, [resourceType])", "Return information about a resource provider and its supported resource types. If not type is provided, all of the supported types are returned.", Completion.Type.Function);
        }

        function referenceCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("reference", "reference($0)", new language.Span(startIndex, length), "(function) reference(resourceName/resourceIdentifier, [apiVersion])", "Enables an expression to derive its value from another resource's runtime state.", Completion.Type.Function);
        }

        function replaceCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("replace", "replace($0)", new language.Span(startIndex, length), "(function) replace(originalString, oldCharacter, newCharacter)", "Returns a new string with all instances of one character in the specified string replaced by another character.", Completion.Type.Function);
        }

        function resourceGroupCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("resourceGroup", "resourceGroup()$0", new language.Span(startIndex, length), "(function) resourceGroup()", "Returns a structured object that represents the current resource group.", Completion.Type.Function);
        }

        function resourceIdCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("resourceId", "resourceId($0)", new language.Span(startIndex, length), "(function) resourceId([subscriptionId], [resourceGroupName], resourceType, resourceName1, [resourceName2]...)", "Returns the unique identifier of a resource. You use this function when the resource name is ambiguous or not provisioned within the same template.", Completion.Type.Function);
        }

        function skipCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("skip", "skip($0)", new language.Span(startIndex, length), "(function) skip(originalValue, numberToSkip)", "Returns an array or string with all of the elements or characters after the specified number in the array or string.", Completion.Type.Function);
        }

        function splitCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("split", "split($0)", new language.Span(startIndex, length), "(function) split(inputString, delimiter)", "Returns an array of strings that contains the substrings of the input string that are delimited by the sent delimiters.", Completion.Type.Function);
        }

        function stringCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("string", "string($0)", new language.Span(startIndex, length), "(function) string(valueToConvert)", "Converts the specified value to String.", Completion.Type.Function);
        }

        function subCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("sub", "sub($0)", new language.Span(startIndex, length), "(function) sub(operand1, operand2)", "Returns the subtraction of the two provided integers.", Completion.Type.Function);
        }

        function subscriptionCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("subscription", "subscription()$0", new language.Span(startIndex, length), "(function) subscription()", "Returns details about the subscription.", Completion.Type.Function);
        }

        function substringCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("substring", "substring($0)", new language.Span(startIndex, length), "(function) substring(stringToParse, startIndex, length)", "Returns a substring that starts at the specified character position and contains the specified number of characters.", Completion.Type.Function);
        }

        function takeCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("take", "take($0)", new language.Span(startIndex, length), "(function) take(originalValue, numberToTake)", "Returns an array or string with the specified number of elements or characters from the start of the array or string.", Completion.Type.Function);
        }

        function toLowerCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("toLower", "toLower($0)", new language.Span(startIndex, length), "(function) toLower(string)", "Converts the specified string to lower case.", Completion.Type.Function);
        }

        function toUpperCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("toUpper", "toUpper($0)", new language.Span(startIndex, length), "(function) toUpper(string)", "Converts the specified string to upper case.", Completion.Type.Function);
        }

        function trimCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("trim", "trim($0)", new language.Span(startIndex, length), "(function) trim(stringToTrim)", "Removes all leading and trailing white-space characters from the specified string.", Completion.Type.Function);
        }

        function uniqueStringCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("uniqueString", "uniqueString($0)", new language.Span(startIndex, length), "(function) uniqueString(stringForCreatingUniqueString, ...)", "Performs a 64-bit hash of the provided strings to create a unique string. This function is helpful when you need to create a unique name for a resource. You provide parameter values that represent the level of uniqueness for the result. You can specify whether the name is unique for your subscription, resource group, or deployment.", Completion.Type.Function);
        }

        function uriCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("uri", "uri($0)", new language.Span(startIndex, length), "(function) uri(baseUri, relativeUri)", "Creates an absolute URI by combining the baseUri and the relativeUri string.", Completion.Type.Function);
        }

        function variablesCompletion(startIndex: number, length: number): Completion.Item {
            return new Completion.Item("variables", "variables($0)", new language.Span(startIndex, length), "(function) variables(variableName)", "Returns the value of variable. The specified variable name must be defined in the variables section of the template.", Completion.Type.Function);
        }

        function parameterCompletion(parameterName: string, startIndex: number, length: number, includeRightParenthesis: boolean = true): Completion.Item {
            return new Completion.Item(`'${parameterName}'`, `'${parameterName}'${includeRightParenthesis ? ")" : ""}$0`, new language.Span(startIndex, length), "(parameter)", null, Completion.Type.Parameter);
        }

        function propertyCompletion(propertyName: string, startIndex: number, length: number): Completion.Item {
            return new Completion.Item(propertyName, `${propertyName}$0`, new language.Span(startIndex, length), "(property)", "", Completion.Type.Property);
        }

        function variableCompletion(variableName: string, startIndex: number, length: number, includeRightParenthesis: boolean = true): Completion.Item {
            return new Completion.Item(`'${variableName}'`, `'${variableName}'${includeRightParenthesis ? ")" : ""}$0`, new language.Span(startIndex, length), "(variable)", "", Completion.Type.Variable);
        }

        for (let i = 0; i <= 24; ++i) {
            completionItemsTest(`{ 'a': "[concat('B')]" }`, i,
                (i === 9) ? allCompletions(9, 0) :
                    (10 <= i && i <= 11) ? [
                        concatCompletion(9, 6),
                        copyIndexCompletion(9, 6)
                    ] :
                        (12 <= i && i <= 15) ? [
                            concatCompletion(9, 6)
                        ] :
                            (i === 20) ? allCompletions(20, 0) :
                                []);
        }

        for (let i = 0; i <= 45; ++i) {
            for (let i = 9; i <= 9; ++i) {
                completionItemsTest(`{ "variables": { "v1": "value1" }, "v": "V" }`, i,
                    []);
            }

            for (let i = 0; i <= 25; ++i) {
                completionItemsTest(`{ 'a': 'A', 'b': "[concat`, i,
                    (i === 19) ? allCompletions(19, 0) :
                        (20 <= i && i <= 21) ? [
                            concatCompletion(19, 6),
                            copyIndexCompletion(19, 6)
                        ] :
                            (22 <= i && i <= 25) ? [
                                concatCompletion(19, 6)
                            ] :
                                []);
            }

            for (let i = 0; i <= 23; ++i) {
                completionItemsTest(`{ 'a': 'A', 'b': "[spif`, i,
                    (i === 19) ? allCompletions(19, 0) :
                        (i === 20) ? [
                            skipCompletion(19, 4),
                            splitCompletion(19, 4),
                            stringCompletion(19, 4),
                            subCompletion(19, 4),
                            subscriptionCompletion(19, 4),
                            substringCompletion(19, 4)
                        ] :
                            (i === 21) ? [
                                splitCompletion(19, 4)
                            ] :
                                []);
            }

            for (let i = 0; i <= 33; ++i) {
                completionItemsTest(`{ 'a': 'A', 'b': "[concat  ()]" }`, i,
                    (i === 19) ? allCompletions(19, 0) :
                        (20 <= i && i <= 21) ? [
                            concatCompletion(19, 6),
                            copyIndexCompletion(19, 6)
                        ] :
                            (22 <= i && i <= 25) ? [
                                concatCompletion(19, 6)
                            ] :
                                (26 <= i && i <= 29) ? allCompletions(i, 0) :
                                    []);
            }

            for (let i = 0; i <= 80; ++i) {
                completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': "[concat(')]"`, i,
                    (i === 69) ? allCompletions(69, 0) :
                        (70 <= i && i <= 71) ? [
                            concatCompletion(69, 6),
                            copyIndexCompletion(69, 6)
                        ] :
                            (72 <= i && i <= 75) ? [
                                concatCompletion(69, 6)
                            ] :
                                (i === 80) ? allCompletions(80, 0) :
                                    []);
            }

            for (let i = 0; i <= 24; ++i) {
                completionItemsTest(`{ 'a': "[variables()]" }`, i,
                    (i === 9) ? allCompletions(9, 0) :
                        (10 <= i && i <= 18) ? [
                            variablesCompletion(9, 9)
                        ] :
                            (i === 20) ? allCompletions(20, 0) :
                                []);
            }

            for (let i = 0; i <= 56; ++i) {
                completionItemsTest(`{ 'variables': { 'v1': 'value1' }, 'a': "[variables(]" }`, i,
                    (i === 42) ? allCompletions(42, 0) :
                        (43 <= i && i <= 51) ? [
                            variablesCompletion(42, 9)
                        ] :
                            (i === 52) ? [
                                variableCompletion("v1", 52, 0)
                            ] :
                                []);
            }

            for (let i = 0; i <= 57; ++i) {
                completionItemsTest(`{ 'variables': { 'v1': 'value1' }, 'a': "[variables()]" }`, i,
                    (i === 42 || i === 53) ? allCompletions(i, 0) :
                        (43 <= i && i <= 51) ? [
                            variablesCompletion(42, 9)
                        ] :
                            (i === 52) ? [
                                variableCompletion("v1", 52, 1)
                            ] :
                                []);
            }

            for (let i = 0; i <= 52; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables(')]`, i,
                    (i === 39) ? allCompletions(39, 0) :
                        (40 <= i && i <= 48) ? [variablesCompletion(39, 9)] :
                            (i === 50) ? [variableCompletion("vName", 49, 2)] :
                                []);
            }

            for (let i = 0; i <= 53; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('v)]`, i,
                    (i === 39) ? allCompletions(39, 0) :
                        (40 <= i && i <= 48) ? [variablesCompletion(39, 9)] :
                            (50 <= i && i <= 51) ? [variableCompletion("vName", 49, 3)] :
                                []);
            }

            for (let i = 0; i <= 56; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('')]" }`, i,
                    (i === 39 || i === 52) ? allCompletions(i, 0) :
                        (40 <= i && i <= 48) ? [variablesCompletion(39, 9)] :
                            (i === 50) ? [variableCompletion("vName", 49, 3)] :
                                []);
            }

            for (let i = 0; i <= 140; ++i) {
                completionItemsTest(`{ "parameters": { "adminUsername": {} }, "a": "[resourceId(parameters(''Microsoft.Networks/virtualNetworks', parameters('adminUsername'))]" }`, i,
                    (i === 48 || i === 59 || (73 <= i && i <= 138)) ? allCompletions(i, 0) :
                        (49 <= i && i <= 50) ? [
                            referenceCompletion(48, 10),
                            replaceCompletion(48, 10),
                            resourceGroupCompletion(48, 10),
                            resourceIdCompletion(48, 10)
                        ] :
                            (51 <= i && i <= 56) ? [
                                resourceGroupCompletion(48, 10),
                                resourceIdCompletion(48, 10)
                            ] :
                                (57 <= i && i <= 58) ? [
                                    resourceIdCompletion(48, 10)
                                ] :
                                    (i === 60) ? [
                                        padLeftCompletion(59, 10),
                                        parametersCompletion(59, 10),
                                        providersCompletion(59, 10)
                                    ] :
                                        (i === 61) ? [
                                            padLeftCompletion(59, 10),
                                            parametersCompletion(59, 10)
                                        ] :
                                            (62 <= i && i <= 69) ? [
                                                parametersCompletion(59, 10)
                                            ] :
                                                (i === 71) ? [parameterCompletion("adminUsername", 70, 2)] :
                                                    []);
            }

            for (let i = 0; i <= 140; ++i) {
                completionItemsTest(`{ "parameters": { "adminUsername": {} }, "a": "[resourceId(parameters('Microsoft.Networks/virtualNetworks', parameters('adminUsername'))]" }`, i,
                    (i === 48 || i === 59 || (107 <= i && i <= 108) || (135 <= i && i <= 136)) ? allCompletions(i, 0) :
                        (49 <= i && i <= 50) ? [
                            referenceCompletion(48, 10),
                            replaceCompletion(48, 10),
                            resourceGroupCompletion(48, 10),
                            resourceIdCompletion(48, 10)
                        ] :
                            (51 <= i && i <= 56) ? [
                                resourceGroupCompletion(48, 10),
                                resourceIdCompletion(48, 10)
                            ] :
                                (57 <= i && i <= 58) ? [
                                    resourceIdCompletion(48, 10)
                                ] :
                                    (i === 60) ? [
                                        padLeftCompletion(59, 10),
                                        parametersCompletion(59, 10),
                                        providersCompletion(59, 10)
                                    ] :
                                        (i === 61) ? [
                                            padLeftCompletion(59, 10),
                                            parametersCompletion(59, 10)
                                        ] :
                                            (62 <= i && i <= 69) ? [parametersCompletion(59, 10)] :
                                                (i === 71) ? [parameterCompletion("adminUsername", 70, 36, false)] :
                                                    (i === 109) ? [
                                                        padLeftCompletion(108, 10),
                                                        parametersCompletion(108, 10),
                                                        providersCompletion(108, 10)
                                                    ] :
                                                        (i === 110) ? [
                                                            padLeftCompletion(108, 10),
                                                            parametersCompletion(108, 10)
                                                        ] :
                                                            (111 <= i && i <= 118) ? [parametersCompletion(108, 10)] :
                                                                (120 <= i && i <= 133) ? [parameterCompletion("adminUsername", 119, 16)] :
                                                                    []);
            }

            for (let i = 0; i <= 137; ++i) {
                completionItemsTest(`{ "variables": { "adminUsername": "" }, "a": "[resourceId(variables('Microsoft.Networks/virtualNetworks', variables('adminUsername'))]" }`, i,
                    (i === 47 || i === 58 || (105 <= i && i <= 106) || (132 <= i && i <= 133)) ? allCompletions(i, 0) :
                        (48 <= i && i <= 49) ? [
                            referenceCompletion(47, 10),
                            replaceCompletion(47, 10),
                            resourceGroupCompletion(47, 10),
                            resourceIdCompletion(47, 10)
                        ] :
                            (50 <= i && i <= 55) ? [
                                resourceGroupCompletion(47, 10),
                                resourceIdCompletion(47, 10)
                            ] :
                                (56 <= i && i <= 57) ? [
                                    resourceIdCompletion(47, 10)
                                ] :
                                    (59 <= i && i <= 67) ? [
                                        variablesCompletion(58, 9),
                                    ] :
                                        (i === 69) ? [variableCompletion("adminUsername", 68, 36, false)] :
                                            (107 <= i && i <= 115) ? [
                                                variablesCompletion(106, 9)
                                            ] :
                                                (117 <= i && i <= 130) ? [variableCompletion("adminUsername", 116, 16)] :
                                                    []);
            }

            for (let i = 0; i <= 25; ++i) {
                completionItemsTest(`{ 'a': "[parameters()]" }`, i,
                    (i === 9) ? allCompletions(9, 0) :
                        (i === 10) ? [
                            padLeftCompletion(9, 10),
                            parametersCompletion(9, 10),
                            providersCompletion(9, 10)
                        ] :
                            (i === 11) ? [
                                padLeftCompletion(9, 10),
                                parametersCompletion(9, 10)
                            ] :
                                (12 <= i && i <= 19) ? [
                                    parametersCompletion(9, 10)
                                ] :
                                    (i === 21) ? allCompletions(21, 0) :
                                        []);
            }

            for (let i = 0; i <= 52; ++i) {
                completionItemsTest(`{ 'parameters': { 'p1': {} }, 'a': "[parameters(]" }`, i,
                    (i === 37) ? allCompletions(37, 0) :
                        (i === 38) ? [
                            padLeftCompletion(37, 10),
                            parametersCompletion(37, 10),
                            providersCompletion(37, 10)
                        ] :
                            (i === 39) ? [
                                padLeftCompletion(37, 10),
                                parametersCompletion(37, 10)
                            ] :
                                (40 <= i && i <= 47) ? [parametersCompletion(37, 10)] :
                                    (i === 48) ? [parameterCompletion("p1", 48, 0)] :
                                        []);
            }

            for (let i = 0; i <= 81; ++i) {
                completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': "[parameters('`, i,
                    (i === 69) ? allCompletions(69, 0) :
                        (i === 70) ? [
                            padLeftCompletion(69, 10),
                            parametersCompletion(69, 10),
                            providersCompletion(69, 10)
                        ] :
                            (i === 71) ? [
                                padLeftCompletion(69, 10),
                                parametersCompletion(69, 10)
                            ] :
                                (72 <= i && i <= 79) ? [parametersCompletion(69, 10)] :
                                    (i === 81) ? [parameterCompletion("pName", 80, 1)] :
                                        []);
            }

            for (let i = 0; i <= 76; ++i) {
                completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': "[parameters(')]" }`, i,
                    (i === 59) ? allCompletions(59, 0) :
                        (i === 60) ? [
                            padLeftCompletion(59, 10),
                            parametersCompletion(59, 10),
                            providersCompletion(59, 10)
                        ] :
                            (i === 61) ? [
                                padLeftCompletion(59, 10),
                                parametersCompletion(59, 10)
                            ] :
                                (62 <= i && i <= 69) ? [parametersCompletion(59, 10)] :
                                    (i === 71) ? [parameterCompletion("pName", 70, 2)] :
                                        []);
            }

            for (let i = 0; i <= 75; ++i) {
                completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': "[parameters(']" }`, i,
                    (i === 59) ? allCompletions(59, 0) :
                        (i === 60) ? [
                            padLeftCompletion(59, 10),
                            parametersCompletion(59, 10),
                            providersCompletion(59, 10)
                        ] :
                            (i === 61) ? [
                                padLeftCompletion(59, 10),
                                parametersCompletion(59, 10)
                            ] :
                                (62 <= i && i <= 69) ? [parametersCompletion(59, 10)] :
                                    (i === 71) ? [parameterCompletion("pName", 70, 1)] :
                                        []);
            }

            for (let i = 0; i <= 53; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('p)]`, i,
                    (i === 39) ? allCompletions(39, 0) :
                        (40 <= i && i <= 48) ? [variablesCompletion(39, 9)] :
                            (i === 50) ? [variableCompletion("vName", 49, 3)] :
                                []);
            }

            for (let i = 0; i <= 65; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': 'A', 'b': "[concat  spam  ('`, i,
                    (i === 49 || (56 <= i && i <= 63)) ? allCompletions(i, 0) :
                        (50 <= i && i <= 51) ? [
                            concatCompletion(49, 6),
                            copyIndexCompletion(49, 6)
                        ] :
                            (52 <= i && i <= 55) ? [
                                concatCompletion(49, 6)
                            ] :
                                []);
            }

            for (let i = 0; i <= 28; ++i) {
                completionItemsTest(`{ "a": "[resourceGroup()]" }`, i,
                    (i === 9 || (23 <= i && i <= 24)) ? allCompletions(i, 0) :
                        (10 <= i && i <= 11) ? [
                            referenceCompletion(9, 13),
                            replaceCompletion(9, 13),
                            resourceGroupCompletion(9, 13),
                            resourceIdCompletion(9, 13)
                        ] :
                            (12 <= i && i <= 17) ? [
                                resourceGroupCompletion(9, 13),
                                resourceIdCompletion(9, 13)
                            ] :
                                (18 <= i && i <= 22) ? [
                                    resourceGroupCompletion(9, 13)
                                ] :
                                    []);
            }

            for (let i = 0; i <= 29; ++i) {
                completionItemsTest(`{ "a": "[resourceGroup().]" }`, i,
                    (i === 9 || i === 23) ? allCompletions(i, 0) :
                        (10 <= i && i <= 11) ? [
                            referenceCompletion(9, 13),
                            replaceCompletion(9, 13),
                            resourceGroupCompletion(9, 13),
                            resourceIdCompletion(9, 13)
                        ] :
                            (12 <= i && i <= 17) ? [
                                resourceGroupCompletion(9, 13),
                                resourceIdCompletion(9, 13)
                            ] :
                                (18 <= i && i <= 22) ? [
                                    resourceGroupCompletion(9, 13)
                                ] :
                                    (24 <= i && i <= 25) ? [
                                        propertyCompletion("id", i, 0),
                                        propertyCompletion("location", i, 0),
                                        propertyCompletion("name", i, 0)
                                    ] :
                                        []);
            }

            for (let i = 0; i <= 31; ++i) {
                completionItemsTest(`{ "a": "[resourceGroup().lo]" }`, i,
                    (i === 9 || i === 23) ? allCompletions(i, 0) :
                        (10 <= i && i <= 11) ? [
                            referenceCompletion(9, 13),
                            replaceCompletion(9, 13),
                            resourceGroupCompletion(9, 13),
                            resourceIdCompletion(9, 13)
                        ] :
                            (12 <= i && i <= 17) ? [
                                resourceGroupCompletion(9, 13),
                                resourceIdCompletion(9, 13)
                            ] :
                                (18 <= i && i <= 22) ? [
                                    resourceGroupCompletion(9, 13)
                                ] :
                                    (24 <= i && i <= 25) ? [
                                        propertyCompletion("id", 25, 2),
                                        propertyCompletion("location", 25, 2),
                                        propertyCompletion("name", 25, 2)
                                    ] :
                                        (26 <= i && i <= 27) ? [
                                            propertyCompletion("location", 25, 2),
                                        ] :
                                            []);
            }

            for (let i = 0; i <= 28; ++i) {
                completionItemsTest(`{ "b": "[variables('a').]" }`, i,
                    (i === 9) ? allCompletions(9, 0) :
                        (10 <= i && i <= 18) ? [variablesCompletion(9, 9)] :
                            []);
            }

            for (let i = 0; i <= 55; ++i) {
                completionItemsTest(`{ "variables": { "a": "A" }, "b": "[variables('a').]" }`, i,
                    (i === 36) ? allCompletions(36, 0) :
                        (37 <= i && i <= 45) ? [variablesCompletion(36, 9)] :
                            (47 <= i && i <= 48) ? [variableCompletion("a", 46, 4)] :
                                []);
            }

            for (let i = 0; i <= 55; ++i) {
                completionItemsTest(`{ "variables": { "a": 123 }, "b": "[variables('a').]" }`, i,
                    (i === 36) ? allCompletions(36, 0) :
                        (37 <= i && i <= 45) ? [variablesCompletion(36, 9)] :
                            (47 <= i && i <= 48) ? [variableCompletion("a", 46, 4)] :
                                []);
            }

            for (let i = 0; i <= 56; ++i) {
                completionItemsTest(`{ "variables": { "a": true }, "b": "[variables('a').]" }`, i,
                    (i === 37) ? allCompletions(37, 0) :
                        (38 <= i && i <= 46) ? [variablesCompletion(37, 9)] :
                            (48 <= i && i <= 49) ? [variableCompletion("a", 47, 4)] :
                                []);
            }

            for (let i = 0; i <= 56; ++i) {
                completionItemsTest(`{ "variables": { "a": null }, "b": "[variables('a').]" }`, i,
                    (i === 37) ? allCompletions(37, 0) :
                        (38 <= i && i <= 46) ? [variablesCompletion(37, 9)] :
                            (48 <= i && i <= 49) ? [variableCompletion("a", 47, 4)] :
                                []);
            }

            for (let i = 0; i <= 54; ++i) {
                completionItemsTest(`{ "variables": { "a": [] }, "b": "[variables('a').]" }`, i,
                    (i === 35) ? allCompletions(35, 0) :
                        (36 <= i && i <= 44) ? [variablesCompletion(35, 9)] :
                            (46 <= i && i <= 47) ? [variableCompletion("a", 45, 4)] :
                                []);
            }

            for (let i = 0; i <= 54; ++i) {
                completionItemsTest(`{ "variables": { "a": {} }, "b": "[variables('a').]" }`, i,
                    (i === 35) ? allCompletions(35, 0) :
                        (36 <= i && i <= 44) ? [variablesCompletion(35, 9)] :
                            (46 <= i && i <= 47) ? [variableCompletion("a", 45, 4)] :
                                []);
            }

            for (let i = 0; i <= 67; ++i) {
                completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').]" }`, i,
                    (i === 48) ? allCompletions(48, 0) :
                        (49 <= i && i <= 57) ? [variablesCompletion(48, 9)] :
                            (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                (62 <= i && i <= 63) ? [propertyCompletion("name", i, 0)] :
                                    []);
            }

            for (let i = 0; i <= 69; ++i) {
                completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').na]" }`, i,
                    (i === 48) ? allCompletions(48, 0) :
                        (49 <= i && i <= 57) ? [variablesCompletion(48, 9)] :
                            (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                (62 <= i && i <= 65) ? [propertyCompletion("name", 63, 2)] :
                                    []);
            }

            for (let i = 0; i <= 69; ++i) {
                completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').ab]" }`, i,
                    (i === 48) ? allCompletions(48, 0) :
                        (49 <= i && i <= 57) ? [variablesCompletion(48, 9)] :
                            (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                (62 <= i && i <= 63) ? [propertyCompletion("name", 63, 2)] :
                                    []);
            }

            for (let i = 0; i <= 78; ++i) {
                completionItemsTest(`{ "variables": { "a": { "bb": { "cc": 200 } } }, "b": "[variables('a').bb.]" }`, i,
                    (i === 56) ? allCompletions(56, 0) :
                        (57 <= i && i <= 65) ? [variablesCompletion(56, 9)] :
                            (67 <= i && i <= 68) ? [variableCompletion("a", 66, 4)] :
                                (70 <= i && i <= 73) ? [propertyCompletion("bb", 71, 2)] :
                                    (i === 74) ? [propertyCompletion("cc", 74, 0)] :
                                        []);
            }

            suite("signatureHelp", () => {
                test("not in a TLE", () => {
                    const dt = new DeploymentTemplate(`{ "a": "AA" }`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "A`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert.deepStrictEqual(functionSignatureHelp, null);
                    });
                });

                test("in empty TLE", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[]" }`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert.deepStrictEqual(functionSignatureHelp, null);
                    });
                });

                test("in TLE function name", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[con]" }`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[con`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert.deepStrictEqual(functionSignatureHelp, null);
                    });
                });

                test("after left parenthesis", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[concat(`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat(`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert(functionSignatureHelp);
                        assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 0);
                        assert(functionSignatureHelp.functionMetadata);
                        assert.deepStrictEqual(functionSignatureHelp.functionMetadata.name, "concat");
                    });
                });

                test("inside first parameter", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[concat('test`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('test`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert(functionSignatureHelp);
                        assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 0);
                        assert(functionSignatureHelp.functionMetadata);
                        assert.deepStrictEqual(functionSignatureHelp.functionMetadata.name, "concat");
                    });
                });

                test("inside second parameter", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[concat('t1', 't2`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('t1', 't2`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert(functionSignatureHelp);
                        assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 1);
                        assert(functionSignatureHelp.functionMetadata);
                        assert.deepStrictEqual(functionSignatureHelp.functionMetadata.name, "concat");
                    });
                });

                test("inside empty parameter", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[concat(,,,`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat(,,`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert(functionSignatureHelp);
                        assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 2);
                        assert(functionSignatureHelp.functionMetadata);
                        assert.deepStrictEqual(functionSignatureHelp.functionMetadata.name, "concat");
                    });
                });

                test("in variadic parameter when function signature has '...' parameter and the current argument is greater than the parameter count", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f'`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f'`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert(functionSignatureHelp);
                        assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 3);
                        assert(functionSignatureHelp.functionMetadata);
                        assert.deepStrictEqual(functionSignatureHelp.functionMetadata.name, "concat");
                    });
                });

                test("in variadic parameter when function signature has '...' parameter and the current argument is equal to the parameter count", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[concat('a', 'b', 'c', 'd'`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd'`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert(functionSignatureHelp);
                        assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 3);
                        assert(functionSignatureHelp.functionMetadata);
                        assert.deepStrictEqual(functionSignatureHelp.functionMetadata.name, "concat");
                    });
                });

                test("in variadic parameter when function signature has 'name...' parameter", () => {
                    const dt = new DeploymentTemplate(`{ "a": "[resourceId('a', 'b', 'c', 'd', 'e', 'f', 'g'`, "id");
                    const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f', 'g'`.length);
                    return pc.signatureHelp.then((functionSignatureHelp: Tle.FunctionSignatureHelp) => {
                        assert(functionSignatureHelp);
                        assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 4);
                        assert(functionSignatureHelp.functionMetadata);
                        assert.deepStrictEqual(functionSignatureHelp.functionMetadata.name, "resourceId");
                    });
                });
            });

            suite("parameterDefinition", () => {
                test("with no parameters property", () => {
                    const dt = new DeploymentTemplate("{ 'a': '[parameters(\"pName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': '[parameters(\"pN".length);
                    assert.deepStrictEqual(context.parameterDefinition, null);
                });

                test("with empty parameters property value", () => {
                    const dt = new DeploymentTemplate("{ 'parameters': {}, 'a': '[parameters(\"pName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': {}, 'a': '[parameters(\"pN".length);
                    assert.deepStrictEqual(context.parameterDefinition, null);
                });

                test("with matching parameter definition", () => {
                    const dt = new DeploymentTemplate("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pNa".length);
                    const parameterDefinition: ParameterDefinition = context.parameterDefinition;
                    assert(parameterDefinition);
                    assert.deepStrictEqual(parameterDefinition.name.toString(), "pName");
                    assert.deepStrictEqual(parameterDefinition.description, null);
                    assert.deepStrictEqual(parameterDefinition.span, new language.Span(18, 11));
                });

                test("with cursor before parameter name start quote with matching parameter definition", () => {
                    const dt = new DeploymentTemplate("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(".length);
                    const parameterDefinition: ParameterDefinition = context.parameterDefinition;
                    assert(parameterDefinition);
                    assert.deepStrictEqual(parameterDefinition.name.toString(), "pName");
                    assert.deepStrictEqual(parameterDefinition.description, null);
                    assert.deepStrictEqual(parameterDefinition.span, new language.Span(18, 11));
                });

                test("with cursor after parameter name end quote with matching parameter definition", () => {
                    const dt = new DeploymentTemplate("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\"".length);
                    const parameterDefinition: ParameterDefinition = context.parameterDefinition;
                    assert(parameterDefinition);
                    assert.deepStrictEqual(parameterDefinition.name.toString(), "pName");
                    assert.deepStrictEqual(parameterDefinition.description, null);
                    assert.deepStrictEqual(parameterDefinition.span, new language.Span(18, 11));
                });
            });

            suite("variableDefinition", () => {
                test("with no variables property", () => {
                    const dt = new DeploymentTemplate("{ 'a': '[variables(\"vName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': '[variables(\"vN".length);
                    assert.deepStrictEqual(context.variableDefinition, null);
                });

                test("with empty variables property value", () => {
                    const dt = new DeploymentTemplate("{ 'variables': {}, 'a': '[variables(\"vName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': {}, 'a': '[variables(\"vN".length);
                    assert.deepStrictEqual(context.variableDefinition, null);
                });

                test("with matching variable definition", () => {
                    const dt = new DeploymentTemplate("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vNa".length);
                    const vDef: Json.Property = context.variableDefinition;
                    assert(vDef);
                    assert.deepStrictEqual(vDef.name.toString(), "vName");
                    assert.deepStrictEqual(vDef.span, new language.Span(17, 11));
                });

                test("with cursor before variable name start quote with matching variable definition", () => {
                    const dt = new DeploymentTemplate("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(".length);
                    const vDef: Json.Property = context.variableDefinition;
                    assert(vDef);
                    assert.deepStrictEqual(vDef.name.toString(), "vName");
                    assert.deepStrictEqual(vDef.span, new language.Span(17, 11));
                });

                test("with cursor after parameter name end quote with matching parameter definition", () => {
                    const dt = new DeploymentTemplate("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", "id");
                    const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\"".length);
                    const vDef: Json.Property = context.variableDefinition;
                    assert(vDef);
                    assert.deepStrictEqual(vDef.name.toString(), "vName");
                    assert.deepStrictEqual(vDef.span, new language.Span(17, 11));
                });
            });
        }
    });
});
