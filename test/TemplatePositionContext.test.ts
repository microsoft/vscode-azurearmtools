// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length cyclomatic-complexity promise-function-async align max-line-length max-line-length no-undefined-keyword
// tslint:disable:no-non-null-assertion object-literal-key-quotes

import * as assert from "assert";
import * as os from 'os';
import { Uri } from "vscode";
import { Completion, DeploymentTemplateDoc, FunctionSignatureHelp, HoverInfo, IParameterDefinition, IReferenceSite, Issue, IssueKind, isVariableDefinition, IVariableDefinition, Json, LineColPos, nonNullValue, ParametersPositionContext, ReferenceSiteKind, Span, strings, TemplatePositionContext, TLE, UserFunctionMetadata } from "../extension.bundle";
import * as jsonTest from "./JSON.test";
import { IDeploymentTemplate, IPartialDeploymentTemplate } from "./support/diagnostics";
import { parseParametersWithMarkers, parseTemplate, parseTemplateWithMarkers } from "./support/parseTemplate";
import { stringify } from "./support/stringify";
import { UseNoSnippets } from "./support/TestSnippets";
import { testWithPrep } from "./support/testWithPrep";
import { allTestDataCompletionNames, allTestDataExpectedCompletions, parameterCompletion, propertyCompletion, variableCompletion } from "./TestData";

const fakeId = Uri.file("https://doc-id");

