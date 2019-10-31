// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length cyclomatic-complexity promise-function-async align max-line-length max-line-length no-null-keyword
// tslint:disable:no-non-null-assertion object-literal-key-quotes

import * as assert from "assert";
import * as os from 'os';
import { Completion, DeploymentTemplate, FunctionSignatureHelp, HoverInfo, IParameterDefinition, IReferenceSite, isVariableDefinition, IVariableDefinition, Json, Language, PositionContext, TLE, UserFunctionMetadata, Utilities } from "../extension.bundle";
import * as jsonTest from "./JSON.test";
import { assertNotNull } from "./support/assertNotNull";
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseTemplateWithMarkers } from "./support/parseTemplate";
import { stringify } from "./support/stringify";
import { allTestDataCompletionNames, allTestDataExpectedCompletions, expectedConcatCompletion, expectedCopyIndexCompletion, expectedPadLeftCompletion, expectedParametersCompletion, expectedProvidersCompletion, expectedReferenceCompletion, expectedReplaceCompletion, expectedResourceGroupCompletion, expectedResourceIdCompletion, expectedSkipCompletion, expectedSplitCompletion, expectedStringCompletion, expectedSubCompletion, expectedSubscriptionCompletion, expectedSubstringCompletion, expectedVariablesCompletion, parameterCompletion, propertyCompletion, variableCompletion } from "./TestData";

