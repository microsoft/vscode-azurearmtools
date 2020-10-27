// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length cyclomatic-complexity promise-function-async align max-line-length max-line-length no-undefined-keyword
// tslint:disable:no-non-null-assertion object-literal-key-quotes

import * as assert from "assert";
import * as os from 'os';
import { Uri } from "vscode";
import { DeploymentTemplateDoc, FunctionSignatureHelp, HoverInfo, IParameterDefinition, IReferenceSite, Issue, IssueKind, isVariableDefinition, IVariableDefinition, Json, LineColPos, nonNullValue, ParametersPositionContext, ReferenceSiteKind, Span, TemplatePositionContext, TLE, UserFunctionMetadata } from "../extension.bundle";
import * as jsonTest from "./JSON.test";
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseParametersWithMarkers, parseTemplate, parseTemplateWithMarkers } from "./support/parseTemplate";
import { stringify } from "./support/stringify";

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
            let pc = TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, 1, 0, undefined);
            assert.strictEqual(0, pc.documentLineIndex);
            assert.strictEqual(0, pc.documentColumnIndex);
            assert.strictEqual(0, pc.documentCharacterIndex);
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
            let pc = TemplatePositionContext.fromDocumentLineAndColumnIndexes(dt, 0, 3, undefined);
            assert.strictEqual(0, pc.documentLineIndex);
            assert.strictEqual(2, pc.documentColumnIndex);
            assert.strictEqual(2, pc.documentCharacterIndex);
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
            let pc = TemplatePositionContext.fromDocumentCharacterIndex(dt, 3, undefined);
            assert.strictEqual(0, pc.documentLineIndex);
            assert.strictEqual(2, pc.documentColumnIndex);
            assert.strictEqual(2, pc.documentCharacterIndex);
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
            const dt = await parseTemplate("{ arm-keyvault!hello }");

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
            const parseResult = TLE.Parser.parse("'a'");
            assert.deepStrictEqual(parseResult, pc.tleInfo!.tleParseResult);
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

            // A <!cursor!> in the expression marks the position to test at
            async function testUdfSignatureHelp(expressionWithCursorMarker: string, expected: TLE.FunctionSignatureHelp | undefined): Promise<void> {
                const templateString = stringify(udfTemplate).replace('<o1value>', expressionWithCursorMarker);

                const { dt, markers: { cursor } } = await parseTemplateWithMarkers(templateString);
                assert(cursor, "You must place a '<!cursor!>' cursor in the expression string to indicate position");
                const pc: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(cursor.index, undefined);
                const functionSignatureHelp: TLE.FunctionSignatureHelp | undefined = pc.getSignatureHelp();
                assert.deepStrictEqual(functionSignatureHelp, expected);
            }

            test("in UDF function name", async () => {
                await testUdfSignatureHelp("udf.<!cursor!>con", undefined);
            });

            test("in UDF namespace name", async () => {
                await testUdfSignatureHelp("u<!cursor!>df.con", undefined);
            });

            test("in UDF call's period", async () => {
                await testUdfSignatureHelp("udf<!cursor!>.con", undefined);
            });

            test("after UDF left parenthesis, with same name as built-in function and UDF function not defined", async () => {
                await testUdfSignatureHelp("udf.add(<!cursor!>", undefined);
            });

            test("after UDF left parenthesis, with same name as built-in function, udf exists", async () => {
                await testUdfSignatureHelp("udf.concat(<!cursor!>",
                    new FunctionSignatureHelp(0, expectedUdfConcatMetadata));
            });

            test("inside first parameter", async () => {
                await testUdfSignatureHelp("udf.concat('hello<!cursor!>', 'there')",
                    new FunctionSignatureHelp(0, expectedUdfConcatMetadata));
            });

            test("inside second parameter", async () => {
                await testUdfSignatureHelp("udf.concat('hello', 'th<!cursor!>ere')",
                    new FunctionSignatureHelp(1, expectedUdfConcatMetadata));
            });

            test("no params", async () => {
                await testUdfSignatureHelp("udf.random(<!cursor!>)",
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
                await testUdfSignatureHelp("udf.double(12<!cursor!>345) [int]",
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
                await testUdfSignatureHelp("udf.mysterious(12<!cursor!>345, 2)",
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
                await testUdfSignatureHelp("udf.badreturn(<!cursor!>)",
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
                await testUdfSignatureHelp("udf.<!cursor!>", undefined);
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

        test("with cursor inside 'parameters'", async () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'pName': {} }, 'a': '[parameters(\"pName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'parameters': { 'pName': {} }, 'a': '[paramet".length, undefined);
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

        test("with cursor after variable name end quote with matching variable  definition", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\"".length, undefined);
            const vDef: IVariableDefinition = nonNullValue(getVariableDefinitionIfAtReference(context));
            assert.deepStrictEqual(vDef.nameValue.toString(), "vName");
            assert.deepStrictEqual(vDef.span, new Span(17, 11));
        });

        test("with cursor inside 'variables'", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'vName': {} }, 'a': '[variables(\"vName\")]' }", fakeId);
            const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex("{ 'variables': { 'vName': {} }, 'a': '[v".length, undefined);
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