suite("TemplatePositionContext", () => {
    suite("allow out of bounds", () => {
        const template = '"{\n    \"$schema\": \"https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#\",\n    \"contentVersion\": \"1.0.0.0\",\n    \"resources\": [\n    ],\n    \"functions\": [\n      {\n          \n\n      }  \n    ]\n}"';

        test("documentColumnIndex cannot be greater than the line's maximum index", async () => {
            const line = 200;
            const col = 11;
            const dt = await parseTemplate(template);
            const pc = dt.getContextFromDocumentLineAndColumnIndexes(line, col, undefined, true);
            assert(pc);
            assert.equal(pc.documentLineIndex, 11);
            assert.equal(pc.documentColumnIndex, 2);
        });

        test("documentLineIndex cannot be greater than or equal to the deployment template's line count", async () => {
            const line = 7;
            const col = 11;
            const dt = await parseTemplate(template);
            const pc = dt.getContextFromDocumentLineAndColumnIndexes(line, col, undefined, true);
            assert(pc);
            assert.equal(pc.documentLineIndex, 7);
            assert.equal(pc.documentColumnIndex, 10);
        });

        test("documentCharacterIndex cannot be greater than the maximum character index", async () => {
            const dt = await parseTemplate(template);
            const pc = dt.getContextFromDocumentCharacterIndex(10000, undefined, true);
            assert(pc);
            assert.equal(pc.documentLineIndex, 11);
            assert.equal(pc.documentColumnIndex, 2);
        });
    });

    suite("fromDocumentLineAndColumnIndexes(DeploymentTemplate,number,number)", () => {
        test("with undefined deploymentTemplate", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(<any>undefined, 1, 2, undefined); });
        });

        test("with undefined deploymentTemplate", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(<any>undefined, 1, 2, undefined); });
        });

        test("with undefined documentLineIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, <any>undefined, 2, undefined); });
        });

        test("with undefined documentLineIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, <any>undefined, 2, undefined); });
        });

        test("with negative documentLineIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, -1, 2, undefined); });
        });

        test("with documentLineIndex equal to document line count", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            assert.deepStrictEqual(1, dt.lineCount);
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, 1, 0, undefined); });
        });

        test("with undefined documentColumnIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, 0, <any>undefined, undefined); });
        });

        test("with undefined documentColumnIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, 0, <any>undefined, undefined); });
        });

        test("with negative documentColumnIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, 0, -2, undefined); });
        });

        test("with documentColumnIndex greater than line length", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            assert.throws(() => { TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, 0, 3, undefined); });
        });

        test("with valid arguments", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            let documentLineIndex = 0;
            let documentColumnIndex = 2;
            let pc = TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, documentLineIndex, documentColumnIndex, undefined);
            assert.deepStrictEqual(new LineColPos(0, 2), pc.documentPosition);
            assert.deepStrictEqual(0, pc.documentLineIndex);
            assert.deepStrictEqual(2, pc.documentColumnIndex);
        });
    });

    suite("fromDocumentCharacterIndex(DeploymentTemplate,number)", () => {
        test("with undefined deploymentTemplate", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentCharacterIndex(<any>undefined, 1, undefined); });
        });

        test("with undefined deploymentTemplate", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentCharacterIndex(<any>undefined, 1, undefined); });
        });

        test("with undefined documentCharacterIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentCharacterIndex(dt, <any>undefined, undefined); });
        });

        test("with undefined documentCharacterIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            // tslint:disable-next-line:no-any
            assert.throws(() => { TemplatePositionContext.fromDocumentCharacterIndex(dt, <any>undefined, undefined); });
        });

        test("with negative documentCharacterIndex", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            assert.throws(() => { TemplatePositionContext.fromDocumentCharacterIndex(dt, -1, undefined); });
        });

        test("with documentCharacterIndex greater than the maximum character index", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            assert.throws(() => { TemplatePositionContext.fromDocumentCharacterIndex(dt, 3, undefined); });
        });

        test("with valid arguments", () => {
            let dt = new DeploymentTemplateDoc("{}", fakeId);
            let documentCharacterIndex = 2;
            let pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, documentCharacterIndex, undefined);
            assert.deepStrictEqual(2, pc.documentCharacterIndex);
        });
    });

    suite("documentPosition", () => {
        test("with PositionContext from line and column indexes", () => {
            const dt = new DeploymentTemplateDoc("{\n}", fakeId);
            let pc = TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, 1, 0, undefined);
            assert.deepStrictEqual(new LineColPos(1, 0), pc.documentPosition);
        });

        test("with PositionContext from characterIndex", () => {
            let pc = TemplatePositionContext.fromDocumentCharacterIndex(new DeploymentTemplateDoc("{\n}", fakeId), 2, undefined);
            assert.deepStrictEqual(new LineColPos(1, 0), pc.documentPosition);
        });
    });

    suite("documentCharacterIndex", () => {
        test("with PositionContext from line and column indexes", () => {
            let pc = TemplatePositionContext.fromDocumentLineAndColumnIndexes(new DeploymentTemplateDoc("{\n}", fakeId), 1, 0, undefined);
            assert.deepStrictEqual(2, pc.documentCharacterIndex);
        });

        test("with PositionContext from characterIndex", () => {
            let pc = TemplatePositionContext.fromDocumentCharacterIndex(new DeploymentTemplateDoc("{\n}", fakeId), 2, undefined);
            assert.deepStrictEqual(2, pc.documentCharacterIndex);
        });
    });

    suite("getTokenAtOrAfterCursor", () => {
        function getTextAtReplacementSpan(dt: DeploymentTemplateDoc, index: number): string | undefined {
            const span = dt.getContextFromDocumentCharacterIndex(index, undefined)
                .getCompletionReplacementSpanInfo().span;
            return span ? dt.getDocumentText(span) : undefined;
        }

        test("hyphens and exclamation points", async () => {
            const dt = await parseTemplate("{ arm-keyvault!hello }", undefined, { ignoreBang: true });

            assert.equal(getTextAtReplacementSpan(dt, 0), undefined); // {
            assert.equal(getTextAtReplacementSpan(dt, 1), undefined);
            for (let i = 2; i <= 19; ++i) { // a-o
                assert.equal(getTextAtReplacementSpan(dt, i), 'arm-keyvault!hello');
            }

            assert.equal(getTextAtReplacementSpan(dt, 20), 'arm-keyvault!hello'); // space after hello
            assert.equal(getTextAtReplacementSpan(dt, 21), undefined); // }
            assert.equal(getTextAtReplacementSpan(dt, 22), undefined);
        });
    });

    suite("jsonToken", () => {
        test("with characterIndex in whitespace", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(1, undefined);
            assert.deepStrictEqual(undefined, pc.jsonToken);
        });

        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(0, undefined);
            assert.deepStrictEqual(Json.LeftCurlyBracket(0), pc.jsonToken);
        });

        test("with characterIndex at the start of a QuotedString", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(2, undefined);
            assert.deepStrictEqual(pc.jsonToken, jsonTest.parseQuotedString(`'a'`, 2));
        });

        test("with characterIndex inside of a QuotedString", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(3, undefined);
            assert.deepStrictEqual(pc.jsonToken, jsonTest.parseQuotedString(`'a'`, 2));
        });

        test("with characterIndex at the end of a closed QuotedString", () => {
            let dt = new DeploymentTemplateDoc("{ 'a'", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(5, undefined);
            assert.deepStrictEqual(pc.jsonToken, jsonTest.parseQuotedString(`'a'`, 2));
        });

        test("with characterIndex at the end of an unclosed QuotedString", () => {
            let dt = new DeploymentTemplateDoc("{ 'a", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(4, undefined);
            assert.deepStrictEqual(pc.jsonToken, jsonTest.parseQuotedString(`'a`, 2));
        });
    });

    suite("tleParseResult", () => {
        test("with characterIndex in whitespace", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(1, undefined);
            assert.deepStrictEqual(pc.tleInfo, undefined);
        });

        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(0, undefined);
            assert.deepStrictEqual(pc.tleInfo, undefined);
        });

        test("with characterIndex at the start of a Colon", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(5, undefined);
            assert.deepStrictEqual(pc.tleInfo, undefined);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(2, undefined);
            assert.deepStrictEqual(TLE.Parser.parse("'a'", dt.topLevelScope), pc.tleInfo!.tleParseResult);
        });

        test("with characterIndex at the start of a closed TLE QuotedString", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(17, undefined);

            const tleParseResult: TLE.TleParseResult = pc.tleInfo!.tleParseResult;
            assert.deepStrictEqual(tleParseResult.errors, []);
            assert.deepStrictEqual(tleParseResult.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
            assert.deepStrictEqual(tleParseResult.rightSquareBracketToken, TLE.Token.createRightSquareBracket(13));

            const concat: TLE.FunctionCallValue = nonNullValue(TLE.asFunctionCallValue(tleParseResult.expression));
            assert.deepStrictEqual(concat.parent, undefined);
            assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(12));
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: TLE.StringValue = nonNullValue(TLE.asStringValue(concat.argumentExpressions[0]));
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'B'"));
        });

        test("with characterIndex at the start of an unclosed TLE QuotedString", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B'", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(17, undefined);

            const tleParseResult: TLE.TleParseResult = pc.tleInfo!.tleParseResult;
            assert.deepStrictEqual(
                tleParseResult.errors,
                [
                    new Issue(new Span(11, 1), "Expected a right square bracket (']').", IssueKind.tleSyntax)
                ]);
            assert.deepStrictEqual(tleParseResult.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
            assert.deepStrictEqual(tleParseResult.rightSquareBracketToken, undefined);

            const concat: TLE.FunctionCallValue = nonNullValue(TLE.asFunctionCallValue(tleParseResult.expression));
            assert.deepStrictEqual(concat.parent, undefined);
            assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, undefined);
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: TLE.StringValue = nonNullValue(TLE.asStringValue(concat.argumentExpressions[0]));
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'B'"));
        });
    });

    suite("tleCharacterIndex", () => {
        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(0, undefined);
            assert.deepStrictEqual(pc.tleInfo, undefined);
        });

        test("with characterIndex in whitespace", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(1, undefined);
            assert.deepStrictEqual(undefined, pc.tleInfo);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(2, undefined);
            assert.deepStrictEqual(0, pc.tleInfo!.tleCharacterIndex);
        });

        test("with characterIndex at the start of a TLE", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(17, undefined);
            assert.deepStrictEqual(0, pc.tleInfo!.tleCharacterIndex);
        });

        test("with characterIndex inside of a TLE", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(21, undefined);
            assert.deepStrictEqual(pc.tleInfo!.tleCharacterIndex, 4);
        });

        test("with characterIndex after the end of a closed TLE", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(32, undefined);
            assert.deepStrictEqual(pc.tleInfo, undefined);
        });

        test("with characterIndex after the end of an unclosed TLE", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B'", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(29, undefined);
            assert.deepStrictEqual(12, pc.tleInfo!.tleCharacterIndex);
        });
    });

    suite("tleValue", () => {
        test("with characterIndex at the start of a LeftCurlyBracket", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(0, undefined);
            assert.deepStrictEqual(pc.tleInfo, undefined);
        });

        test("with characterIndex in whitespace", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(1, undefined);
            assert.deepStrictEqual(pc.tleInfo, undefined);
        });

        test("with characterIndex at the start of a non-TLE QuotedString", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(2, undefined);
            assert.deepStrictEqual(
                pc.tleInfo!.tleValue,
                new TLE.StringValue(TLE.Token.createQuotedString(0, "'a'")));
        });

        test("with characterIndex at the start of a TLE", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': ".length, undefined);
            assert.deepStrictEqual(pc.tleInfo!.tleValue, undefined);
        });

        test("with characterIndex inside of a TLE", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(21, undefined);

            const concat: TLE.FunctionCallValue = nonNullValue(TLE.asFunctionCallValue(pc.tleInfo!.tleValue));
            assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(12));
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);
            const arg1: TLE.StringValue = nonNullValue(TLE.asStringValue(concat.argumentExpressions[0]));
            assert.deepStrictEqual(arg1.parent, concat);
            assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'B'"));
        });

        test("with characterIndex after the end of a closed TLE", () => {
            let dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B')]\" }", fakeId);
            let pc = dt.getContextFromDocumentCharacterIndex(32, undefined);
            assert.deepStrictEqual(pc.tleInfo, undefined);
        });

        test("with characterIndex after the end of an unclosed TLE", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B'", fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[concat('B'".length, undefined);

            const b: TLE.StringValue = nonNullValue(TLE.asStringValue(pc.tleInfo!.tleValue));
            assert.deepStrictEqual(b.token, TLE.Token.createQuotedString(9, "'B'"));
            const concat: TLE.FunctionCallValue = nonNullValue(TLE.asFunctionCallValue(b.parent));
            assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
            assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
            assert.deepStrictEqual(concat.rightParenthesisToken, undefined);
            assert.deepStrictEqual(concat.commaTokens, []);
            assert.deepStrictEqual(concat.argumentExpressions.length, 1);

        });
    });

    suite("hoverInfo", () => {
        test("in non-string json token", () => {
            const dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B'", fakeId);
            const hoverInfo: HoverInfo | undefined = dt.getContextFromDocumentCharacterIndex(0, undefined).getHoverInfo();
            assert.deepStrictEqual(hoverInfo, undefined);
        });

        test("in property name json token", () => {
            const dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B'", fakeId);
            const hoverInfo: HoverInfo | undefined = dt.getContextFromDocumentCharacterIndex(3, undefined).getHoverInfo();
            assert.deepStrictEqual(hoverInfo, undefined);
        });
    });

    test("in unrecognized function name", () => {
        const dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[toads('B'", fakeId);
        const hoverInfo: HoverInfo | undefined = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[to".length, undefined).getHoverInfo();
        assert.deepStrictEqual(hoverInfo, undefined);
    });

    test("in recognized function name", () => {
        const dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[concat('B'", fakeId);
        const pc = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[c".length, undefined);
        const hi: HoverInfo = pc.getHoverInfo()!;
        assert(hi);
        assert.deepStrictEqual(hi.usage, "concat(arg1, arg2, arg3, ...)");
        assert.deepStrictEqual(hi.span, new Span("{ 'a': 'A', 'b': \"[".length, 6));
    });

    test("in unrecognized parameter reference", () => {
        const dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[parameters('B')]\" }", fakeId);
        const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters('".length, undefined);
        const hi: HoverInfo | undefined = pc.getHoverInfo();
        assert.deepStrictEqual(hi, undefined);
    });

    test("in recognized parameter reference name", () => {
        const dt = new DeploymentTemplateDoc("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters('pName')\" }", fakeId);
        const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters('pN".length, undefined);
        const hi: HoverInfo = pc.getHoverInfo()!;
        assert(hi);
        assert.deepStrictEqual(`**pName**${os.EOL}*(parameter)*`, hi.getHoverText());
        assert.deepStrictEqual(new Span("{ 'parameters': { 'pName': { 'type': 'integer' } }, 'a': 'A', 'b': \"[parameters('".length, 'pName'.length), hi.span);
    });

    test("in parameter reference function with empty string parameter", () => {
        const dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[parameters('')]\" }", fakeId);
        const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters('".length, undefined);
        const hi: HoverInfo | undefined = pc.getHoverInfo();
        assert.deepStrictEqual(hi, undefined);
    });

    test("in parameter reference function with no arguments", () => {
        const dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[parameters()]\" }", fakeId);
        const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[parameters(".length, undefined);
        const hi: HoverInfo | undefined = pc.getHoverInfo();
        assert.deepStrictEqual(hi, undefined);
    });

    test("in unrecognized variable reference", () => {
        const dt = new DeploymentTemplateDoc("{ 'a': 'A', 'b': \"[variables('B')]\" }", fakeId);
        const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': 'A', 'b': \"[variables('".length, undefined);
        const hi: HoverInfo | undefined = pc.getHoverInfo();
        assert.deepStrictEqual(hi, undefined);
    });

    test("in recognized variable reference name", () => {
        const dt = new DeploymentTemplateDoc("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables('vName')\" }", fakeId);
        const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables('vNam".length, undefined);
        const hi: HoverInfo | undefined = pc.getHoverInfo()!;
        assert(hi);
        assert.deepStrictEqual(`**vName**${os.EOL}*(variable)*`, hi.getHoverText());
        assert.deepStrictEqual(new Span("{ 'variables': { 'vName': 3 }, 'a': 'A', 'b': \"[variables('".length, 'vName'.length), hi.span);
    });

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
                        const { dt, markers: { bang, replstart } } = await parseTemplateWithMarkers(template);
                        // tslint:disable-next-line: strict-boolean-expressions
                        assert(!!replstart!, "Didn't find <!replstart!> in test expression");
                        const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(bang.index, undefined);

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
                    `[<!replstart!>!]`,
                    {
                        label: "add",
                        insertText: "add",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!>!param]`,
                    {
                        label: "add",
                        insertText: "add",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!>param!]`,
                    {
                        label: "parameters",
                        insertText: "parameters",
                        replaceSpanText: "param"
                    }
                );

                testCompletionItemsWithRange(
                    "Don't replace the entire function name, just what's to the left of the cursor",
                    template1,
                    `[<!replstart!>param!eters]`,
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
                    `[<!replstart!>!]`,
                    {
                        label: "udf",
                        insertText: "udf",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!>!ud]`,
                    {
                        label: "udf",
                        insertText: "udf",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[<!replstart!>ud!]`,
                    {
                        label: "udf",
                        insertText: "udf",
                        replaceSpanText: "ud"
                    }
                );

                testCompletionItemsWithRange(
                    "Don't replace the entire namespace, just what's to the left of the cursor",
                    template1,
                    `[<!replstart!>ud!f]`,
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
                    `[udf.<!replstart!>!myfunction]`,
                    {
                        label: "udf.myfunction",
                        insertText: "myfunction",
                        replaceSpanText: ""
                    }
                );

                testCompletionItemsWithRange(
                    "",
                    template1,
                    `[udf.<!replstart!>myfunction!]`,
                    {
                        label: "udf.myfunction",
                        insertText: "myfunction",
                        replaceSpanText: "myfunction"
                    }
                );

                testCompletionItemsWithRange(
                    "Don't replace the entire function name, just what's to the left of the cursor",
                    template1,
                    `[udf.<!replstart!>myf!unction]`,
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
                        `[parameters(<!replstart!>!)]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: ")"
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!>!)]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: ")"
                        }
                    );

                    testCompletionItemsWithRange(
                        "with whitespace",
                        template1,
                        `[parameters(<!replstart!>! )]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: " )"
                        }
                    );
                    testCompletionItemsWithRange(
                        "with whitespace",
                        template1,
                        `[variables(<!replstart!>! )]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: " )"
                        }
                    );

                    testCompletionItemsWithRange(
                        "with whitespace #2",
                        template1,
                        `[parameters( <!replstart!>!)]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: ")"
                        }
                    );

                    testCompletionItemsWithRange(
                        "no closing paren",
                        template1,
                        `[parameters(<!replstart!>!]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: ""
                        }
                    );
                    testCompletionItemsWithRange(
                        "no closing paren",
                        template1,
                        `[variables(<!replstart!>!]`,
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
                        `[parameters(<!replstart!>!'hi')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: ""
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!>!'hi')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name'",
                            replaceSpanText: ""
                        }
                    );

                    testCompletionItemsWithRange(
                        "with whitespace before string, cursor after whitespace",
                        template1,
                        `[parameters( <!replstart!>!'hi')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: ""
                        }
                    );

                    testCompletionItemsWithRange(
                        "no closing paren",
                        template1,
                        `[parameters(<!replstart!>!'hi']`,
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
                        `[parameters(<!replstart!>'!')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: "'')"
                        }
                    );
                    testCompletionItemsWithRange(
                        "empty string",
                        template1,
                        `[variables(<!replstart!>'!')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: "'')"
                        }
                    );

                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[parameters(<!replstart!>'!hi')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: "'hi')"
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!>'!hi')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: "'hi')"
                        }
                    );

                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[parameters(<!replstart!>'h!i')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: "'hi')"
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!>'h!i')]`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name')",
                            replaceSpanText: "'hi')"
                        }
                    );

                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[parameters(<!replstart!>'hi!')]`,
                        {
                            label: "'sku'",
                            insertText: "'sku')",
                            replaceSpanText: "'hi')"
                        }
                    );
                    testCompletionItemsWithRange(
                        "",
                        template1,
                        `[variables(<!replstart!>'hi!')]`,
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
                            `[parameters(<!replstart!>'hi!']`,
                            {
                                label: "'sku'",
                                insertText: "'sku')",
                                replaceSpanText: "'hi'"
                            }
                        );

                        testCompletionItemsWithRange(
                            "no closing quote",
                            template1,
                            `[parameters(<!replstart!>'hi!)]`,
                            {
                                label: "'sku'",
                                insertText: "'sku')",
                                replaceSpanText: "'hi)"
                            }
                        );
                        testCompletionItemsWithRange(
                            "no closing quote or paren",
                            template1,
                            `[parameters(<!replstart!>'hi!]`,
                            {
                                label: "'sku'",
                                insertText: "'sku')",
                                replaceSpanText: "'hi"
                            }
                        );
                        testCompletionItemsWithRange(
                            "no closing quote or paren",
                            template1,
                            `[variables(<!replstart!>'hi!]`,
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
                        `[parameters(<!replstart!>'hi!', 'there']`,
                        {
                            label: "'sku'",
                            insertText: "'sku'",
                            replaceSpanText: "'hi'"
                        }
                    );
                    testCompletionItemsWithRange(
                        "extra (invalid) args",
                        template1,
                        `[variables(<!replstart!>'hi!', 'there']`,
                        {
                            label: "'subnet1Name'",
                            insertText: "'subnet1Name'",
                            replaceSpanText: "'hi'"
                        }
                    );

                    testCompletionItemsWithRange(
                        "before second (invalid) arg",
                        template1,
                        `[parameters('hi', !<!replstart!>'there']`,
                        undefined
                    );

                    testCompletionItemsWithRange(
                        "in second (invalid) arg",
                        template1,
                        `[parameters('hi', '!<!replstart!>!there']`,
                        undefined
                    );
                    testCompletionItemsWithRange(
                        "in second (invalid) arg",
                        template1,
                        `[variables('hi', '!<!replstart!>!there']`,
                        undefined
                    );
                });
            });

        });
    });

    suite("signatureHelp", () => {
        test("not in a TLE", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "AA" }`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "A`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp | undefined = pc.getSignatureHelp();
            assert.deepStrictEqual(functionSignatureHelp, undefined);
        });

        test("in empty TLE", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[]" }`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp | undefined = pc.getSignatureHelp();
            assert.deepStrictEqual(functionSignatureHelp, undefined);
        });

        test("in TLE function name", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[con]" }`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[con`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp | undefined = pc.getSignatureHelp();
            assert.deepStrictEqual(functionSignatureHelp, undefined);
        });

        test("after left parenthesis", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[concat(`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat(`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 0);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("inside first parameter", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[concat('test`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('test`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 0);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("inside second parameter", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[concat('t1', 't2`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('t1', 't2`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 1);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("inside empty parameter", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[concat(,,,`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat(,,`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 2);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("in variadic parameter when function signature has '...' parameter and the current argument is greater than the parameter count", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f'`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f'`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 3);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("in variadic parameter when function signature has '...' parameter and the current argument is equal to the parameter count", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[concat('a', 'b', 'c', 'd'`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd'`.length, undefined);
            const functionSignatureHelp: TLE.FunctionSignatureHelp = pc.getSignatureHelp()!;
            assert(functionSignatureHelp);
            assert.deepStrictEqual(functionSignatureHelp.activeParameterIndex, 3);
            assert(functionSignatureHelp.functionMetadata);
            assert.deepStrictEqual(functionSignatureHelp.functionMetadata.fullName, "concat");
        });

        test("in variadic parameter when function signature has 'name...' parameter", () => {
            const dt = new DeploymentTemplateDoc(`{ "a": "[resourceId('a', 'b', 'c', 'd', 'e', 'f', 'g'`, fakeId);
            const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[concat('a', 'b', 'c', 'd', 'e', 'f', 'g'`.length, undefined);
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
            async function testUdfSignatureHelp(expressionWithBang: string, expected: TLE.FunctionSignatureHelp | undefined): Promise<void> {
                const templateString = stringify(udfTemplate).replace('<o1value>', expressionWithBang);

                const { dt, markers: { bang } } = await parseTemplateWithMarkers(templateString);
                assert(bang, "You must place a bang ('!') in the expression string to indicate position");
                const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(bang.index, undefined);
                const functionSignatureHelp: TLE.FunctionSignatureHelp | undefined = pc.getSignatureHelp();
                assert.deepStrictEqual(functionSignatureHelp, expected);
            }

            test("in UDF function name", async () => {
                await testUdfSignatureHelp("udf.!con", undefined);
            });

            test("in UDF namespace name", async () => {
                await testUdfSignatureHelp("u!df.con", undefined);
            });

            test("in UDF call's period", async () => {
                await testUdfSignatureHelp("udf!.con", undefined);
            });

            test("after UDF left parenthesis, with same name as built-in function and UDF function not defined", async () => {
                await testUdfSignatureHelp("udf.add(!", undefined);
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
                                { name: "p2", "type": undefined }
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
                            undefined,
                            [])
                    ));
            });

            test("namespace but no function name", async () => {
                await testUdfSignatureHelp("udf.!", undefined);
            });
        });
    });

    suite("parameterDefinition", () => {
        async function getParameterDefinitionIfAtReference(pc: TemplatePositionContext): Promise<IParameterDefinition | undefined> {
            const refInfo: IReferenceSite | undefined = pc.getReferenceSiteInfo(false);
            if (refInfo && refInfo.definition.definitionKind === "Parameter") {
                return <IParameterDefinition>refInfo.definition;
            }

            return undefined;
        }

        test("with no parameters property", async () => {
            const dt = new DeploymentTemplateDoc("{ 'a': '[parameters(\"pName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': '[parameters(\"pN".length, undefined);
            assert.deepStrictEqual(await getParameterDefinitionIfAtReference(context), undefined);
        });

        test("with empty parameters property value", async () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': {}, 'a': '[parameters(\"pName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': {}, 'a': '[parameters(\"pN".length, undefined);
            assert.deepStrictEqual(await getParameterDefinitionIfAtReference(context), undefined);
        });

        test("with matching parameter definition", async () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pNa".length, undefined);
            const parameterDefinition: IParameterDefinition = nonNullValue(await getParameterDefinitionIfAtReference(context));
            assert.deepStrictEqual(parameterDefinition.nameValue.toString(), "pName");
            assert.deepStrictEqual(parameterDefinition.description, undefined);
            assert.deepStrictEqual(parameterDefinition.fullSpan, new Span(18, 11));
        });

        test("with cursor before parameter name start quote with matching parameter definition", async () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(".length, undefined);
            const parameterDefinition: IParameterDefinition = nonNullValue(await getParameterDefinitionIfAtReference(context));
            assert.deepStrictEqual(parameterDefinition.nameValue.toString(), "pName");
            assert.deepStrictEqual(parameterDefinition.description, undefined);
            assert.deepStrictEqual(parameterDefinition.fullSpan, new Span(18, 11));
        });

        test("with cursor after parameter name end quote with matching parameter definition", async () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\"".length, undefined);
            const parameterDefinition: IParameterDefinition = nonNullValue(await getParameterDefinitionIfAtReference(context));
            assert.deepStrictEqual(parameterDefinition.nameValue.toString(), "pName");
            assert.deepStrictEqual(parameterDefinition.description, undefined);
            assert.deepStrictEqual(parameterDefinition.fullSpan, new Span(18, 11));
        });
    });

    suite("variableDefinition", () => {
        function getVariableDefinitionIfAtReference(pc: TemplatePositionContext): IVariableDefinition | undefined {
            const refInfo: IReferenceSite | undefined = pc.getReferenceSiteInfo(false);
            if (refInfo && isVariableDefinition(refInfo.definition)) {
                return refInfo.definition;
            }

            return undefined;
        }

        test("with no variables property", () => {
            const dt = new DeploymentTemplateDoc("{ 'a': '[variables(\"vName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'a': '[variables(\"vN".length, undefined);
            assert.deepStrictEqual(getVariableDefinitionIfAtReference(context), undefined);
        });

        test("with empty variables property value", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': {}, 'a': '[variables(\"vName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': {}, 'a': '[variables(\"vN".length, undefined);
            assert.deepStrictEqual(getVariableDefinitionIfAtReference(context), undefined);
        });

        test("with matching variable definition", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vNa".length, undefined);
            const vDef: IVariableDefinition = nonNullValue(getVariableDefinitionIfAtReference(context));
            assert.deepStrictEqual(vDef.nameValue.toString(), "vName");
            assert.deepStrictEqual(vDef.span, new Span(17, 11));
        });

        test("with cursor before variable name start quote with matching variable definition", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(".length, undefined);
            const vDef: IVariableDefinition = nonNullValue(getVariableDefinitionIfAtReference(context));
            assert.deepStrictEqual(vDef.nameValue.toString(), "vName");
            assert.deepStrictEqual(vDef.span, new Span(17, 11));
        });

        test("with cursor after parameter name end quote with matching parameter definition", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\"".length, undefined);
            const vDef: IVariableDefinition = nonNullValue(getVariableDefinitionIfAtReference(context));
            assert.deepStrictEqual(vDef.nameValue.toString(), "vName");
            assert.deepStrictEqual(vDef.span, new Span(17, 11));
        });
    });

    suite("getReferenceSiteInfo", () => {
        const template1: IDeploymentTemplate = {
            $schema: "whatever",
            contentVersion: "whoever",
            resources: [],
            parameters: {
                "<!param1def!>parameter1": {
                    type: "string"
                }
            },
            variables: {
                "<!var1def!>variable1": "who there"
            },
            outputs: {
                o1: {
                    type: "int",
                    value: "[<!builtinref!>add(parameters('p<!param1ref!>arameter1'),variables('v<!var1ref!>ariable1'))]"
                },
                o2: {
                    type: "string",
                    value: "[n<!ns1ref!>s1.<!func1ref!>func1()]"
                }
            },
            functions: [
                {
                    namespace: "ns<!ns1def!>1",
                    members: {
                        "func<!func1def!>1": {
                        }
                    }
                }
            ]
        };

        const params1 = {
            parameters: {
                "<!param1def!>parameter1": {
                    type: "string",
                    value: "hi"
                }
            }
        };

        suite("Templates", () => {
            test("Parameter reference", async () => {
                const { dt, markers: { param1ref } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, param1ref.index, undefined);
                const site = pc.getReferenceSiteInfo(false);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"parameter1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.reference);
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'parameter1');
            });

            test("Parameter definition", async () => {
                const { dt, markers: { param1def } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, param1def.index, undefined);
                const site = pc.getReferenceSiteInfo(true);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"parameter1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.definition);
                assert.equal(JSON.stringify(site?.unquotedReferenceSpan), JSON.stringify(site?.definition.nameValue?.unquotedSpan));
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'parameter1');
            });

            test("Variable reference", async () => {
                const { dt, markers: { var1ref } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, var1ref.index, undefined);
                const site = pc.getReferenceSiteInfo(false);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"variable1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.reference);
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'variable1');
            });

            test("Variable definition", async () => {
                const { dt, markers: { var1def } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, var1def.index, undefined);
                const site = pc.getReferenceSiteInfo(true);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"variable1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.definition);
                assert.equal(JSON.stringify(site?.unquotedReferenceSpan), JSON.stringify(site?.definition.nameValue?.unquotedSpan));
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'variable1');
            });

            test("namespace definition", async () => {
                const { dt, markers: { ns1def } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, ns1def.index, undefined);
                const site = pc.getReferenceSiteInfo(true);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"ns1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.definition);
                assert.equal(JSON.stringify(site?.unquotedReferenceSpan), JSON.stringify(site?.definition.nameValue?.unquotedSpan));
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'ns1');
            });

            test("namespace reference", async () => {
                const { dt, markers: { ns1ref } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, ns1ref.index, undefined);
                const site = pc.getReferenceSiteInfo(true);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"ns1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.reference);
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'ns1');
            });

            test("user function definition", async () => {
                const { dt, markers: { func1def } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, func1def.index, undefined);
                const site = pc.getReferenceSiteInfo(true);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"func1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.definition);
                assert.equal(JSON.stringify(site?.unquotedReferenceSpan), JSON.stringify(site?.definition.nameValue?.unquotedSpan));
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'func1');
            });

            test("user function reference", async () => {
                const { dt, markers: { func1ref } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, func1ref.index, undefined);
                const site = pc.getReferenceSiteInfo(true);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"func1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.reference);
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'func1');
            });

            test("built-in function reference", async () => {
                const { dt, markers: { builtinref } } = await parseTemplateWithMarkers(template1);
                const pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, builtinref.index, undefined);
                const site = pc.getReferenceSiteInfo(true);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue, undefined);
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dt);
                assert.equal(site?.referenceKind, ReferenceSiteKind.reference);
                assert.equal(site?.unquotedReferenceSpan.getText(dt.documentText), 'add');
            });
        });

        suite("Parameter files", () => {
            test("Deployment parameter file parameter definition", async () => {
                const { dt } = await parseTemplateWithMarkers(template1);
                const { dp, markers: { param1def } } = await parseParametersWithMarkers(params1);
                const ppc = ParametersPositionContext.fromDocumentCharacterIndex(dp, param1def.index, dt);
                const site = ppc.getReferenceSiteInfo(true);
                assert.notEqual(site, undefined);
                assert.equal(site?.definition.nameValue?.quotedValue, '"parameter1"');
                assert.equal(site?.definitionDocument, dt);
                assert.equal(site?.referenceDocument, dp);
                assert.equal(site?.referenceKind, ReferenceSiteKind.reference);
                assert.equal(site?.unquotedReferenceSpan.getText(site.referenceDocument.documentText), 'parameter1');
            });
        });
    });
});
