// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression

import * as assert from "assert";

import * as Json from "../src/JSON";
import * as language from "../src/Language";
import * as Reference from "../src/Reference";
import * as TLE from "../src/TLE";

import { AzureRMAssets, FunctionMetadata, FunctionsMetadata } from "../src/AzureRMAssets";
import { DeploymentTemplate } from "../src/DeploymentTemplate";
import { PositionContext } from "../src/PositionContext";

suite("TLE", () => {
    suite("StringValue", () => {
        suite("constructor(tle.Token)", () => {
            test("with null token", () => {
                assert.throws(() => { new TLE.StringValue(null); });
            });

            test("with undefined token", () => {
                assert.throws(() => { new TLE.StringValue(undefined); });
            });
        });

        suite("contains(number)", () => {
            test("with character index less than start index", () => {
                const value: TLE.StringValue = new TLE.StringValue(TLE.Token.createQuotedString(5, "'hello'"));
                assert(!value.contains(4));
            });

            test("with character index equal to start index", () => {
                const value: TLE.StringValue = new TLE.StringValue(TLE.Token.createQuotedString(5, "'hello'"));
                assert(value.contains(5));
            });

            test("with character index inside value", () => {
                const value: TLE.StringValue = new TLE.StringValue(TLE.Token.createQuotedString(5, "'hello'"));
                assert(value.contains(7));
            });

            test("with character index equal to after end index with closing quote", () => {
                const value: TLE.StringValue = new TLE.StringValue(TLE.Token.createQuotedString(5, "'hello'"));
                assert(value.contains(12));
            });

            test("with character index equal to after end index without closing quote", () => {
                const value: TLE.StringValue = new TLE.StringValue(TLE.Token.createQuotedString(5, "'hello"));
                assert(value.contains(11));
            });

            test("with character index past after end index with closing quote", () => {
                const value: TLE.StringValue = new TLE.StringValue(TLE.Token.createQuotedString(5, "'hello'"));
                assert(!value.contains(13));
            });

            test("with character index past after end index without closing quote", () => {
                const value: TLE.StringValue = new TLE.StringValue(TLE.Token.createQuotedString(5, "'hello"));
                assert(!value.contains(13));
            });
        });
    });

    suite("NumberValue", () => {
        suite("contains(number)", () => {
            test("with character index less than start index", () => {
                const value: TLE.NumberValue = new TLE.NumberValue(TLE.Token.createNumber(3, "1"));
                assert(!value.contains(0));
            });

            test("with character index equal to start index", () => {
                const value: TLE.NumberValue = new TLE.NumberValue(TLE.Token.createNumber(3, "17"));
                assert(value.contains(3));
            });

            test("with character index inside value", () => {
                const value: TLE.NumberValue = new TLE.NumberValue(TLE.Token.createNumber(3, "1235235"));
                assert(value.contains(7));
            });

            test("with character index after end index", () => {
                const value: TLE.NumberValue = new TLE.NumberValue(TLE.Token.createNumber(3, "1237"));
                assert(value.contains(7));
            });

            test("with character index after end index", () => {
                const value: TLE.NumberValue = new TLE.NumberValue(TLE.Token.createNumber(3, "1237"));
                assert(value.contains(7));
            });
        });
    });

    suite("ArrayAccess", () => {
        suite("constructor(tle.Value,tle.Token,tle.Value,tle.Token)", () => {
            test("with null _source", () => {
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                assert.throws(() => { new TLE.ArrayAccessValue(null, leftSquareBracket, index, rightSquareBracket); });
            });

            test("with undefined _source", () => {
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                assert.throws(() => { new TLE.ArrayAccessValue(undefined, leftSquareBracket, index, rightSquareBracket); });
            });

            test("with null _leftSquareBracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                assert.throws(() => { new TLE.ArrayAccessValue(source, null, index, rightSquareBracket); });
            });

            test("with undefined _leftSquareBracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                assert.throws(() => { new TLE.ArrayAccessValue(source, undefined, index, rightSquareBracket); });
            });

            test("with null _index", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, null, rightSquareBracket);
                assert.deepStrictEqual(source, arrayAccess.source);
                assert.deepStrictEqual(leftSquareBracket, arrayAccess.leftSquareBracketToken);
                assert.deepStrictEqual(null, arrayAccess.index);
                assert.deepStrictEqual(rightSquareBracket, arrayAccess.rightSquareBracketToken);
            });

            test("with undefined _index", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                assert.throws(() => { new TLE.ArrayAccessValue(source, leftSquareBracket, undefined, rightSquareBracket); });
            });

            test("with null _rightSquareBracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, null);
                assert.deepStrictEqual(source, arrayAccess.source);
                assert.deepStrictEqual(leftSquareBracket, arrayAccess.leftSquareBracketToken);
                assert.deepStrictEqual(index, arrayAccess.index);
                assert.deepStrictEqual(null, arrayAccess.rightSquareBracketToken);
            });

            test("with undefined _rightSquareBracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                assert.throws(() => { new TLE.ArrayAccessValue(source, leftSquareBracket, index, undefined); });
            });
        });

        suite("getSpan()", () => {
            test("with no index or right square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, null, null);
                assert.deepStrictEqual(new language.Span(5, 2), arrayAccess.getSpan());
            });

            test("with whitespace between source and left square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(8);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, null, null);
                assert.deepStrictEqual(new language.Span(5, 4), arrayAccess.getSpan());
            });

            test("with no right square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(8);
                let index = new TLE.NumberValue(TLE.Token.createNumber(10, "10"));
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, null);
                assert.deepStrictEqual(new language.Span(5, 7), arrayAccess.getSpan());
            });

            test("with no index", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(8);
                let rightSquareBracket = TLE.Token.createRightSquareBracket(12);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, null, rightSquareBracket);
                assert.deepStrictEqual(new language.Span(5, 8), arrayAccess.getSpan());
            });

            test("with complete array access", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(8);
                let index = new TLE.NumberValue(TLE.Token.createNumber(10, "10"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(12);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, rightSquareBracket);
                assert.deepStrictEqual(new language.Span(5, 8), arrayAccess.getSpan());
            });
        });

        suite("toString()", () => {
            test("with no index or right square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(10);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, null, null);
                assert.deepStrictEqual("2[", arrayAccess.toString());
            });

            test("with no right square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(10);
                let index = new TLE.StringValue(TLE.Token.createQuotedString(20, "'hello'"));
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, null);
                assert.deepStrictEqual("2['hello'", arrayAccess.toString());
            });

            test("with no index", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(10);
                let rightSquareBracket = TLE.Token.createRightSquareBracket(30);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, null, rightSquareBracket);
                assert.deepStrictEqual("2[]", arrayAccess.toString());
            });

            test("with a complete array access", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(10);
                let index = new TLE.StringValue(TLE.Token.createQuotedString(20, "'hello'"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(30);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, rightSquareBracket);
                assert.deepStrictEqual("2['hello']", arrayAccess.toString());
            });
        });
    });

    suite("Function", () => {
        suite("constructor(tle.Token,tle.Token,tle.Value[],tle.Token)", () => {
            test("with null nameToken", () => {
                let leftParenthesis = TLE.Token.createLeftParenthesis(5);
                let commaTokens = [];
                let args = [];
                let rightParenthesis = TLE.Token.createRightParenthesis(10);
                assert.throws(() => { new TLE.FunctionValue(null, leftParenthesis, commaTokens, args, rightParenthesis); });
            });

            test("with null _leftParenthesisToken", () => {
                let name = TLE.Token.createLiteral(1, "test");
                let commaTokens = [];
                let args = [];
                let rightParenthesis = TLE.Token.createRightParenthesis(10);

                let f = new TLE.FunctionValue(name, null, commaTokens, args, rightParenthesis);

                assert.deepStrictEqual(name, f.nameToken);
                assert.deepStrictEqual(null, f.leftParenthesisToken);
                assert.deepStrictEqual(args, f.argumentExpressions);
                assert.deepStrictEqual(rightParenthesis, f.rightParenthesisToken);
            });

            test("with null _argumentExpressions", () => {
                let name = TLE.Token.createLiteral(1, "test");
                let commaTokens = [];
                let leftParenthesis = TLE.Token.createLeftParenthesis(5);
                let rightParenthesis = TLE.Token.createRightParenthesis(10);

                assert.throws(() => { new TLE.FunctionValue(name, leftParenthesis, commaTokens, null, rightParenthesis); });
            });

            test("with null _rightParenthesisToken", () => {
                let name = TLE.Token.createLiteral(1, "test");
                let commaTokens = [];
                let leftParenthesis = TLE.Token.createLeftParenthesis(5);
                let args = [];

                let f = new TLE.FunctionValue(name, leftParenthesis, commaTokens, args, null);

                assert.deepStrictEqual(name, f.nameToken);
                assert.deepStrictEqual(leftParenthesis, f.leftParenthesisToken);
                assert.deepStrictEqual(args, f.argumentExpressions);
                assert.deepStrictEqual(null, f.rightParenthesisToken);
            });
        });

        suite("getSpan()", () => {
            test("with name", () => {
                let f = TLE.Parser.parse("\"[concat]\"").expression;
                assert(f instanceof TLE.FunctionValue);
                assert.deepStrictEqual(new language.Span(2, 6), f.getSpan());
            });

            test("with left parenthesis", () => {
                let f = TLE.Parser.parse("\"[concat(]\"").expression;
                assert(f instanceof TLE.FunctionValue);
                assert.deepStrictEqual(new language.Span(2, 7), f.getSpan());
            });

            test("with one argument and no right parenthesis", () => {
                let f = TLE.Parser.parse("\"[concat(70").expression;
                assert(f instanceof TLE.FunctionValue);
                assert.deepStrictEqual(new language.Span(2, 9), f.getSpan());
            });

            test("with two arguments and no right parenthesis", () => {
                let f = TLE.Parser.parse("\"[concat(70, 3").expression;
                assert(f instanceof TLE.FunctionValue);
                assert.deepStrictEqual(new language.Span(2, 12), f.getSpan());
            });

            test("with left and right parenthesis and no arguments", () => {
                let f = TLE.Parser.parse("\"[concat()\"").expression;
                assert(f instanceof TLE.FunctionValue);
                assert.deepStrictEqual(new language.Span(2, 8), f.getSpan());
            });

            test("with left and right parenthesis and arguments", () => {
                let f = TLE.Parser.parse("\"[concat('hello', 'world')\"").expression;
                assert(f instanceof TLE.FunctionValue);
                assert.deepStrictEqual(new language.Span(2, 24), f.getSpan());
            });

            test("with last argument missing and no right parenthesis", () => {
                let f = TLE.Parser.parse("\"[concat('hello',").expression;
                assert(f instanceof TLE.FunctionValue);
                assert.deepStrictEqual(new language.Span(2, 15), f.getSpan());
            });
        });
    });

    suite("BraceHighlighter", () => {
        function getHighlights(template: DeploymentTemplate, documentCharacterIndex: number): number[] {
            const context = template.getContextFromDocumentCharacterIndex(documentCharacterIndex);
            return TLE.BraceHighlighter.getHighlightCharacterIndexes(context);
        }

        suite("getHighlightCharacterIndexes(number,TLEParseResult)", () => {
            test("with quoted string that isn't a TLE", () => {
                let template = new DeploymentTemplate("\"Hello world\"", "id");
                assert.deepStrictEqual([], getHighlights(template, 0));
                assert.deepStrictEqual([], getHighlights(template, 5));
                assert.deepStrictEqual([], getHighlights(template, 11));
            });

            test("with left square bracket", () => {
                let template = new DeploymentTemplate("\"[", "id");
                assert.deepStrictEqual([], getHighlights(template, 0));
                assert.deepStrictEqual([1], getHighlights(template, 1));
                assert.deepStrictEqual([], getHighlights(template, 2));
            });

            test("with empty TLE", () => {
                let template = new DeploymentTemplate("\"[]\"", "id");
                assert.deepStrictEqual([1, 2], getHighlights(template, 1), "When the caret is before a TLE's left square bracket, then the left and right square brackets should be highlighted.");
                assert.deepStrictEqual([], getHighlights(template, 2), "When the caret is to the right of a TLE's left square bracket and to the left of the right square bracket, nothing should be highlighted.");
                assert.deepStrictEqual([1, 2], getHighlights(template, 3), "When the caret is after a TLE's right square bracket, then the left and right square brackets should be highlighted.");
            });

            test("with function with no parenthesis", () => {
                let template = new DeploymentTemplate("\"[concat", "id");
                assert.deepStrictEqual([], getHighlights(template, 8));
            });

            test("with function with left parenthesis but no right parenthesis", () => {
                let template = new DeploymentTemplate("\"[concat(", "id");
                assert.deepStrictEqual([8], getHighlights(template, 8));
            });

            test("with function with left and right parenthesis", () => {
                let template = new DeploymentTemplate("\"[concat()", "id");
                assert.deepStrictEqual([8, 9], getHighlights(template, "\"[concat".length), "Both left and right parentheses should be highlighted when the caret is before the left parenthesis.");
                assert.deepStrictEqual([], getHighlights(template, 9));
                assert.deepStrictEqual([8, 9], getHighlights(template, "\"[concat()".length), "Both left and right parentheses should be highlighted when the caret is after the right parenthesis.");
            });
        });
    });

    suite("UndefinedParameterAndVariableVisitor", () => {
        suite("constructor(DeploymentTemplate)", () => {
            test("with null", () => {
                assert.throws(() => { new TLE.UndefinedParameterAndVariableVisitor(null); });
            });

            test("with undefined", () => {
                assert.throws(() => { new TLE.UndefinedParameterAndVariableVisitor(undefined); });
            });

            test("with deployment template", () => {
                const dt = new DeploymentTemplate("\"{}\"", "id");
                const visitor = new TLE.UndefinedParameterAndVariableVisitor(dt);
                assert.deepStrictEqual(visitor.errors, []);
            });
        });

        suite("visitString(StringValue)", () => {
            test("with null", () => {
                const dt = new DeploymentTemplate("\"{}\"", "id");
                const visitor = new TLE.UndefinedParameterAndVariableVisitor(dt);
                assert.throws(() => { visitor.visitString(null); });
            });

            test("with undefined", () => {
                const dt = new DeploymentTemplate("\"{}\"", "id");
                const visitor = new TLE.UndefinedParameterAndVariableVisitor(dt);
                assert.throws(() => { visitor.visitString(undefined); });
            });

            test("with empty StringValue in parameters() function", () => {
                const dt = new DeploymentTemplate("\"{}\"", "id");
                const visitor = new TLE.UndefinedParameterAndVariableVisitor(dt);

                const stringValue = new TLE.StringValue(TLE.Token.createQuotedString(17, "''"));
                stringValue.parent = new TLE.FunctionValue(
                    TLE.Token.createLiteral(3, "parameters"),
                    null,
                    [],
                    [stringValue],
                    null);

                visitor.visitString(stringValue);
                assert.deepStrictEqual(
                    visitor.errors,
                    [
                        new language.Issue(new language.Span(17, 2), "Undefined parameter reference: ''")
                    ]
                );
            });

            test("with empty StringValue in variables() function", () => {
                const dt = new DeploymentTemplate("\"{}\"", "id");
                const visitor = new TLE.UndefinedParameterAndVariableVisitor(dt);

                const stringValue = new TLE.StringValue(TLE.Token.createQuotedString(17, "''"));
                stringValue.parent = new TLE.FunctionValue(
                    TLE.Token.createLiteral(3, "variables"),
                    null,
                    [],
                    [stringValue],
                    null);

                visitor.visitString(stringValue);
                assert.deepStrictEqual(
                    visitor.errors,
                    [
                        new language.Issue(new language.Span(17, 2), "Undefined variable reference: ''")
                    ]
                );
            });
        });
    });

    suite("Parser", () => {
        suite("parse(string)", () => {
            test("with null stringValue", () => {
                assert.throws(() => { TLE.Parser.parse(null); });
            });

            test("with empty stringValue", () => {
                assert.throws(() => { TLE.Parser.parse(""); });
            });

            test("with non-empty non-quoted stringValue", () => {
                assert.throws(() => { TLE.Parser.parse("hello"); });
            });

            test("with single double-quote character", () => {
                let pr = TLE.Parser.parse("\"");
                assert.notEqual(null, pr);
                assert.equal(null, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"")),
                    pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with empty quoted string", () => {
                let pr = TLE.Parser.parse("\"\"");
                assert.notEqual(null, pr);
                assert.equal(null, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"\"")),
                    pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with non-empty quoted string", () => {
                let pr = TLE.Parser.parse("\"hello\"");
                assert.notEqual(null, pr);
                assert.equal(null, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"hello\"")),
                    pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with left square bracket (but no right square bracket)", () => {
                let pr = TLE.Parser.parse("\"[\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.equal(null, pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(2, 1), "Expected a right square bracket (']')."),
                        new language.Issue(new language.Span(1, 1), "Expected a function or property expression.")
                    ],
                    pr.errors);
            });

            test("with two left square brackets", () => {
                let pr = TLE.Parser.parse("\"[[\"");
                assert.notEqual(null, pr);
                assert.equal(null, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"[[\"")),
                    pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with two left square brackets and a right square bracket", () => {
                let pr = TLE.Parser.parse("\"[[]\"");
                assert.notEqual(null, pr);
                assert.equal(null, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"[[]\"")),
                    pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with two left square brackets and a literal", () => {
                let pr = TLE.Parser.parse("\"[[hello\"");
                assert.notEqual(null, pr);
                assert.equal(null, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"[[hello\"")),
                    pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with left and right square brackets", () => {
                let pr = TLE.Parser.parse("\"[]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.equal(null, pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(2), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new language.Issue(new language.Span(1, 2), "Expected a function or property expression.")],
                    pr.errors);
            });

            test("with left and right square brackets after whitespace", () => {
                let pr = TLE.Parser.parse("\"  []\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(3), pr.leftSquareBracketToken);
                assert.equal(null, pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(4), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new language.Issue(new language.Span(3, 2), "Expected a function or property expression.")],
                    pr.errors);
            });

            test("with left and right square brackets with whitespace between them", () => {
                let pr = TLE.Parser.parse("\"[    ]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(null, pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(6), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new language.Issue(new language.Span(1, 6), "Expected a function or property expression.")],
                    pr.errors);
            });

            test("with right square bracket", () => {
                let pr = TLE.Parser.parse("\"]\"");
                assert.notEqual(null, pr);
                assert.equal(null, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"]\"")),
                    pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with function name without parentheses, arguments, or right square bracket", () => {
                let pr = TLE.Parser.parse("\"[concat\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(new TLE.FunctionValue(TLE.Token.createLiteral(2, "concat"), null, [], [], null), pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(2, 6), "Missing function argument list."),
                        new language.Issue(new language.Span(8, 1), "Expected a right square bracket (']').")
                    ],
                    pr.errors);
            });

            test("with function name without parentheses or arguments", () => {
                let pr = TLE.Parser.parse("\"[concat]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(new TLE.FunctionValue(TLE.Token.createLiteral(2, "concat"), null, [], [], null), pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(8), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new language.Issue(new language.Span(2, 6), "Missing function argument list.")],
                    pr.errors);
            });

            test("with function name and left parenthesis without right square bracket", () => {
                let pr = TLE.Parser.parse("\"[concat (\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(9),
                        [],
                        [],
                        null),
                    pr.expression);
                assert.equal(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(9, 1), "Expected a right parenthesis (')')."),
                        new language.Issue(new language.Span(10, 1), "Expected a right square bracket (']').")
                    ],
                    pr.errors);
            });

            test("with function name and left parenthesis", () => {
                let pr = TLE.Parser.parse("\"[concat (]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(9),
                        [],
                        [],
                        null),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(10), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new language.Issue(new language.Span(10, 1), "Expected a right parenthesis (')').")],
                    pr.errors);
            });

            test("with function name and right parenthesis", () => {
                let pr = TLE.Parser.parse("\"[concat)]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "concat"),
                        null,
                        [],
                        [],
                        null),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(9), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(8, 1), "Expected the end of the string."),
                        new language.Issue(new language.Span(2, 6), "Missing function argument list."),
                    ],
                    pr.errors);
            });

            test("with function with no arguments", () => {
                let pr = TLE.Parser.parse("\" [ concat (    )  ]  \"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(2), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(4, "concat"),
                        TLE.Token.createLeftParenthesis(11),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(16)),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(19), pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with function with one number argument", () => {
                let pr = TLE.Parser.parse("\"[concat(12)]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(12), pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(11));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);

                const arg1: TLE.NumberValue = TLE.asNumberValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createNumber(9, "12"));
            });

            test("with function with no closing double quote or right square bracket", () => {
                let pr = TLE.Parser.parse("\"[concat()");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(8),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(9)),
                    pr.expression);
                assert.deepStrictEqual(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(9, 1), "Expected a right square bracket (']').")
                    ],
                    pr.errors);
            });

            test("with function with no closing right square bracket", () => {
                let pr = TLE.Parser.parse("\"[concat()\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(8),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(9)),
                    pr.expression);
                assert.deepStrictEqual(null, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(10, 1), "Expected a right square bracket (']').")
                    ],
                    pr.errors);
            });

            test("with function with one string argument", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat('test')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(16));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(15));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'test'"));
            });

            test("with function with one string argument with square brackets", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat('test[]')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(18));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(17));
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'test[]'"));
            });

            test("with function with one string argument and a comma", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat('test',)]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(17));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(16, 1), "Expected a constant string, function, or property expression.")
                    ]);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(
                    concat.commaTokens,
                    [
                        TLE.Token.createComma(15)
                    ]);
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(concat.argumentExpressions.length, 2);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'test'"));
                const arg2: TLE.Value = concat.argumentExpressions[1];
                assert.deepStrictEqual(arg2, null);
            });

            test("with function with missing first argument and string second argument", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat(,'test')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(17));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(9, 1), "Expected a constant string, function, or property expression.")
                    ]);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(
                    concat.commaTokens,
                    [
                        TLE.Token.createComma(9)
                    ]);
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(concat.argumentExpressions.length, 2);
                const arg1: TLE.Value = concat.argumentExpressions[0];
                assert.deepStrictEqual(arg1, null);
                const arg2: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[1]);
                assert(arg2);
                assert.deepStrictEqual(arg2.parent, concat);
                assert.deepStrictEqual(arg2.token, TLE.Token.createQuotedString(10, "'test'"));
            });

            test("with function with one missing argument and no right parenthesis", () => {
                let pr = TLE.Parser.parse("\"[concat('a1',");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, null);
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(13, 1), "Expected a constant string, function, or property expression."),
                        new language.Issue(new language.Span(13, 1), "Expected a right square bracket (']').")
                    ]);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(
                    concat.commaTokens,
                    [
                        TLE.Token.createComma(13)
                    ]);
                assert.deepStrictEqual(concat.rightParenthesisToken, null);
                assert.deepStrictEqual(concat.argumentExpressions.length, 2);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'a1'"));
                const arg2: TLE.Value = concat.argumentExpressions[1];
                assert.deepStrictEqual(arg2, null);
            });

            test("with function with three missing arguments", () => {
                let pr = TLE.Parser.parse("\"[concat(,,)]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(8),
                        [TLE.Token.createComma(9), TLE.Token.createComma(10)],
                        [
                            null,
                            null,
                            null
                        ],
                        TLE.Token.createRightParenthesis(11)),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(12), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(9, 1), "Expected a constant string, function, or property expression."),
                        new language.Issue(new language.Span(10, 1), "Expected a constant string, function, or property expression."),
                        new language.Issue(new language.Span(11, 1), "Expected a constant string, function, or property expression.")
                    ],
                    pr.errors);
            });

            test("with function with two arguments", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat('a', 'b')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(18));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(17));
                assert.deepStrictEqual(
                    concat.commaTokens,
                    [
                        TLE.Token.createComma(12)
                    ]);
                assert.deepStrictEqual(concat.argumentExpressions.length, 2);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'a'"));
                const arg2: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[1]);
                assert(arg2);
                assert.deepStrictEqual(arg2.parent, concat);
                assert.deepStrictEqual(arg2.token, TLE.Token.createQuotedString(14, "'b'"));
            });

            test("with function with three arguments", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat('a', 'b', 3)]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(21));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(20));
                assert.deepStrictEqual(
                    concat.commaTokens,
                    [
                        TLE.Token.createComma(12),
                        TLE.Token.createComma(17)
                    ]);
                assert.deepStrictEqual(concat.argumentExpressions.length, 3);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'a'"));
                const arg2: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[1]);
                assert(arg2);
                assert.deepStrictEqual(arg2.parent, concat);
                assert.deepStrictEqual(arg2.token, TLE.Token.createQuotedString(14, "'b'"));
                const arg3: TLE.NumberValue = TLE.asNumberValue(concat.argumentExpressions[2]);
                assert(arg3);
                assert.deepStrictEqual(arg3.parent, concat);
                assert.deepStrictEqual(arg3.token, TLE.Token.createNumber(19, "3"));
            });

            test("with function with function argument", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat('a', add(5, 7), 3)]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(27));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(26));
                assert.deepStrictEqual(
                    concat.commaTokens,
                    [
                        TLE.Token.createComma(12),
                        TLE.Token.createComma(23)
                    ]);
                assert.deepStrictEqual(concat.argumentExpressions.length, 3);
                const concatArg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(concatArg1);
                assert.deepStrictEqual(concatArg1.parent, concat);
                assert.deepStrictEqual(concatArg1.token, TLE.Token.createQuotedString(9, "'a'"));
                const concatArg2: TLE.FunctionValue = TLE.asFunctionValue(concat.argumentExpressions[1]);
                assert(concatArg2);
                assert.deepStrictEqual(concatArg2.parent, concat);
                assert.deepStrictEqual(concatArg2.nameToken, TLE.Token.createLiteral(14, "add"));
                assert.deepStrictEqual(concatArg2.leftParenthesisToken, TLE.Token.createLeftParenthesis(17));
                assert.deepStrictEqual(concatArg2.rightParenthesisToken, TLE.Token.createRightParenthesis(22));
                assert.deepStrictEqual(
                    concatArg2.commaTokens,
                    [
                        TLE.Token.createComma(19)
                    ]);
                assert.deepStrictEqual(concatArg2.argumentExpressions.length, 2);
                const addArg1: TLE.NumberValue = TLE.asNumberValue(concatArg2.argumentExpressions[0]);
                assert(addArg1);
                assert.deepStrictEqual(addArg1.parent, concatArg2);
                assert.deepStrictEqual(addArg1.token, TLE.Token.createNumber(18, "5"));
                const addArg2: TLE.NumberValue = TLE.asNumberValue(concatArg2.argumentExpressions[1]);
                assert(addArg2);
                assert.deepStrictEqual(addArg2.parent, concatArg2);
                assert.deepStrictEqual(addArg2.token, TLE.Token.createNumber(21, "7"));
                const concatArg3: TLE.NumberValue = TLE.asNumberValue(concat.argumentExpressions[2]);
                assert(concatArg3);
                assert.deepStrictEqual(concatArg3.parent, concat);
                assert.deepStrictEqual(concatArg3.token, TLE.Token.createNumber(25, "3"));
            });

            test("with function with single single-quote argument", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat(')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, null);
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(9, 3), "A constant string is missing an end quote."),
                        new language.Issue(new language.Span(12, 1), "Expected a right square bracket (']').")
                    ]);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, null);
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "')]"));
            });

            test("with function with missing comma between two arguments", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat('world'12)]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(19));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(16, 2), "Expected a comma (',')."),
                    ]);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(18));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'world'"));
            });

            test("with function with missing comma between three arguments", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[concat('world'12'again')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(26));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(16, 2), "Expected a comma (',')."),
                        new language.Issue(new language.Span(18, 7), "Expected a comma (',')."),
                    ]);

                const concat: TLE.FunctionValue = TLE.asFunctionValue(pr.expression);
                assert(concat);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(25));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);
                const arg1: TLE.StringValue = TLE.asStringValue(concat.argumentExpressions[0]);
                assert(arg1);
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'world'"));
            });

            test("with property access", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[resourceGroup().name]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(22));
                assert.deepStrictEqual(pr.errors, []);

                const propertyAccess: TLE.PropertyAccess = TLE.asPropertyAccessValue(pr.expression);
                assert(propertyAccess);
                assert.deepStrictEqual(propertyAccess.parent, undefined);
                assert.deepStrictEqual(propertyAccess.nameToken, TLE.Token.createLiteral(18, "name"));
                assert.deepStrictEqual(propertyAccess.periodToken, TLE.Token.createPeriod(17));
                const resourceGroup: TLE.FunctionValue = TLE.asFunctionValue(propertyAccess.source);
                assert(resourceGroup);
                assert.deepStrictEqual(resourceGroup.parent, propertyAccess);
                assert.deepStrictEqual(resourceGroup.nameToken, TLE.Token.createLiteral(2, "resourceGroup"));
                assert.deepStrictEqual(resourceGroup.leftParenthesisToken, TLE.Token.createLeftParenthesis(15));
                assert.deepStrictEqual(resourceGroup.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(resourceGroup.commaTokens, []);
                assert.deepStrictEqual(resourceGroup.argumentExpressions, []);
            });

            test("with property access with missing period", () => {
                let pr = TLE.Parser.parse("\"[resourceGroup()name]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "resourceGroup"),
                        TLE.Token.createLeftParenthesis(15),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(16)),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(21), pr.rightSquareBracketToken);
                assert.deepStrictEqual([new language.Issue(new language.Span(17, 4), "Expected the end of the string.")], pr.errors);
            });

            test("with quoted string instead of literal for property access", () => {
                const pr = TLE.Parser.parse("\"[resourceGroup().'name']\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(24));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(18, 6), "Expected a literal value.")
                    ]);

                const propertyAccess: TLE.PropertyAccess = TLE.asPropertyAccessValue(pr.expression);
                assert(propertyAccess);
                assert.deepStrictEqual(propertyAccess.parent, undefined);
                assert.deepStrictEqual(propertyAccess.nameToken, null);
                assert.deepStrictEqual(propertyAccess.periodToken, TLE.Token.createPeriod(17));
                const resourceGroup: TLE.FunctionValue = TLE.asFunctionValue(propertyAccess.source);
                assert(resourceGroup);
                assert.deepStrictEqual(resourceGroup.parent, propertyAccess);
                assert.deepStrictEqual(resourceGroup.nameToken, TLE.Token.createLiteral(2, "resourceGroup"));
                assert.deepStrictEqual(resourceGroup.leftParenthesisToken, TLE.Token.createLeftParenthesis(15));
                assert.deepStrictEqual(resourceGroup.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(resourceGroup.commaTokens, []);
                assert.deepStrictEqual(resourceGroup.argumentExpressions, []);
            });

            test("with property access with missing property name", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[resourceGroup().]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(18));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(18, 1), "Expected a literal value.")
                    ]);

                const propertyAccess: TLE.PropertyAccess = TLE.asPropertyAccessValue(pr.expression);
                assert(propertyAccess);
                assert.deepStrictEqual(propertyAccess.parent, undefined);
                assert.deepStrictEqual(propertyAccess.nameToken, null);
                assert.deepStrictEqual(propertyAccess.periodToken, TLE.Token.createPeriod(17));
                const resourceGroup: TLE.FunctionValue = TLE.asFunctionValue(propertyAccess.source);
                assert(resourceGroup);
                assert.deepStrictEqual(resourceGroup.parent, propertyAccess);
                assert.deepStrictEqual(resourceGroup.nameToken, TLE.Token.createLiteral(2, "resourceGroup"));
                assert.deepStrictEqual(resourceGroup.leftParenthesisToken, TLE.Token.createLeftParenthesis(15));
                assert.deepStrictEqual(resourceGroup.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(resourceGroup.commaTokens, []);
                assert.deepStrictEqual(resourceGroup.argumentExpressions, []);
            });

            test("with a two-deep property access", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[resourceGroup().name.length]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(29));
                assert.deepStrictEqual([], pr.errors);

                const length: TLE.PropertyAccess = TLE.asPropertyAccessValue(pr.expression);
                assert(length);
                assert.deepStrictEqual(length.parent, undefined);
                assert.deepStrictEqual(length.nameToken, TLE.Token.createLiteral(23, "length"));
                assert.deepStrictEqual(length.periodToken, TLE.Token.createPeriod(22));
                const name: TLE.PropertyAccess = TLE.asPropertyAccessValue(length.source);
                assert(name);
                assert.deepStrictEqual(name.parent, length);
                assert.deepStrictEqual(name.nameToken, TLE.Token.createLiteral(18, "name"));
                assert.deepStrictEqual(name.periodToken, TLE.Token.createPeriod(17));
                const resourceGroup: TLE.FunctionValue = TLE.asFunctionValue(name.source);
                assert(resourceGroup);
                assert.deepStrictEqual(resourceGroup.parent, name);
                assert.deepStrictEqual(resourceGroup.nameToken, TLE.Token.createLiteral(2, "resourceGroup"));
                assert.deepStrictEqual(resourceGroup.leftParenthesisToken, TLE.Token.createLeftParenthesis(15));
                assert.deepStrictEqual(resourceGroup.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(resourceGroup.commaTokens, []);
                assert.deepStrictEqual(resourceGroup.argumentExpressions, []);
            });

            test("with array access", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[variables('a')[15]]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(20));
                assert.deepStrictEqual(pr.errors, []);

                const arrayAccess: TLE.ArrayAccessValue = TLE.asArrayAccessValue(pr.expression);
                assert(arrayAccess);
                assert.deepStrictEqual(arrayAccess.rightSquareBracketToken, TLE.Token.createRightSquareBracket(19));
                const index: TLE.NumberValue = TLE.asNumberValue(arrayAccess.index);
                assert(index);
                assert.deepStrictEqual(index.parent, arrayAccess);
                assert.deepStrictEqual(index.token, TLE.Token.createNumber(17, "15"));
                assert.deepStrictEqual(arrayAccess.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(16));
                const variables: TLE.FunctionValue = TLE.asFunctionValue(arrayAccess.source);
                assert(variables);
                assert.deepStrictEqual(variables.parent, arrayAccess);
                assert.deepStrictEqual(variables.nameToken, TLE.Token.createLiteral(2, "variables"));
                assert.deepStrictEqual(variables.leftParenthesisToken, TLE.Token.createLeftParenthesis(11));
                assert.deepStrictEqual(variables.rightParenthesisToken, TLE.Token.createRightParenthesis(15));
                assert.deepStrictEqual(variables.commaTokens, []);
                assert.deepStrictEqual(variables.argumentExpressions.length, 1);
                const arg1: TLE.StringValue = TLE.asStringValue(variables.argumentExpressions[0]);
                assert.deepStrictEqual(arg1.parent, variables);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(12, "'a'"));
            });

            test("with two array accesses", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[variables('a')[15]['fido']]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(28));
                assert.deepStrictEqual(pr.errors, []);

                const arrayAccess1: TLE.ArrayAccessValue = TLE.asArrayAccessValue(pr.expression);
                assert(arrayAccess1);
                assert.deepStrictEqual(arrayAccess1.rightSquareBracketToken, TLE.Token.createRightSquareBracket(27));
                assert.deepStrictEqual(arrayAccess1.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(20));
                const fido: TLE.StringValue = TLE.asStringValue(arrayAccess1.index);
                assert(fido);
                assert.deepStrictEqual(fido.parent, arrayAccess1);
                assert.deepStrictEqual(fido.token, TLE.Token.createQuotedString(21, "'fido'"));
                const arrayAccess2: TLE.ArrayAccessValue = TLE.asArrayAccessValue(arrayAccess1.source);
                assert(arrayAccess2);
                assert.deepStrictEqual(arrayAccess2.parent, arrayAccess1);
                assert.deepStrictEqual(arrayAccess2.rightSquareBracketToken, TLE.Token.createRightSquareBracket(19));
                assert.deepStrictEqual(arrayAccess2.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(16));
                const fifteen: TLE.NumberValue = TLE.asNumberValue(arrayAccess2.index);
                assert(fifteen);
                assert.deepStrictEqual(fifteen.parent, arrayAccess2);
                assert.deepStrictEqual(fifteen.token, TLE.Token.createNumber(17, "15"));
                const variables: TLE.FunctionValue = TLE.asFunctionValue(arrayAccess2.source);
                assert(variables);
                assert.deepStrictEqual(variables.parent, arrayAccess2);
                assert.deepStrictEqual(variables.nameToken, TLE.Token.createLiteral(2, "variables"));
                assert.deepStrictEqual(variables.leftParenthesisToken, TLE.Token.createLeftParenthesis(11));
                assert.deepStrictEqual(variables.rightParenthesisToken, TLE.Token.createRightParenthesis(15));
                assert.deepStrictEqual(variables.commaTokens, []);
                assert.deepStrictEqual(variables.argumentExpressions.length, 1);
                const a: TLE.StringValue = TLE.asStringValue(variables.argumentExpressions[0]);
                assert(a);
                assert.deepStrictEqual(a.parent, variables);
                assert.deepStrictEqual(a.token, TLE.Token.createQuotedString(12, "'a'"));
            });

            test("with array access with function index", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse("\"[variables('a')[add(12,3)]]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(27));
                assert.deepStrictEqual(pr.errors, []);

                const arrayAccess: TLE.ArrayAccessValue = TLE.asArrayAccessValue(pr.expression);
                assert(arrayAccess);
                assert.deepStrictEqual(arrayAccess.parent, undefined);
                assert.deepStrictEqual(arrayAccess.rightSquareBracketToken, TLE.Token.createRightSquareBracket(26));
                assert.deepStrictEqual(arrayAccess.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(16));
                const add: TLE.FunctionValue = TLE.asFunctionValue(arrayAccess.index);
                assert(add);
                assert.deepStrictEqual(add.parent, arrayAccess);
                assert.deepStrictEqual(add.nameToken, TLE.Token.createLiteral(17, "add"));
                assert.deepStrictEqual(add.leftParenthesisToken, TLE.Token.createLeftParenthesis(20));
                assert.deepStrictEqual(add.rightParenthesisToken, TLE.Token.createRightParenthesis(25));
                assert.deepStrictEqual(
                    add.commaTokens,
                    [TLE.Token.createComma(23)]);
                assert.deepStrictEqual(add.argumentExpressions.length, 2);
                const addArg1: TLE.NumberValue = TLE.asNumberValue(add.argumentExpressions[0]);
                assert.deepStrictEqual(addArg1.parent, add);
                assert.deepStrictEqual(addArg1.token, TLE.Token.createNumber(21, "12"))
                const addArg2: TLE.NumberValue = TLE.asNumberValue(add.argumentExpressions[1]);
                assert.deepStrictEqual(addArg2.parent, add);
                assert.deepStrictEqual(addArg2.token, TLE.Token.createNumber(24, "3"));
                const variables: TLE.FunctionValue = TLE.asFunctionValue(arrayAccess.source);
                assert(variables);
                assert.deepStrictEqual(variables.parent, arrayAccess);
                assert.deepStrictEqual(variables.nameToken, TLE.Token.createLiteral(2, "variables"));
                assert.deepStrictEqual(variables.leftParenthesisToken, TLE.Token.createLeftParenthesis(11));
                assert.deepStrictEqual(variables.rightParenthesisToken, TLE.Token.createRightParenthesis(15));
                assert.deepStrictEqual(variables.commaTokens, []);
                assert.deepStrictEqual(variables.argumentExpressions.length, 1);
                const a: TLE.StringValue = TLE.asStringValue(variables.argumentExpressions[0]);
                assert(a);
                assert.deepStrictEqual(a.parent, variables);
                assert.deepStrictEqual(a.token, TLE.Token.createQuotedString(12, "'a'"));
            });

            test("with function after string", () => {
                let pr = TLE.Parser.parse("\"[hello()'world']\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "hello"),
                        TLE.Token.createLeftParenthesis(7),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(8)),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(16), pr.rightSquareBracketToken);
                assert.deepStrictEqual([new language.Issue(new language.Span(9, 7), "Expected the end of the string.")], pr.errors);
            });

            test("with function after string", () => {
                let pr = TLE.Parser.parse("\"[hello'world'()]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "hello"),
                        TLE.Token.createLeftParenthesis(14),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(15)),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(16), pr.rightSquareBracketToken);
                assert.deepStrictEqual([new language.Issue(new language.Span(7, 7), "Expected the end of the string.")], pr.errors);
            });

            test("with string followed by literal", () => {
                let pr = TLE.Parser.parse("\"['world'hello]\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(9, "hello"),
                        null,
                        [],
                        [],
                        null),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(14), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(2, 7), "Expected a literal value."),
                        new language.Issue(new language.Span(9, 5), "Missing function argument list."),
                    ],
                    pr.errors);
            });

            test("with literal followed by string", () => {
                let pr = TLE.Parser.parse("\"[hello'world']\"");
                assert.notEqual(null, pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionValue(
                        TLE.Token.createLiteral(2, "hello"),
                        null,
                        [],
                        [],
                        null),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(14), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(7, 7), "Expected the end of the string."),
                        new language.Issue(new language.Span(2, 5), "Missing function argument list."),
                    ],
                    pr.errors);
            });

            test(`with "[concat(parameters('_artifactsLocation'), '/', '/scripts/azuremysql.sh', parameters('_artifactsLocationSasToken'))], )]"`, () => {
                const pr = TLE.Parser.parse(`"[concat(parameters('_artifactsLocation'), '/', '/scripts/azuremysql.sh', parameters('_artifactsLocationSasToken'))], )]"`);
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new language.Issue(new language.Span(116, 1), "Nothing should exist after the closing ']' except for whitespace."),
                        new language.Issue(new language.Span(118, 1), "Nothing should exist after the closing ']' except for whitespace."),
                        new language.Issue(new language.Span(119, 1), "Nothing should exist after the closing ']' except for whitespace.")
                    ]);
            });
        });
    });

    suite("Token", () => {
        suite("createLeftParenthesis(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createLeftParenthesis(-1);
                assert.equal(TLE.TokenType.LeftParenthesis, t.getType());
                assert.deepStrictEqual(new language.Span(-1, 1), t.span);
                assert.equal("(", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createLeftParenthesis(0);
                assert.equal(TLE.TokenType.LeftParenthesis, t.getType());
                assert.deepStrictEqual(new language.Span(0, 1), t.span);
                assert.equal("(", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createLeftParenthesis(7);
                assert.equal(TLE.TokenType.LeftParenthesis, t.getType());
                assert.deepStrictEqual(new language.Span(7, 1), t.span);
                assert.equal("(", t.stringValue);
            });
        });

        suite("createRightParenthesis(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createRightParenthesis(-1);
                assert.equal(TLE.TokenType.RightParenthesis, t.getType());
                assert.deepStrictEqual(new language.Span(-1, 1), t.span);
                assert.equal(")", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createRightParenthesis(0);
                assert.equal(TLE.TokenType.RightParenthesis, t.getType());
                assert.deepStrictEqual(new language.Span(0, 1), t.span);
                assert.equal(")", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createRightParenthesis(7);
                assert.equal(TLE.TokenType.RightParenthesis, t.getType());
                assert.deepStrictEqual(new language.Span(7, 1), t.span);
                assert.equal(")", t.stringValue);
            });
        });

        suite("createLeftSquareBracket(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createLeftSquareBracket(-1);
                assert.equal(TLE.TokenType.LeftSquareBracket, t.getType());
                assert.deepStrictEqual(new language.Span(-1, 1), t.span);
                assert.equal("[", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createLeftSquareBracket(0);
                assert.equal(TLE.TokenType.LeftSquareBracket, t.getType());
                assert.deepStrictEqual(new language.Span(0, 1), t.span);
                assert.equal("[", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createLeftSquareBracket(7);
                assert.equal(TLE.TokenType.LeftSquareBracket, t.getType());
                assert.deepStrictEqual(new language.Span(7, 1), t.span);
                assert.equal("[", t.stringValue);
            });
        });

        suite("createRightSquareBracket(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createRightSquareBracket(-1);
                assert.equal(TLE.TokenType.RightSquareBracket, t.getType());
                assert.deepStrictEqual(new language.Span(-1, 1), t.span);
                assert.equal("]", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createRightSquareBracket(0);
                assert.equal(TLE.TokenType.RightSquareBracket, t.getType());
                assert.deepStrictEqual(new language.Span(0, 1), t.span);
                assert.equal("]", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createRightSquareBracket(7);
                assert.equal(TLE.TokenType.RightSquareBracket, t.getType());
                assert.deepStrictEqual(new language.Span(7, 1), t.span);
                assert.equal("]", t.stringValue);
            });
        });

        suite("createComma(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createComma(-1);
                assert.equal(TLE.TokenType.Comma, t.getType());
                assert.deepStrictEqual(new language.Span(-1, 1), t.span);
                assert.equal(",", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createComma(0);
                assert.equal(TLE.TokenType.Comma, t.getType());
                assert.deepStrictEqual(new language.Span(0, 1), t.span);
                assert.equal(",", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createComma(7);
                assert.equal(TLE.TokenType.Comma, t.getType());
                assert.deepStrictEqual(new language.Span(7, 1), t.span);
                assert.equal(",", t.stringValue);
            });
        });
    });

    suite("Tokenizer", () => {
        suite("readToken()", () => {
            test("with null stringValue", () => {
                assert.throws(() => { TLE.Tokenizer.fromString(null); });
            });

            test("with '' stringValue", () => {
                assert.throws(() => { TLE.Tokenizer.fromString(""); });
            });

            test("with empty TLE expression without surrounding quotes", () => {
                assert.throws(() => { TLE.Tokenizer.fromString("[]"); });
            });

            test("with empty TLE expression", () => {
                let tt = TLE.Tokenizer.fromString("\"[]\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(2), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with empty TLE object with whitespace inside", () => {
                let tt = TLE.Tokenizer.fromString("\"[ ]\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(2, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(3), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with comma", () => {
                let tt = TLE.Tokenizer.fromString("\",\"");
                assert.deepStrictEqual(TLE.Token.createComma(1), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with whitespace", () => {
                let tt = TLE.Tokenizer.fromString("\" \r\n\t \"");
                assert.deepStrictEqual(TLE.Token.createWhitespace(1, " \r\n\t "), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with double-quoted empty string", () => {
                let tt = TLE.Tokenizer.fromString("\"\"");
                assert.equal(null, tt.readToken());
            });

            test("with escaped single-quoted empty string", () => {
                let tt = TLE.Tokenizer.fromString("\"\'\'\"");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "\'\'"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with unescaped single-quoted empty string", () => {
                let tt = TLE.Tokenizer.fromString("\"''\"");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "''"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with unterminated double-quoted string", () => {
                let tt = TLE.Tokenizer.fromString("'\"hello'");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "\"hello"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with unterminated single-quoted string", () => {
                let tt = TLE.Tokenizer.fromString("\"\'hello\"");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "\'hello"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with double-quoted string with escaped back-slash inside", () => {
                let tt = TLE.Tokenizer.fromString("\"'C:\\\\Users\\\\'\"");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "'C:\\\\Users\\\\'"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with double-quoted string with escaped double-quote inside", () => {
                let tt = TLE.Tokenizer.fromString("'\"hello\\\"there\"'");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "\"hello\\\"there\""), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with zero", () => {
                let tt = TLE.Tokenizer.fromString("'0'");
                assert.deepStrictEqual(TLE.Token.createNumber(1, "0"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with positive number", () => {
                let tt = TLE.Tokenizer.fromString("\"123\"");
                assert.deepStrictEqual(TLE.Token.createNumber(1, "123"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with negative number", () => {
                let tt = TLE.Tokenizer.fromString("'-456");
                assert.deepStrictEqual(TLE.Token.createNumber(1, "-456"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with floating-point number", () => {
                let tt = TLE.Tokenizer.fromString("\"7.8\"");
                assert.deepStrictEqual(TLE.Token.createNumber(1, "7.8"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with expression with single constant string", () => {
                let tt = TLE.Tokenizer.fromString("\"[ 'apples']\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(2, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(3, "'apples'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(11), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with true", () => {
                let tt = TLE.Tokenizer.fromString("'true'");
                assert.deepStrictEqual(TLE.Token.createLiteral(1, "true"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with value that starts with '.'", () => {
                let tt = TLE.Tokenizer.fromString("\". hello there\"");
                assert.deepStrictEqual(TLE.Token.createPeriod(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(2, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(3, "hello"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(8, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(9, "there"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with literal that ends with a number", () => {
                let tt = TLE.Tokenizer.fromString("\"base64\"");
                assert.deepStrictEqual(TLE.Token.createLiteral(1, "base64"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with several invalid literals", () => {
                let tt = TLE.Tokenizer.fromString("\".[]82348923asdflih   asl .,'\"");
                assert.deepStrictEqual(TLE.Token.createPeriod(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(2), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(3), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createNumber(4, "82348923"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(12, "asdflih"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(19, "   "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(22, "asl"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(25, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createPeriod(26), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createComma(27), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(28, "'"), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with function TLE with no arguments", () => {
                let tt = TLE.Tokenizer.fromString("'[concat()]'");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "concat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(9), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(10), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with function TLE with no arguments with no closing right square bracket", () => {
                let tt = TLE.Tokenizer.fromString("'[concat()'");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "concat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(9), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with function TLE with one argument", () => {
                let tt = TLE.Tokenizer.fromString("\"[concat('Seattle')]\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "concat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(9, "'Seattle'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(18), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(19), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with function TLE with two arguments", () => {
                let tt = TLE.Tokenizer.fromString("\"[concat('Seattle', 'WA')]\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "concat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(9, "'Seattle'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createComma(18), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(19, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(20, "'WA'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(24), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(25), tt.readToken());
                assert.equal(null, tt.readToken());
            });

            test("with function TLE with multiple arguments", () => {
                let tt = TLE.Tokenizer.fromString("\"[concat('Seattle', 'WA', 'USA')]\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "concat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(9, "'Seattle'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createComma(18), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(19, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(20, "'WA'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createComma(24), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(25, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(26, "'USA'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(31), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(32), tt.readToken());
                assert.equal(null, tt.readToken());
            });
        });
    });

    suite("UnrecognizedFunctionVisitor", () => {
        suite("visit(tle.Value)", () => {
            const functionMetadata: FunctionsMetadata = new FunctionsMetadata([new FunctionMetadata("CONCAT", "", "", 1, 2, [])]);

            test("with null", () => {
                const visitor = TLE.UnrecognizedFunctionVisitor.visit(null, functionMetadata);
                assert(visitor);
                assert.deepStrictEqual([], visitor.errors);
            });

            test("with undefined", () => {
                const visitor = TLE.UnrecognizedFunctionVisitor.visit(undefined, functionMetadata);
                assert(visitor);
                assert.deepStrictEqual([], visitor.errors);
            });

            test("with recognized function", () => {
                const tleParseResult = TLE.Parser.parse("'[concat()]'");
                const visitor = TLE.UnrecognizedFunctionVisitor.visit(tleParseResult.expression, functionMetadata);
                assert(visitor);
                assert.deepStrictEqual([], visitor.errors);
            });

            test("with unrecognized function", () => {
                const tleParseResult = TLE.Parser.parse("'[concatenate()]'");
                const visitor = TLE.UnrecognizedFunctionVisitor.visit(tleParseResult.expression, functionMetadata);
                assert(visitor);
                assert.deepStrictEqual(
                    [
                        new language.Issue(new language.Span(2, 11), "Unrecognized function name 'concatenate'.")
                    ],
                    visitor.errors);
            });
        });
    });

    suite("IncorrectFunctionArgumentCountVisitor", () => {
        suite("visit(tle.Value, FunctionsMetadata)", () => {
            test("with null value", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(null, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with undefined value", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(undefined, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with number value", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(new TLE.NumberValue(TLE.Token.createNumber(17, "3")), functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with concat() with zero arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[concat()]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with concat() with one argument", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[concat(12)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with concat() with two arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[concat(12, 'test')]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with add() with zero arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[add()]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(
                            visitor.errors,
                            [new language.Issue(new language.Span(2, 5), "The function 'add' takes 2 arguments.")]);
                    });
            });

            test("with add() with one argument", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[add(5)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(
                            visitor.errors,
                            [new language.Issue(new language.Span(2, 6), "The function 'add' takes 2 arguments.")]);
                    });
            });

            test("with add() with two arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[add(5, 6)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with add() with three arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[add(5, 6, 7)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(
                            visitor.errors,
                            [new language.Issue(new language.Span(2, 12), "The function 'add' takes 2 arguments.")]);
                    });
            });

            test("with add() with three arguments and different casing", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[Add(5, 6, 7)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(
                            visitor.errors,
                            [new language.Issue(new language.Span(2, 12), "The function 'add' takes 2 arguments.")]);
                    });
            });

            test("with resourceId() with zero arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[resourceId()]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(
                            visitor.errors,
                            [new language.Issue(new language.Span(2, 12), "The function 'resourceId' takes at least 2 arguments.")]);
                    });
            });

            test("with resourceId() with one argument", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[resourceId(5)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(
                            visitor.errors,
                            [new language.Issue(new language.Span(2, 13), "The function 'resourceId' takes at least 2 arguments.")]);
                    });
            });

            test("with resourceId() with two arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[resourceId(5, 6)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with resourceId() with three arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[resourceId(5, 6, 7)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with substring() with zero arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[substring()]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(
                            visitor.errors,
                            [new language.Issue(new language.Span(2, 11), "The function 'substring' takes between 1 and 3 arguments.")]);
                    });
            });

            test("with substring() with one argument", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[substring('abc')]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with substring() with two arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[substring('abc', 1)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with substring() with three arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[substring('abc', 1, 1)]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(visitor.errors, []);
                    });
            });

            test("with substring() with four arguments", () => {
                return AzureRMAssets.getFunctionsMetadata()
                    .then((functions: FunctionsMetadata) => {
                        const concat: TLE.Value = TLE.Parser.parse(`"[substring('abc', 1, 1, 'blah')]"`).expression;
                        const visitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                        assert(visitor);
                        assert.deepStrictEqual(
                            visitor.errors,
                            [new language.Issue(new language.Span(2, 30), "The function 'substring' takes between 1 and 3 arguments.")]);
                    });
            });
        });
    });

    suite("UndefinedVariablePropertyVisitor", () => {
        suite("visitPropertyAccess(TLE.PropertyAccess)", () => {
            test("with child property access from undefined variable reference", () => {
                const dt = new DeploymentTemplate(`{ "a": "[variables('v1').apples]" }`, "id");
                const context: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[variables('v1').app`.length);
                const visitor = TLE.UndefinedVariablePropertyVisitor.visit(context.tleValue, dt);
                assert.deepStrictEqual(visitor.errors, [], "No errors should be reported for a property access to an undefined variable, because the top priority error for the developer to address is the undefined variable reference.");
            });

            test("with grandchild property access from undefined variable reference", () => {
                const dt = new DeploymentTemplate(`{ "a": "[variables('v1').apples.bananas]" }`, "id");
                const context: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[variables('v1').apples.ban`.length);
                const visitor = TLE.UndefinedVariablePropertyVisitor.visit(context.tleValue, dt);
                assert.deepStrictEqual(visitor.errors, [], "No errors should be reported for a property access to an undefined variable, because the top priority error for the developer to address is the undefined variable reference.");
            });

            test("with child property access from variable reference to non-object variable", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "v1": "blah" }, "a": "[variables('v1').apples]" }`, "id");
                const context: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "variables": { "v1": "blah" }, "a": "[variables('v1').app`.length);
                const visitor = TLE.UndefinedVariablePropertyVisitor.visit(context.tleValue, dt);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new language.Issue(new language.Span(18, 6), `Property "apples" is not a defined property of "variables('v1')".`)]);
            })

            test("with grandchild property access from variable reference to non-object variable", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "v1": "blah" }, "a": "[variables('v1').apples.bananas]" }`, "id");
                const context: PositionContext = dt.getContextFromDocumentCharacterIndex(`{ "variables": { "v1": "blah" }, "a": "[variables('v1').apples.ban`.length);
                const visitor = TLE.UndefinedVariablePropertyVisitor.visit(context.tleValue, dt);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new language.Issue(new language.Span(18, 6), `Property "apples" is not a defined property of "variables('v1')".`)]);
            })
        });
    });

    suite("FindReferencesVisitor", () => {
        suite("visit(tle.Value,string,string)", () => {
            test("with null TLE", () => {
                const visitor = TLE.FindReferencesVisitor.visit(null, Reference.ReferenceKind.Parameter, "pName");
                assert(visitor);
                assert.deepStrictEqual(visitor.references, new Reference.List(Reference.ReferenceKind.Parameter));
            });

            test("with undefined TLE", () => {
                const visitor = TLE.FindReferencesVisitor.visit(undefined, Reference.ReferenceKind.Parameter, "pName");
                assert(visitor);
                assert.deepStrictEqual(visitor.references, new Reference.List(Reference.ReferenceKind.Parameter));
            });

            test("with TLE", () => {
                const pr: TLE.ParseResult = TLE.Parser.parse(`"[parameters('pName')]"`)
                const visitor = TLE.FindReferencesVisitor.visit(pr.expression, Reference.ReferenceKind.Parameter, "pName");
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.references,
                    new Reference.List(Reference.ReferenceKind.Parameter, [new language.Span(14, 5)]));
            });
        });
    });
});