suite("PositionContext", () => {
    suite("fromDocumentLineAndColumnIndexes(DeploymentTemplate,number,number)", () => {
        test("with null deploymentTemplate", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(<any>null, 1, 2); });
        });

        test("with undefined deploymentTemplate", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(<any>undefined, 1, 2); });
        });

        test("with null documentLineIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, <any>null, 2); });
        });

        test("with undefined documentLineIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, <any>undefined, 2); });
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
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, 0, <any>null); });
        });

        test("with undefined documentColumnIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentLineAndColumnIndexes(dt, 0, <any>undefined); });
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
            assert.deepStrictEqual(new Language.Position(0, 2), pc.documentPosition);
            assert.deepStrictEqual(0, pc.documentLineIndex);
            assert.deepStrictEqual(2, pc.documentColumnIndex);
        });
    });

    suite("fromDocumentCharacterIndex(DeploymentTemplate,number)", () => {
        test("with null deploymentTemplate", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(<any>null, 1); });
        });

        test("with undefined deploymentTemplate", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(<any>undefined, 1); });
        });

        test("with null documentCharacterIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(dt, <any>null); });
        });

        test("with undefined documentCharacterIndex", () => {
            let dt = new DeploymentTemplate("{}", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { PositionContext.fromDocumentCharacterIndex(dt, <any>undefined); });
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
            const dt = new DeploymentTemplate("{\n}", "id");
            let pc = PositionContext.fromDocumentLineAndColumnIndexes(dt, 1, 0);
            assert.deepStrictEqual(new Language.Position(1, 0), pc.documentPosition);
        });

        test("with PositionContext from characterIndex", () => {
            let pc = PositionContext.fromDocumentCharacterIndex(new DeploymentTemplate("{\n}", "id"), 2);
            assert.deepStrictEqual(new Language.Position(1, 0), pc.documentPosition);
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
            assert.deepStrictEqual(pc.tleInfo, null);
        });

        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(0);
            assert.deepStrictEqual(pc.tleInfo, null);
        });

        test("with characterIndex at the start of a Colon", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(5);
            assert.deepStrictEqual(pc.tleInfo, null);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(2);
            assert.deepStrictEqual(TLE.Parser.parse("'a'", dt.topLevelScope), pc.tleInfo!.tleParseResult);
        });

        test("with characterIndex at the start of a closed TLE QuotedString", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(17);

            const tleParseResult: TLE.ParseResult = pc.tleInfo!.tleParseResult;
            assert.deepStrictEqual(tleParseResult.errors, []);
            assert.deepStrictEqual(tleParseResult.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
            assert.deepStrictEqual(tleParseResult.rightSquareBracketToken, TLE.Token.createRightSquareBracket(13));

            const concat: TLE.FunctionCallValue = assertNotNull(TLE.asFunctionCallValue(tleParseResult.expression));
            assert.deepStrictEqual(concat.parent, undefined);
            assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(12));
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: TLE.StringValue = assertNotNull(TLE.asStringValue(concat.argumentExpressions[0]));
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'B'"));
        });

        test("with characterIndex at the start of an unclosed TLE QuotedString", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(17);

            const tleParseResult: TLE.ParseResult = pc.tleInfo!.tleParseResult;
            assert.deepStrictEqual(
                tleParseResult.errors,
                [
                    new Language.Issue(new Language.Span(11, 1), "Expected a right square bracket (']').")
                ]);
            assert.deepStrictEqual(tleParseResult.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
            assert.deepStrictEqual(tleParseResult.rightSquareBracketToken, null);

            const concat: TLE.FunctionCallValue = assertNotNull(TLE.asFunctionCallValue(tleParseResult.expression));
            assert.deepStrictEqual(concat.parent, undefined);
            assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, null);
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: TLE.StringValue = assertNotNull(TLE.asStringValue(concat.argumentExpressions[0]));
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'B'"));
        });
    });

    suite("tleCharacterIndex", () => {
        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(0);
            assert.deepStrictEqual(pc.tleInfo, null);
        });

        test("with characterIndex in whitespace", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(1);
            assert.deepStrictEqual(null, pc.tleInfo);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(2);
            assert.deepStrictEqual(0, pc.tleInfo!.tleCharacterIndex);
        });

        test("with characterIndex at the start of a TLE", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(17);
            assert.deepStrictEqual(0, pc.tleInfo!.tleCharacterIndex);
        });

        test("with characterIndex inside of a TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(21);
            assert.deepStrictEqual(pc.tleInfo!.tleCharacterIndex, 4);
        });

        test("with characterIndex after the end of a closed TLE", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(32);
            assert.deepStrictEqual(pc.tleInfo, null);
        });

        test("with characterIndex after the end of an unclosed TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(29);
            assert.deepStrictEqual(12, pc.tleInfo!.tleCharacterIndex);
        });
    });

    suite("tleValue", () => {
        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(0);
            assert.deepStrictEqual(pc.tleInfo, null);
        });

        test("with characterIndex in whitespace", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(1);
            assert.deepStrictEqual(pc.tleInfo, null);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(2);
            assert.deepStrictEqual(
                pc.tleInfo!.tleValue,
                new TLE.StringValue(TLE.Token.createQuotedString(0, "'a'")));
        });

        test("with characterIndex at the start of a TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': ".length);
            assert.deepStrictEqual(pc.tleInfo!.tleValue, null);
        });

        test("with characterIndex inside of a TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(21);

            const concat: TLE.FunctionCallValue = assertNotNull(TLE.asFunctionCallValue(pc.tleInfo!.tleValue));
            assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(12));
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: TLE.StringValue = assertNotNull(TLE.asStringValue(concat.argumentExpressions[0]));
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'B'"));
        });

        test("with characterIndex after the end of a closed TLE", () => {
            let dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B')]\" }", "id");
            let pc = dt.getContextFromDocumentCharacterIndex(32);
            assert.deepStrictEqual(pc.tleInfo, null);
        });

        test("with characterIndex after the end of an unclosed TLE", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[concat('B'".length);

            const b: TLE.StringValue = assertNotNull(TLE.asStringValue(pc.tleInfo!.tleValue));
            assert.deepStrictEqual(b.token, TLE.Token.createQuotedString(9, "'B'"));
            const concat: TLE.FunctionCallValue = assertNotNull(TLE.asFunctionCallValue(b.parent));
            assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, null);
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);

        });
    });

    suite("hoverInfo", () => {
        test("in non-string json token", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const hoverInfo: HoverInfo | null = dt.getContextFromDocumentCharacterIndex(0).getHoverInfo();
            assert.deepStrictEqual(hoverInfo, null);
        });

        test("in property name json token", () => {
            const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
            const hoverInfo: HoverInfo | null = dt.getContextFromDocumentCharacterIndex(3).getHoverInfo();
            assert.deepStrictEqual(hoverInfo, null);
        });
    });

    test("in unrecognized function name", () => {
        const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[toads('B'", "id");
        const hoverInfo: HoverInfo | null = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[to".length).getHoverInfo();
        assert.deepStrictEqual(hoverInfo, null);
    });

    test("in recognized function name", () => {
        const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[concat('B'", "id");
        const pc = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[c".length);
        const hi: HoverInfo = pc.getHoverInfo()!;
        assert(hi);
        assert.deepStrictEqual(hi.usage, "concat(arg1, arg2, arg3, ...)");
        assert.deepStrictEqual(hi.span, new Language.Span("{ 'a': 'A', 'b': \"[".length, 6));
    });

    test("in unrecognized parameter reference", () => {
        const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[parameters('B')]\" }", "id");
        const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters('".length);
        const hi: HoverInfo | null = pc.getHoverInfo();
        assert.deepStrictEqual(hi, null);
    });

    test("in recognized parameter reference name", () => {
        const dt = new DeploymentTemplate("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters('pName')\" }", "id");
        const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters('pN".length);
        const hi: HoverInfo = pc.getHoverInfo()!;
        assert(hi);
        assert.deepStrictEqual(`**pName**${os.EOL}*(parameter)*`, hi.getHoverText());
        assert.deepStrictEqual(new Language.Span("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters(".length, 7), hi.span);
    });

    test("in parameter reference function with empty string parameter", () => {
        const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[parameters('')]\" }", "id");
        const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters('".length);
        const hi: HoverInfo | null = pc.getHoverInfo();
        assert.deepStrictEqual(hi, null);
    });

    test("in parameter reference function with no arguments", () => {
        const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[parameters()]\" }", "id");
        const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters(".length);
        const hi: HoverInfo | null = pc.getHoverInfo();
        assert.deepStrictEqual(hi, null);
    });

    test("in unrecognized variable reference", () => {
        const dt = new DeploymentTemplate("{ 'a': 'A', 'b': \"[variables('B')]\" }", "id");
        const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[variables('".length);
        const hi: HoverInfo | null = pc.getHoverInfo();
        assert.deepStrictEqual(hi, null);
    });

    test("in recognized variable reference name", () => {
        const dt = new DeploymentTemplate("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables('vName')\" }", "id");
        const pc: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables('vNam".length);
        const hi: HoverInfo | null = pc.getHoverInfo()!;
        assert(hi);
        assert.deepStrictEqual(`**vName**${os.EOL}*(variable)*`, hi.getHoverText());
        assert.deepStrictEqual(new Language.Span("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables(".length, 7), hi.span);
    });

    suite("completionItems", async () => {
        function addCursor(documentText: string, markerIndex: number): string {
            return `${documentText.slice(0, markerIndex)}<CURSOR>${documentText.slice(markerIndex)}`;
        }

        function completionItemsTest(documentText: string, index: number, expectedCompletionItems: Completion.Item[]): void {
            const testName = `with ${Utilities.escapeAndQuote(addCursor(documentText, index))} at index ${index}`;
            test(testName, async () => {
                let keepInClosureForEasierDebugging = testName;
                keepInClosureForEasierDebugging = keepInClosureForEasierDebugging;

                const dt = new DeploymentTemplate(documentText, "id");
                const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(index);

                let completionItems: Completion.Item[] = pc.getCompletionItems();
                const completionItems2: Completion.Item[] = pc.getCompletionItems();
                assert.deepStrictEqual(completionItems, completionItems2, "Got different results");

                compareTestableCompletionItems(completionItems, expectedCompletionItems);
            });
        }

        function compareTestableCompletionItems(actualItems: Completion.Item[], expectedItems: Completion.Item[]): void {
            let isFunctionCompletions = expectedItems.some(item => allTestDataCompletionNames.has(item.name));

            // Ignore functions that aren't in our testing list
            if (isFunctionCompletions) {
                // Unless it's an empty list - then we want to ensure the actual list is empty, too
                if (expectedItems.length > 0) {
                    actualItems = actualItems.filter(item => allTestDataCompletionNames.has(item.name));
                }
            }

            // Make it easier to see missing names quickly
            let actualNames = actualItems.map(item => item.name);
            let expectedNames = expectedItems.map(item => typeof item === 'string' ? item : item.name);
            assert.deepStrictEqual(actualNames, expectedNames, "Names in the completion items did not match");

            assert.deepStrictEqual(actualItems, expectedItems);
        }

        // NOTE: We are testing against test metadata, not the real data

        for (let i = 0; i <= 24; ++i) {
            completionItemsTest(`{ 'a': "[concat('B')]" }`, i,
                (i === 9) ? allTestDataExpectedCompletions(9, 0) :
                    (10 <= i && i <= 11) ? [
                        expectedConcatCompletion(9, 6),
                        expectedCopyIndexCompletion(9, 6)
                    ] :
                        (12 <= i && i <= 15) ? [
                            expectedConcatCompletion(9, 6)
                        ] :
                            (i === 20) ? allTestDataExpectedCompletions(20, 0) :
                                []);
        }

        const repetitions = 2;
        for (let repetition = 0; repetition < repetitions; ++repetition) {
            for (let i = 9; i <= 9; ++i) {
                completionItemsTest(`{ "variables": { "v1": "value1" }, "v": "V" }`, i,
                    []);
            }

            for (let i = 0; i <= 25; ++i) {
                completionItemsTest(`{ 'a': 'A', 'b': "[concat`, i,
                    (i === 19) ? allTestDataExpectedCompletions(19, 0) :
                        (20 <= i && i <= 21) ? [
                            expectedConcatCompletion(19, 6),
                            expectedCopyIndexCompletion(19, 6)
                        ] :
                            (22 <= i && i <= 25) ? [
                                expectedConcatCompletion(19, 6)
                            ] :
                                []);
            }

            for (let i = 0; i <= 23; ++i) {
                completionItemsTest(`{ 'a': 'A', 'b': "[spif`, i,
                    (i === 19) ? allTestDataExpectedCompletions(19, 0) :
                        (i === 20) ? [
                            expectedSkipCompletion(19, 4),
                            expectedSplitCompletion(19, 4),
                            expectedStringCompletion(19, 4),
                            expectedSubCompletion(19, 4),
                            expectedSubscriptionCompletion(19, 4),
                            expectedSubstringCompletion(19, 4)
                        ] :
                            (i === 21) ? [
                                expectedSplitCompletion(19, 4)
                            ] :
                                []);
            }

            for (let i = 0; i <= 33; ++i) {
                completionItemsTest(`{ 'a': 'A', 'b': "[concat  ()]" }`, i,
                    (i === 19) ? allTestDataExpectedCompletions(19, 0) :
                        (20 <= i && i <= 21) ? [
                            expectedConcatCompletion(19, 6),
                            expectedCopyIndexCompletion(19, 6)
                        ] :
                            (22 <= i && i <= 25) ? [
                                expectedConcatCompletion(19, 6)
                            ] :
                                (26 <= i && i <= 29) ? allTestDataExpectedCompletions(i, 0) :
                                    []);
            }

            for (let i = 0; i <= 80; ++i) {
                completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': "[concat(')]"`, i,
                    (i === 69) ? allTestDataExpectedCompletions(69, 0) :
                        (70 <= i && i <= 71) ? [
                            expectedConcatCompletion(69, 6),
                            expectedCopyIndexCompletion(69, 6)
                        ] :
                            (72 <= i && i <= 75) ? [
                                expectedConcatCompletion(69, 6)
                            ] :
                                (i === 80) ? allTestDataExpectedCompletions(80, 0) :
                                    []);
            }

            for (let i = 0; i <= 24; ++i) {
                completionItemsTest(`{ 'a': "[variables()]" }`, i,
                    (i === 9) ? allTestDataExpectedCompletions(9, 0) :
                        (10 <= i && i <= 18) ? [
                            expectedVariablesCompletion(9, 9)
                        ] :
                            (i === 20) ? allTestDataExpectedCompletions(20, 0) :
                                []);
            }

            for (let i = 0; i <= 56; ++i) {
                completionItemsTest(`{ 'variables': { 'v1': 'value1' }, 'a': "[variables(]" }`, i,
                    // after the "[": all
                    (i === 42) ? allTestDataExpectedCompletions(42, 0) :
                        // inside "[variables"
                        (43 <= i && i <= 51) ? [
                            expectedVariablesCompletion(42, 9)
                        ] :
                            // after "[variables(": "v1" is only completion
                            (i === 52) ? [
                                variableCompletion("v1", 52, 0)
                            ] :
                                []);
            }

            for (let i = 0; i <= 57; ++i) {
                completionItemsTest(`{ 'variables': { 'v1': 'value1' }, 'a': "[variables()]" }`, i,
                    (i === 42 || i === 53) ? allTestDataExpectedCompletions(i, 0) :
                        (43 <= i && i <= 51) ? [
                            expectedVariablesCompletion(42, 9)
                        ] :
                            (i === 52) ? [
                                variableCompletion("v1", 52, 1)
                            ] :
                                []);
            }

            for (let i = 0; i <= 52; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables(')]`, i,
                    (i === 39) ? allTestDataExpectedCompletions(39, 0) :
                        (40 <= i && i <= 48) ? [expectedVariablesCompletion(39, 9)] :
                            (i === 50) ? [variableCompletion("vName", 49, 2)] :
                                []);
            }

            for (let i = 0; i <= 53; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('v)]`, i,
                    (i === 39) ? allTestDataExpectedCompletions(39, 0) :
                        (40 <= i && i <= 48) ? [expectedVariablesCompletion(39, 9)] :
                            (50 <= i && i <= 51) ? [variableCompletion("vName", 49, 3)] :
                                []);
            }

            for (let i = 0; i <= 56; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('')]" }`, i,
                    (i === 39 || i === 52) ? allTestDataExpectedCompletions(i, 0) :
                        (40 <= i && i <= 48) ? [expectedVariablesCompletion(39, 9)] :
                            (i === 50) ? [variableCompletion("vName", 49, 3)] :
                                []);
            }

            for (let i = 0; i <= 140; ++i) {
                completionItemsTest(`{ "parameters": { "adminUsername": {} }, "a": "[resourceId(parameters(''Microsoft.Networks/virtualNetworks', parameters('adminUsername'))]" }`, i,
                    (i === 48 || i === 59 || (73 <= i && i <= 138)) ? allTestDataExpectedCompletions(i, 0) :
                        (49 <= i && i <= 50) ? [
                            expectedReferenceCompletion(48, 10),
                            expectedReplaceCompletion(48, 10),
                            expectedResourceGroupCompletion(48, 10),
                            expectedResourceIdCompletion(48, 10)
                        ] :
                            (51 <= i && i <= 56) ? [
                                expectedResourceGroupCompletion(48, 10),
                                expectedResourceIdCompletion(48, 10)
                            ] :
                                (57 <= i && i <= 58) ? [
                                    expectedResourceIdCompletion(48, 10)
                                ] :
                                    (i === 60) ? [
                                        expectedPadLeftCompletion(59, 10),
                                        expectedParametersCompletion(59, 10),
                                        expectedProvidersCompletion(59, 10)
                                    ] :
                                        (i === 61) ? [
                                            expectedPadLeftCompletion(59, 10),
                                            expectedParametersCompletion(59, 10)
                                        ] :
                                            (62 <= i && i <= 69) ? [
                                                expectedParametersCompletion(59, 10)
                                            ] :
                                                (i === 71) ? [parameterCompletion("adminUsername", 70, 2)] :
                                                    []);
            }

            for (let i = 0; i <= 140; ++i) {
                completionItemsTest(`{ "parameters": { "adminUsername": {} }, "a": "[resourceId(parameters('Microsoft.Networks/virtualNetworks', parameters('adminUsername'))]" }`, i,
                    (i === 48 || i === 59 || (107 <= i && i <= 108) || (135 <= i && i <= 136)) ? allTestDataExpectedCompletions(i, 0) :
                        (49 <= i && i <= 50) ? [
                            expectedReferenceCompletion(48, 10),
                            expectedReplaceCompletion(48, 10),
                            expectedResourceGroupCompletion(48, 10),
                            expectedResourceIdCompletion(48, 10)
                        ] :
                            (51 <= i && i <= 56) ? [
                                expectedResourceGroupCompletion(48, 10),
                                expectedResourceIdCompletion(48, 10)
                            ] :
                                (57 <= i && i <= 58) ? [
                                    expectedResourceIdCompletion(48, 10)
                                ] :
                                    (i === 60) ? [
                                        expectedPadLeftCompletion(59, 10),
                                        expectedParametersCompletion(59, 10),
                                        expectedProvidersCompletion(59, 10)
                                    ] :
                                        (i === 61) ? [
                                            expectedPadLeftCompletion(59, 10),
                                            expectedParametersCompletion(59, 10)
                                        ] :
                                            (62 <= i && i <= 69) ? [expectedParametersCompletion(59, 10)] :
                                                (i === 71) ? [parameterCompletion("adminUsername", 70, 36, false)] :
                                                    (i === 109) ? [
                                                        expectedPadLeftCompletion(108, 10),
                                                        expectedParametersCompletion(108, 10),
                                                        expectedProvidersCompletion(108, 10)
                                                    ] :
                                                        (i === 110) ? [
                                                            expectedPadLeftCompletion(108, 10),
                                                            expectedParametersCompletion(108, 10)
                                                        ] :
                                                            (111 <= i && i <= 118) ? [expectedParametersCompletion(108, 10)] :
                                                                (120 <= i && i <= 133) ? [parameterCompletion("adminUsername", 119, 16)] :
                                                                    []);
            }

            for (let i = 0; i <= 137; ++i) {
                completionItemsTest(`{ "variables": { "adminUsername": "" }, "a": "[resourceId(variables('Microsoft.Networks/virtualNetworks', variables('adminUsername'))]" }`, i,
                    (i === 47 || i === 58 || (105 <= i && i <= 106) || (132 <= i && i <= 133)) ? allTestDataExpectedCompletions(i, 0) :
                        (48 <= i && i <= 49) ? [
                            expectedReferenceCompletion(47, 10),
                            expectedReplaceCompletion(47, 10),
                            expectedResourceGroupCompletion(47, 10),
                            expectedResourceIdCompletion(47, 10)
                        ] :
                            (50 <= i && i <= 55) ? [
                                expectedResourceGroupCompletion(47, 10),
                                expectedResourceIdCompletion(47, 10)
                            ] :
                                (56 <= i && i <= 57) ? [
                                    expectedResourceIdCompletion(47, 10)
                                ] :
                                    (59 <= i && i <= 67) ? [
                                        expectedVariablesCompletion(58, 9),
                                    ] :
                                        (i === 69) ? [variableCompletion("adminUsername", 68, 36, false)] :
                                            (107 <= i && i <= 115) ? [
                                                expectedVariablesCompletion(106, 9)
                                            ] :
                                                (117 <= i && i <= 130) ? [variableCompletion("adminUsername", 116, 16)] :
                                                    []);
            }

            for (let i = 0; i <= 25; ++i) {
                completionItemsTest(`{ 'a': "[parameters()]" }`, i,
                    (i === 9) ? allTestDataExpectedCompletions(9, 0) :
                        (i === 10) ? [
                            expectedPadLeftCompletion(9, 10),
                            expectedParametersCompletion(9, 10),
                            expectedProvidersCompletion(9, 10)
                        ] :
                            (i === 11) ? [
                                expectedPadLeftCompletion(9, 10),
                                expectedParametersCompletion(9, 10)
                            ] :
                                (12 <= i && i <= 19) ? [
                                    expectedParametersCompletion(9, 10)
                                ] :
                                    (i === 21) ? allTestDataExpectedCompletions(21, 0) :
                                        []);
            }

            for (let i = 0; i <= 52; ++i) {
                completionItemsTest(`{ 'parameters': { 'p1': {} }, 'a': "[parameters(]" }`, i,
                    (i === 37) ? allTestDataExpectedCompletions(37, 0) :
                        (i === 38) ? [
                            expectedPadLeftCompletion(37, 10),
                            expectedParametersCompletion(37, 10),
                            expectedProvidersCompletion(37, 10)
                        ] :
                            (i === 39) ? [
                                expectedPadLeftCompletion(37, 10),
                                expectedParametersCompletion(37, 10)
                            ] :
                                (40 <= i && i <= 47) ? [expectedParametersCompletion(37, 10)] :
                                    (i === 48) ? [parameterCompletion("p1", 48, 0)] :
                                        []);
            }

            for (let i = 0; i <= 81; ++i) {
                completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': "[parameters('`, i,
                    (i === 69) ? allTestDataExpectedCompletions(69, 0) :
                        (i === 70) ? [
                            expectedPadLeftCompletion(69, 10),
                            expectedParametersCompletion(69, 10),
                            expectedProvidersCompletion(69, 10)
                        ] :
                            (i === 71) ? [
                                expectedPadLeftCompletion(69, 10),
                                expectedParametersCompletion(69, 10)
                            ] :
                                (72 <= i && i <= 79) ? [expectedParametersCompletion(69, 10)] :
                                    (i === 81) ? [parameterCompletion("pName", 80, 1)] :
                                        []);
            }

            for (let i = 0; i <= 76; ++i) {
                completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': "[parameters(')]" }`, i,
                    (i === 59) ? allTestDataExpectedCompletions(59, 0) :
                        (i === 60) ? [
                            expectedPadLeftCompletion(59, 10),
                            expectedParametersCompletion(59, 10),
                            expectedProvidersCompletion(59, 10)
                        ] :
                            (i === 61) ? [
                                expectedPadLeftCompletion(59, 10),
                                expectedParametersCompletion(59, 10)
                            ] :
                                (62 <= i && i <= 69) ? [expectedParametersCompletion(59, 10)] :
                                    (i === 71) ? [parameterCompletion("pName", 70, 2)] :
                                        []);
            }

            for (let i = 0; i <= 75; ++i) {
                completionItemsTest(`{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': "[parameters(']" }`, i,
                    (i === 59) ? allTestDataExpectedCompletions(59, 0) :
                        (i === 60) ? [
                            expectedPadLeftCompletion(59, 10),
                            expectedParametersCompletion(59, 10),
                            expectedProvidersCompletion(59, 10)
                        ] :
                            (i === 61) ? [
                                expectedPadLeftCompletion(59, 10),
                                expectedParametersCompletion(59, 10)
                            ] :
                                (62 <= i && i <= 69) ? [expectedParametersCompletion(59, 10)] :
                                    (i === 71) ? [parameterCompletion("pName", 70, 1)] :
                                        []);
            }

            for (let i = 0; i <= 53; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': "[variables('p)]`, i,
                    (i === 39) ? allTestDataExpectedCompletions(39, 0) :
                        (40 <= i && i <= 48) ? [expectedVariablesCompletion(39, 9)] :
                            (i === 50) ? [variableCompletion("vName", 49, 3)] :
                                []);
            }

            for (let i = 0; i <= 65; ++i) {
                completionItemsTest(`{ 'variables': { 'vName': 20 }, 'a': 'A', 'b': "[concat  spam  ('`, i,
                    (i === 49 || (56 <= i && i <= 63)) ? allTestDataExpectedCompletions(i, 0) :
                        (50 <= i && i <= 51) ? [
                            expectedConcatCompletion(49, 6),
                            expectedCopyIndexCompletion(49, 6)
                        ] :
                            (52 <= i && i <= 55) ? [
                                expectedConcatCompletion(49, 6)
                            ] :
                                []);
            }

            for (let i = 0; i <= 28; ++i) {
                completionItemsTest(`{ "a": "[resourceGroup()]" }`, i,
                    (i === 9 || (23 <= i && i <= 24)) ? allTestDataExpectedCompletions(i, 0) :
                        (10 <= i && i <= 11) ? [
                            expectedReferenceCompletion(9, 13),
                            expectedReplaceCompletion(9, 13),
                            expectedResourceGroupCompletion(9, 13),
                            expectedResourceIdCompletion(9, 13)
                        ] :
                            (12 <= i && i <= 17) ? [
                                expectedResourceGroupCompletion(9, 13),
                                expectedResourceIdCompletion(9, 13)
                            ] :
                                (18 <= i && i <= 22) ? [
                                    expectedResourceGroupCompletion(9, 13)
                                ] :
                                    []);
            }

            for (let i = 0; i <= 29; ++i) {
                completionItemsTest(`{ "a": "[resourceGroup().]" }`, i,
                    (i === 9 || i === 23) ? allTestDataExpectedCompletions(i, 0) :
                        (10 <= i && i <= 11) ? [
                            expectedReferenceCompletion(9, 13),
                            expectedReplaceCompletion(9, 13),
                            expectedResourceGroupCompletion(9, 13),
                            expectedResourceIdCompletion(9, 13)
                        ] :
                            (12 <= i && i <= 17) ? [
                                expectedResourceGroupCompletion(9, 13),
                                expectedResourceIdCompletion(9, 13)
                            ] :
                                (18 <= i && i <= 22) ? [
                                    expectedResourceGroupCompletion(9, 13)
                                ] :
                                    (24 <= i && i <= 25) ? [
                                        propertyCompletion("id", i, 0),
                                        propertyCompletion("location", i, 0),
                                        propertyCompletion("name", i, 0),
                                        propertyCompletion("properties", i, 0),
                                        propertyCompletion("tags", i, 0)
                                    ] :
                                        []);
            }

            for (let i = 0; i <= 31; ++i) {
                completionItemsTest(`{ "a": "[resourceGroup().lo]" }`, i,
                    (i === 9 || i === 23) ? allTestDataExpectedCompletions(i, 0) :
                        (10 <= i && i <= 11) ? [
                            expectedReferenceCompletion(9, 13),
                            expectedReplaceCompletion(9, 13),
                            expectedResourceGroupCompletion(9, 13),
                            expectedResourceIdCompletion(9, 13)
                        ] :
                            (12 <= i && i <= 17) ? [
                                expectedResourceGroupCompletion(9, 13),
                                expectedResourceIdCompletion(9, 13)
                            ] :
                                (18 <= i && i <= 22) ? [
                                    expectedResourceGroupCompletion(9, 13)
                                ] :
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

            suite("Variable value deep completion for objects", () => {
                for (let i = 0; i <= 28; ++i) {
                    completionItemsTest(`{ "b": "[variables('a').]" }`, i,
                        (i === 9) ? allTestDataExpectedCompletions(9, 0) :
                            (10 <= i && i <= 18) ? [expectedVariablesCompletion(9, 9)] :
                                []);
                }

                for (let i = 0; i <= 55; ++i) {
                    completionItemsTest(`{ "variables": { "a": "A" }, "b": "[variables('a').]" }`, i,
                        (i === 36) ? allTestDataExpectedCompletions(36, 0) :
                            (37 <= i && i <= 45) ? [expectedVariablesCompletion(36, 9)] :
                                (47 <= i && i <= 48) ? [variableCompletion("a", 46, 4)] :
                                    []);
                }

                for (let i = 0; i <= 55; ++i) {
                    completionItemsTest(`{ "variables": { "a": 123 }, "b": "[variables('a').]" }`, i,
                        (i === 36) ? allTestDataExpectedCompletions(36, 0) :
                            (37 <= i && i <= 45) ? [expectedVariablesCompletion(36, 9)] :
                                (47 <= i && i <= 48) ? [variableCompletion("a", 46, 4)] :
                                    []);
                }

                for (let i = 0; i <= 56; ++i) {
                    completionItemsTest(`{ "variables": { "a": true }, "b": "[variables('a').]" }`, i,
                        (i === 37) ? allTestDataExpectedCompletions(37, 0) :
                            (38 <= i && i <= 46) ? [expectedVariablesCompletion(37, 9)] :
                                (48 <= i && i <= 49) ? [variableCompletion("a", 47, 4)] :
                                    []);
                }

                for (let i = 0; i <= 56; ++i) {
                    completionItemsTest(`{ "variables": { "a": null }, "b": "[variables('a').]" }`, i,
                        (i === 37) ? allTestDataExpectedCompletions(37, 0) :
                            (38 <= i && i <= 46) ? [expectedVariablesCompletion(37, 9)] :
                                (48 <= i && i <= 49) ? [variableCompletion("a", 47, 4)] :
                                    []);
                }

                for (let i = 0; i <= 54; ++i) {
                    completionItemsTest(`{ "variables": { "a": [] }, "b": "[variables('a').]" }`, i,
                        (i === 35) ? allTestDataExpectedCompletions(35, 0) :
                            (36 <= i && i <= 44) ? [expectedVariablesCompletion(35, 9)] :
                                (46 <= i && i <= 47) ? [variableCompletion("a", 45, 4)] :
                                    []);
                }

                for (let i = 0; i <= 54; ++i) {
                    completionItemsTest(`{ "variables": { "a": {} }, "b": "[variables('a').]" }`, i,
                        (i === 35) ? allTestDataExpectedCompletions(35, 0) :
                            (36 <= i && i <= 44) ? [expectedVariablesCompletion(35, 9)] :
                                (46 <= i && i <= 47) ? [variableCompletion("a", 45, 4)] :
                                    []);
                }

                for (let i = 0; i <= 67; ++i) {
                    completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').]" }`, i,
                        (i === 48) ? allTestDataExpectedCompletions(48, 0) :
                            (49 <= i && i <= 57) ? [expectedVariablesCompletion(48, 9)] :
                                (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                    (62 <= i && i <= 63) ? [propertyCompletion("name", i, 0)] :
                                        []);
                }

                for (let i = 0; i <= 69; ++i) {
                    completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').na]" }`, i,
                        (i === 48) ? allTestDataExpectedCompletions(48, 0) :
                            (49 <= i && i <= 57) ? [expectedVariablesCompletion(48, 9)] :
                                (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                    (62 <= i && i <= 65) ? [propertyCompletion("name", 63, 2)] :
                                        []);
                }

                for (let i = 0; i <= 69; ++i) {
                    completionItemsTest(`{ "variables": { "a": { "name": "A" } }, "b": "[variables('a').ab]" }`, i,
                        (i === 48) ? allTestDataExpectedCompletions(48, 0) :
                            (49 <= i && i <= 57) ? [expectedVariablesCompletion(48, 9)] :
                                (59 <= i && i <= 60) ? [variableCompletion("a", 58, 4)] :
                                    (62 <= i && i <= 63) ? [propertyCompletion("name", 63, 2)] :
                                        []);
                }

                for (let i = 0; i <= 78; ++i) {
                    completionItemsTest(`{ "variables": { "a": { "bb": { "cc": 200 } } }, "b": "[variables('a').bb.]" }`, i,
                        (i === 56) ? allTestDataExpectedCompletions(56, 0) :
                            (57 <= i && i <= 65) ? [expectedVariablesCompletion(56, 9)] :
                                (67 <= i && i <= 68) ? [variableCompletion("a", 66, 4)] :
                                    (70 <= i && i <= 73) ? [propertyCompletion("bb", 71, 2)] :
                                        (i === 74) ? [propertyCompletion("cc", 74, 0)] :
                                            []);
                }

                // Should retain original casing when completing
                for (let i = 0; i <= 78; ++i) {
                    completionItemsTest(`{ "variables": { "A": { "Bb": { "cC": 200 } } }, "b": "[variables('a').Bb.]" }`, i,
                        (i === 56) ? allTestDataExpectedCompletions(56, 0) :
                            (57 <= i && i <= 65) ? [expectedVariablesCompletion(56, 9)] :
                                (67 <= i && i <= 68) ? [variableCompletion("A", 66, 4)] :
                                    (70 <= i && i <= 73) ? [propertyCompletion("Bb", 71, 2)] :
                                        (i === 74) ? [propertyCompletion("cC", 74, 0)] :
                                            []);
                }

                // Casing shouldn't matter for finding completions
                for (let i = 0; i <= 78; ++i) {
                    completionItemsTest(`{ "variables": { "A": { "Bb": { "cC": 200 } } }, "b": "[variables('a').BB.Cc]" }`, i,
                        (i === 56) ? allTestDataExpectedCompletions(56, 0) :
                            (57 <= i && i <= 65) ? [expectedVariablesCompletion(56, 9)] :
                                (67 <= i && i <= 68) ? [variableCompletion("A", 66, 4)] :
                                    (70 <= i && i <= 73) ? [propertyCompletion("Bb", 71, 2)] :
                                        (74 <= i && i <= 76) ? [propertyCompletion("cC", 74, 2)] :
                                            []);
                }

            });

            // CONSIDER: Use parseTemplateWithMarkers
            function getDocumentAndMarkers(document: object | string): { documentText: string; tokens: number[] } {
                let tokens: number[] = [];
                document = typeof document === "string" ? document : JSON.stringify(document);

                // tslint:disable-next-line:no-constant-condition
                while (true) {
                    let tokenPos = document.indexOf("!");
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
        }
    });

    suite("signatureHelp", () => {
        test("not in a TLE", () => {
            const dt = new DeploymentTemplate(`{ "a": "AA" }`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "A`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp | null = pc.getSignatureHelp();
            assert.deepStrictEqual(functionSignatureHelp, null);
        });

        test("in empty TLE", () => {
            const dt = new DeploymentTemplate(`{ "a": "[]" }`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp | null = pc.getSignatureHelp();
            assert.deepStrictEqual(functionSignatureHelp, null);
        });

        test("in TLE function name", () => {
            const dt = new DeploymentTemplate(`{ "a": "[con]" }`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[con`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp | null = pc.getSignatureHelp();
            assert.deepStrictEqual(functionSignatureHelp, null);
        });

        test("after left parenthesis", () => {
            const dt = new DeploymentTemplate(`{ "a": "[concat(`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat(`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 0);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("inside first parameter", () => {
            const dt = new DeploymentTemplate(`{ "a": "[concat('test`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('test`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 0);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("inside second parameter", () => {
            const dt = new DeploymentTemplate(`{ "a": "[concat('t1', 't2`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('t1', 't2`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 1);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("inside empty parameter", () => {
            const dt = new DeploymentTemplate(`{ "a": "[concat(,,,`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat(,,`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 2);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("in variadic parameter when function signature has '...' parameter and the current argument is greater than the parameter count", () => {
            const dt = new DeploymentTemplate(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f'`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f'`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 3);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("in variadic parameter when function signature has '...' parameter and the current argument is equal to the parameter count", () => {
            const dt = new DeploymentTemplate(`{ "a": "[concat('a', 'b', 'c', 'd'`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd'`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 3);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("in variadic parameter when function signature has 'name...' parameter", () => {
            const dt = new DeploymentTemplate(`{ "a": "[resourceId('a', 'b', 'c', 'd', 'e', 'f', 'g'`, "id");
            const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f', 'g'`.length);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 4);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "resourceId");
        });

        suite("signatureHelp for UDFs", () => {
            // const udfConcat: IDeploymentFunctionDefinition = {
            //     parameters: [
            //         {
            //             name: "p1",
            //             type: "string"
            //         }
            //     ],
            //     output: {
            //         type: "string",
            //         value: "[concat('mystorage', uniqueString(parameters('p1')))]"
            //     }
            // };

            const udfTemplate: IDeploymentTemplate = {
                $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.0.0.0",
                functions: [{
                    namespace: "udf",
                    members: {
                        "concat": {
                            parameters: [
                                {
                                    name: "p1",
                                    type: "string"
                                },
                                {
                                    name: "p2",
                                    type: "string"
                                }
                            ],
                            output: {
                                type: "string",
                                value: "[concat(parameters('p1'), parameters('p2'))]"
                            }
                        },
                        "random": {
                            output: {
                                type: "int",
                                value: "123"
                            }
                        },
                        "double": {
                            output: {
                                type: "int",
                                value: "[mult(2, parameters('number'))]"
                            },
                            parameters: [
                                {
                                    name: "number",
                                    type: "int"
                                }
                            ]
                        },
                        "mysterious": {
                            output: {
                                // tslint:disable-next-line: no-any
                                type: <any>"INT",
                                value: "[mult(2, parameters('number'))]"
                            },
                            parameters: [
                                {
                                    name: "p1",
                                    type: "secureobject"
                                },
                                {
                                    name: "p2",
                                    // tslint:disable-next-line: no-any
                                    type: <any>undefined
                                }
                            ]
                        },
                        "badreturn": {
                            output: {
                                // tslint:disable-next-line: no-any
                                "type": <any>"whoseit",
                                "value": "hi"
                            }
                        }
                    }
                }],
                parameters: {
                    p1: {
                        type: "string",
                        defaultValue: "[udf.storageUri('p1')]"
                    }
                },
                resources: [],
                outputs: {
                    o1: {
                        type: "string",
                        value: "[<o1value>]"
                    }
                }
            };

            const expectedUdfConcatMetadata = new UserFunctionMetadata(
                "udf.concat",
                "concat",
                `udf.concat(p1 [string], p2 [string]) [string]`,
                "User-defined function",
                [
                    { name: "p1", "type": "string" },
                    { name: "p2", "type": "string" }
                ],
                "string",
                []);

            // A bang ("!") in the expression marks the position to test at
            async function testUdfSignatureHelp(expressionWithBang: string, expected: TLE.FunctionSignatureHelp | null): Promise<void> {
                const templateString = stringify(udfTemplate).replace('<o1value>', expressionWithBang);

                const { dt, markers: { bang } } = await parseTemplateWithMarkers(templateString);
                assert(bang, "You must place a bang ('!') in the expression string to indicate position");
                const pc: PositionContext = dt.getContextFromDocumentCharacterIndex(bang.index);
                const functionSignatureHelp: TLE.FunctionSignatureHelp | null = pc.getSignatureHelp();
                assert.deepStrictEqual(functionSignatureHelp, expected);
            }

            test("in UDF function name", async () => {
                await testUdfSignatureHelp("udf.!con", null);
            });

            test("in UDF namespace name", async () => {
                await testUdfSignatureHelp("u!df.con", null);
            });

            test("in UDF call's period", async () => {
                await testUdfSignatureHelp("udf!.con", null);
            });

            test("after UDF left parenthesis, with same name as built-in function and UDF function not defined", async () => {
                await testUdfSignatureHelp("udf.add(!", null);
            });

            test("after UDF left parenthesis, with same name as built-in function, udf exists", async () => {
                await testUdfSignatureHelp("udf.concat(!",
                    new FunctionSignatureHelp(0, expectedUdfConcatMetadata));
            });

            test("inside first parameter", async () => {
                await testUdfSignatureHelp("udf.concat('hello!', 'there')",
                    new FunctionSignatureHelp(0, expectedUdfConcatMetadata));
            });

            test("inside second parameter", async () => {
                await testUdfSignatureHelp("udf.concat('hello', 'th!ere')",
                    new FunctionSignatureHelp(1, expectedUdfConcatMetadata));
            });

            test("no params", async () => {
                await testUdfSignatureHelp("udf.random(!)",
                    new FunctionSignatureHelp(
                        0,
                        new UserFunctionMetadata(
                            "udf.random",
                            "random",
                            `udf.random() [int]`,
                            "User-defined function",
                            [],
                            "int",
                            [])));
            });

            test("one param", async () => {
                await testUdfSignatureHelp("udf.double(12!345) [int]",
                    new FunctionSignatureHelp(
                        0,
                        new UserFunctionMetadata(
                            "udf.double",
                            "double",
                            `udf.double(number [int]) [int]`,
                            "User-defined function",
                            [
                                { name: "number", "type": "int" }
                            ],
                            "int",
                            [])
                    ));
            });

            test("param with no type", async () => {
                await testUdfSignatureHelp("udf.mysterious(12!345, 2)",
                    new FunctionSignatureHelp(
                        0,
                        new UserFunctionMetadata(
                            "udf.mysterious",
                            "mysterious",
                            `udf.mysterious(p1 [secureobject], p2) [int]`,
                            "User-defined function",
                            [
                                { name: "p1", "type": "secureobject" },
                                { name: "p2", "type": null }
                            ],
                            "int",
                            [])
                    ));
            });

            test("invalid return type", async () => {
                await testUdfSignatureHelp("udf.badreturn(!)",
                    new FunctionSignatureHelp(
                        0,
                        new UserFunctionMetadata(
                            "udf.badreturn",
                            "badreturn",
                            `udf.badreturn()`,
                            "User-defined function",
                            [
                            ],
                            null,
                            [])
                    ));
            });

            test("namespace but no function name", async () => {
                await testUdfSignatureHelp("udf.!", null);
            });
        });
    });

    suite("parameterDefinition", () => {
        async function getParameterDefinitionIfAtReference(pc: PositionContext): Promise<IParameterDefinition | null> {
            const refInfo: IReferenceSite | null = pc.getReferenceSiteInfo();
            if (refInfo && refInfo.definition.definitionKind === "Parameter") {
                return <IParameterDefinition>refInfo.definition;
            }

            return null;
        }

        test("with no parameters property", async () => {
            const dt = new DeploymentTemplate("{ 'a': '[parameters(\"pName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': '[parameters(\"pN".length);
            assert.deepStrictEqual(await getParameterDefinitionIfAtReference(context), null);
        });

        test("with empty parameters property value", async () => {
            const dt = new DeploymentTemplate("{ 'parameters': {}, 'a': '[parameters(\"pName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': {}, 'a': '[parameters(\"pN".length);
            assert.deepStrictEqual(await getParameterDefinitionIfAtReference(context), null);
        });

        test("with matching parameter definition", async () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pNa".length);
            const parameterDefinition: IParameterDefinition = assertNotNull(await getParameterDefinitionIfAtReference(context));
            assert.deepStrictEqual(parameterDefinition.nameValue.toString(), "pName");
            assert.deepStrictEqual(parameterDefinition.description, null);
            assert.deepStrictEqual(parameterDefinition.fullSpan, new Language.Span(18, 11));
        });

        test("with cursor before parameter name start quote with matching parameter definition", async () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(".length);
            const parameterDefinition: IParameterDefinition = assertNotNull(await getParameterDefinitionIfAtReference(context));
            assert.deepStrictEqual(parameterDefinition.nameValue.toString(), "pName");
            assert.deepStrictEqual(parameterDefinition.description, null);
            assert.deepStrictEqual(parameterDefinition.fullSpan, new Language.Span(18, 11));
        });

        test("with cursor after parameter name end quote with matching parameter definition", async () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\"".length);
            const parameterDefinition: IParameterDefinition = assertNotNull(await getParameterDefinitionIfAtReference(context));
            assert.deepStrictEqual(parameterDefinition.nameValue.toString(), "pName");
            assert.deepStrictEqual(parameterDefinition.description, null);
            assert.deepStrictEqual(parameterDefinition.fullSpan, new Language.Span(18, 11));
        });
    });

    suite("variableDefinition", () => {
        function getVariableDefinitionIfAtReference(pc: PositionContext): IVariableDefinition | null {
            const refInfo: IReferenceSite | null = pc.getReferenceSiteInfo();
            if (refInfo && isVariableDefinition(refInfo.definition)) {
                return refInfo.definition;
            }

            return null;
        }

        test("with no variables property", () => {
            const dt = new DeploymentTemplate("{ 'a': '[variables(\"vName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': '[variables(\"vN".length);
            assert.deepStrictEqual(getVariableDefinitionIfAtReference(context), null);
        });

        test("with empty variables property value", () => {
            const dt = new DeploymentTemplate("{ 'variables': {}, 'a': '[variables(\"vName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': {}, 'a': '[variables(\"vN".length);
            assert.deepStrictEqual(getVariableDefinitionIfAtReference(context), null);
        });

        test("with matching variable definition", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vNa".length);
            const vDef: IVariableDefinition = assertNotNull(getVariableDefinitionIfAtReference(context));
            assert.deepStrictEqual(vDef.nameValue.toString(), "vName");
            assert.deepStrictEqual(vDef.span, new Language.Span(17, 11));
        });

        test("with cursor before variable name start quote with matching variable definition", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(".length);
            const vDef: IVariableDefinition = assertNotNull(getVariableDefinitionIfAtReference(context));
            assert.deepStrictEqual(vDef.nameValue.toString(), "vName");
            assert.deepStrictEqual(vDef.span, new Language.Span(17, 11));
        });

        test("with cursor after parameter name end quote with matching parameter definition", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", "id");
            const context: PositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\"".length);
            const vDef: IVariableDefinition = assertNotNull(getVariableDefinitionIfAtReference(context));
            assert.deepStrictEqual(vDef.nameValue.toString(), "vName");
            assert.deepStrictEqual(vDef.span, new Language.Span(17, 11));
        });
    });
});
