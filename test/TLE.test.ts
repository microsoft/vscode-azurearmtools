// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion

import * as assert from "assert";
import { Uri } from "vscode";
import { AzureRMAssets, BuiltinFunctionMetadata, DefinitionKind, DeploymentTemplate, FindReferencesVisitor, FunctionsMetadata, IncorrectArgumentsCountIssue, IncorrectFunctionArgumentCountVisitor, Language, nonNullValue, ReferenceList, ScopeContext, TemplatePositionContext, TemplateScope, TLE, UndefinedParameterAndVariableVisitor, UndefinedVariablePropertyVisitor, UnrecognizedBuiltinFunctionIssue, UnrecognizedFunctionVisitor } from "../extension.bundle";
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate } from "./support/parseTemplate";

const IssueKind = Language.IssueKind;
const tleSyntax = IssueKind.tleSyntax;

const fakeId = Uri.file("https://fake-id");

suite("TLE", () => {
    const emptyScope = new TemplateScope(ScopeContext.TopLevel, [], [], [], "empty scope");

    function parseExpressionWithScope(stringValue: string, scope?: TemplateScope): TLE.ParseResult {
        scope = scope ? scope : emptyScope;
        return TLE.Parser.parse(stringValue, scope);
    }

    suite("isExpression", () => {
        function createIsExpressionTest(unquotedValue: string, expectedResult: boolean): void {
            test(`"${unquotedValue}"`, () => {
                const result = TLE.isTleExpression(unquotedValue);
                assert.equal(result, expectedResult);
            });
        }

        createIsExpressionTest("", false);
        createIsExpressionTest("[", false);
        createIsExpressionTest("['hi'", false);
        createIsExpressionTest("]", false);
        createIsExpressionTest("[[", false);
        createIsExpressionTest("'hi'", false);
        createIsExpressionTest(" []", false);
        createIsExpressionTest("[] ", false);
        createIsExpressionTest("[[] ", false);
        createIsExpressionTest("[[]", false);

        createIsExpressionTest("[]", true);
        createIsExpressionTest("['hi']", true);
    });

    suite("StringValue", () => {
        suite("constructor(tle.Token)", () => {
            test("with undefined token", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new TLE.StringValue(<any>undefined); });
            });

            test("with undefined token", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new TLE.StringValue(<any>undefined); });
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

            test("ends with comments and whitespace", () => {
                const value: TLE.NumberValue = new TLE.NumberValue(TLE.Token.createNumber(3, "1237 /* there */"));
                assert(value.contains(7));
            });
        });
    });

    suite("ArrayAccess", () => {
        suite("constructor(tle.Value,tle.Token,tle.Value,tle.Token)", () => {
            test("with undefined _source", () => {
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                // tslint:disable-next-line:no-any
                assert.throws(() => { new TLE.ArrayAccessValue(<any>undefined, leftSquareBracket, index, rightSquareBracket); });
            });

            test("with undefined _source", () => {
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                // tslint:disable-next-line:no-any
                assert.throws(() => { new TLE.ArrayAccessValue(<any>undefined, leftSquareBracket, index, rightSquareBracket); });
            });

            test("with undefined _leftSquareBracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                // tslint:disable-next-line:no-any
                assert.throws(() => { new TLE.ArrayAccessValue(source, <any>undefined, index, rightSquareBracket); });
            });

            test("with undefined _index", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let rightSquareBracket = TLE.Token.createRightSquareBracket(8);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, undefined, rightSquareBracket);
                assert.deepStrictEqual(source, arrayAccess.source);
                assert.deepStrictEqual(leftSquareBracket, arrayAccess.leftSquareBracketToken);
                assert.deepStrictEqual(undefined, arrayAccess.indexValue);
                assert.deepStrictEqual(rightSquareBracket, arrayAccess.rightSquareBracketToken);
            });

            test("with undefined _rightSquareBracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let index = new TLE.NumberValue(TLE.Token.createNumber(7, "3"));
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, undefined);
                assert.deepStrictEqual(source, arrayAccess.source);
                assert.deepStrictEqual(leftSquareBracket, arrayAccess.leftSquareBracketToken);
                assert.deepStrictEqual(index, arrayAccess.indexValue);
                assert.deepStrictEqual(undefined, arrayAccess.rightSquareBracketToken);
            });
        });

        suite("getSpan()", () => {
            test("with no index or right square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(6);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, undefined, undefined);
                assert.deepStrictEqual(new Language.Span(5, 2), arrayAccess.getSpan());
            });

            test("with whitespace between source and left square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(8);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, undefined, undefined);
                assert.deepStrictEqual(new Language.Span(5, 4), arrayAccess.getSpan());
            });

            test("with no right square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(8);
                let index = new TLE.NumberValue(TLE.Token.createNumber(10, "10"));
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, undefined);
                assert.deepStrictEqual(new Language.Span(5, 7), arrayAccess.getSpan());
            });

            test("with no index", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(8);
                let rightSquareBracket = TLE.Token.createRightSquareBracket(12);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, undefined, rightSquareBracket);
                assert.deepStrictEqual(new Language.Span(5, 8), arrayAccess.getSpan());
            });

            test("with complete array access", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(8);
                let index = new TLE.NumberValue(TLE.Token.createNumber(10, "10"));
                let rightSquareBracket = TLE.Token.createRightSquareBracket(12);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, rightSquareBracket);
                assert.deepStrictEqual(new Language.Span(5, 8), arrayAccess.getSpan());
            });
        });

        suite("toString()", () => {
            test("with no index or right square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(10);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, undefined, undefined);
                assert.deepStrictEqual("2[", arrayAccess.toString());
            });

            test("with no right square bracket", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(10);
                let index = new TLE.StringValue(TLE.Token.createQuotedString(20, "'hello'"));
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, index, undefined);
                assert.deepStrictEqual("2['hello'", arrayAccess.toString());
            });

            test("with no index", () => {
                let source = new TLE.NumberValue(TLE.Token.createNumber(5, "2"));
                let leftSquareBracket = TLE.Token.createLeftSquareBracket(10);
                let rightSquareBracket = TLE.Token.createRightSquareBracket(30);
                let arrayAccess = new TLE.ArrayAccessValue(source, leftSquareBracket, undefined, rightSquareBracket);
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

    suite("FunctionCallValue", () => {
        suite("constructor(tle.Token,tle.Token,tle.Value[],tle.Token)", () => {
            test("with undefined namespaceToken", () => {
                let name = TLE.Token.createLiteral(1, "test");
                let leftParenthesis = TLE.Token.createLeftParenthesis(5);
                let commaTokens: TLE.Token[] = [];
                let args: (TLE.Value | undefined)[] = [];
                let rightParenthesis = TLE.Token.createRightParenthesis(10);
                let f = new TLE.FunctionCallValue(undefined, undefined, name, leftParenthesis, commaTokens, args, rightParenthesis, emptyScope);
                assert.deepStrictEqual(name, f.nameToken);
                assert.deepStrictEqual(leftParenthesis, f.leftParenthesisToken);
                assert.deepStrictEqual(args, f.argumentExpressions);
                assert.deepStrictEqual(rightParenthesis, f.rightParenthesisToken);
                assert.deepStrictEqual(undefined, f.namespaceToken);
                assert.deepStrictEqual(f.fullName, "test");
            });

            test("with undefined _leftParenthesisToken", () => {
                let name = TLE.Token.createLiteral(1, "test");
                let commaTokens: TLE.Token[] = [];
                let args: (TLE.Value | undefined)[] = [];
                let rightParenthesis = TLE.Token.createRightParenthesis(10);

                let f = new TLE.FunctionCallValue(undefined, undefined, name, undefined, commaTokens, args, rightParenthesis, emptyScope);

                assert.deepStrictEqual(name, f.nameToken);
                assert.deepStrictEqual(undefined, f.leftParenthesisToken);
                assert.deepStrictEqual(args, f.argumentExpressions);
                assert.deepStrictEqual(rightParenthesis, f.rightParenthesisToken);
            });

            test("with undefined _argumentExpressions", () => {
                let name = TLE.Token.createLiteral(1, "test");
                let commaTokens: TLE.Token[] = [];
                let leftParenthesis = TLE.Token.createLeftParenthesis(5);
                let rightParenthesis = TLE.Token.createRightParenthesis(10);

                // tslint:disable-next-line:no-any
                assert.throws(() => { new TLE.FunctionCallValue(undefined, undefined, name, leftParenthesis, commaTokens, <any>undefined, rightParenthesis, emptyScope); });
            });

            test("with undefined _rightParenthesisToken", () => {
                let name = TLE.Token.createLiteral(1, "test");
                let commaTokens: TLE.Token[] = [];
                let leftParenthesis = TLE.Token.createLeftParenthesis(5);
                let args: (TLE.Value | undefined)[] = [];

                let f = new TLE.FunctionCallValue(undefined, undefined, name, leftParenthesis, commaTokens, args, undefined, emptyScope);

                assert.deepStrictEqual(name, f.nameToken);
                assert.deepStrictEqual(leftParenthesis, f.leftParenthesisToken);
                assert.deepStrictEqual(args, f.argumentExpressions);
                assert.deepStrictEqual(undefined, f.rightParenthesisToken);
            });
        });

        suite("getSpan()", () => {
            test("with name", () => {
                let f = parseExpressionWithScope("\"[concat]\"").expression;
                assert(f instanceof TLE.FunctionCallValue);
                assert.deepStrictEqual(new Language.Span(2, 6), f!.getSpan());
            });

            test("with left parenthesis", () => {
                let f = parseExpressionWithScope("\"[concat(]\"").expression;
                assert(f instanceof TLE.FunctionCallValue);
                assert.deepStrictEqual(new Language.Span(2, 7), f!.getSpan());
            });

            test("with one argument and no right parenthesis", () => {
                let f = parseExpressionWithScope("\"[concat(70").expression;
                assert(f instanceof TLE.FunctionCallValue);
                assert.deepStrictEqual(new Language.Span(2, 9), f!.getSpan());
            });

            test("with two arguments and no right parenthesis", () => {
                let f = parseExpressionWithScope("\"[concat(70, 3").expression;
                assert(f instanceof TLE.FunctionCallValue);
                assert.deepStrictEqual(new Language.Span(2, 12), f!.getSpan());
            });

            test("with left and right parenthesis and no arguments", () => {
                let f = parseExpressionWithScope("\"[concat()\"").expression;
                assert(f instanceof TLE.FunctionCallValue);
                assert.deepStrictEqual(new Language.Span(2, 8), f!.getSpan());
            });

            test("with left and right parenthesis and arguments", () => {
                let f = parseExpressionWithScope("\"[concat('hello', 'world')\"").expression;
                assert(f instanceof TLE.FunctionCallValue);
                assert.deepStrictEqual(new Language.Span(2, 24), f!.getSpan());
            });

            test("with last argument missing and no right parenthesis", () => {
                let f = parseExpressionWithScope("\"[concat('hello',").expression;
                assert(f instanceof TLE.FunctionCallValue);
                assert.deepStrictEqual(new Language.Span(2, 15), f!.getSpan());
            });
        });
    });

    suite("BraceHighlighter", () => {
        function getHighlights(template: DeploymentTemplate, documentCharacterIndex: number): number[] {
            const context = template.getContextFromDocumentCharacterIndex(documentCharacterIndex, undefined);
            return TLE.BraceHighlighter.getHighlightCharacterIndexes(context);
        }

        suite("getHighlightCharacterIndexes(number,TLEParseResult)", () => {
            test("with quoted string that isn't a TLE", () => {
                let template = new DeploymentTemplate("\"Hello world\"", fakeId);
                assert.deepStrictEqual([], getHighlights(template, 0));
                assert.deepStrictEqual([], getHighlights(template, 5));
                assert.deepStrictEqual([], getHighlights(template, 11));
            });

            test("with left square bracket", () => {
                let template = new DeploymentTemplate("\"[", fakeId);
                assert.deepStrictEqual([], getHighlights(template, 0));
                assert.deepStrictEqual([1], getHighlights(template, 1));
                assert.deepStrictEqual([], getHighlights(template, 2));
            });

            test("with empty TLE", () => {
                let template = new DeploymentTemplate("\"[]\"", fakeId);
                assert.deepStrictEqual([1, 2], getHighlights(template, 1), "When the caret is before a TLE's left square bracket, then the left and right square brackets should be highlighted.");
                assert.deepStrictEqual([], getHighlights(template, 2), "When the caret is to the right of a TLE's left square bracket and to the left of the right square bracket, nothing should be highlighted.");
                assert.deepStrictEqual([1, 2], getHighlights(template, 3), "When the caret is after a TLE's right square bracket, then the left and right square brackets should be highlighted.");
            });

            test("with function with no parenthesis", () => {
                let template = new DeploymentTemplate("\"[concat", fakeId);
                assert.deepStrictEqual([], getHighlights(template, 8));
            });

            test("with function with left parenthesis but no right parenthesis", () => {
                let template = new DeploymentTemplate("\"[concat(", fakeId);
                assert.deepStrictEqual([8], getHighlights(template, 8));
            });

            test("with function with left and right parenthesis", () => {
                let template = new DeploymentTemplate("\"[concat()", fakeId);
                assert.deepStrictEqual([8, 9], getHighlights(template, "\"[concat".length), "Both left and right parentheses should be highlighted when the caret is before the left parenthesis.");
                assert.deepStrictEqual([], getHighlights(template, 9));
                assert.deepStrictEqual([8, 9], getHighlights(template, "\"[concat()".length), "Both left and right parentheses should be highlighted when the caret is after the right parenthesis.");
            });
        });
    });

    suite("UndefinedParameterAndVariableVisitor", () => {
        suite("constructor(DeploymentTemplate)", () => {
            test("with undefined", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new UndefinedParameterAndVariableVisitor(<any>undefined); });
            });

            test("with undefined", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new UndefinedParameterAndVariableVisitor(<any>undefined); });
            });

            test("with deployment template", () => {
                const dt = new DeploymentTemplate("\"{}\"", fakeId);
                const visitor = new UndefinedParameterAndVariableVisitor(dt.topLevelScope);
                assert.deepStrictEqual(visitor.errors, []);
            });
        });

        suite("visitString(StringValue)", () => {
            test("with undefined", () => {
                const dt = new DeploymentTemplate("\"{}\"", fakeId);
                const visitor = new UndefinedParameterAndVariableVisitor(dt.topLevelScope);
                // tslint:disable-next-line:no-any
                assert.throws(() => { visitor.visitString(<any>undefined); });
            });

            test("with undefined", () => {
                const dt = new DeploymentTemplate("\"{}\"", fakeId);
                const visitor = new UndefinedParameterAndVariableVisitor(dt.topLevelScope);
                // tslint:disable-next-line:no-any
                assert.throws(() => { visitor.visitString(<any>undefined); });
            });

            test("with empty StringValue in parameters() function", () => {
                const dt = new DeploymentTemplate("\"{}\"", fakeId);
                const visitor = new UndefinedParameterAndVariableVisitor(dt.topLevelScope);

                const stringValue = new TLE.StringValue(TLE.Token.createQuotedString(17, "''"));
                stringValue.parent = new TLE.FunctionCallValue(
                    undefined,
                    undefined,
                    TLE.Token.createLiteral(3, "parameters"),
                    undefined,
                    [],
                    [stringValue],
                    undefined,
                    dt.topLevelScope);

                visitor.visitString(stringValue);
                assert.deepStrictEqual(
                    visitor.errors,
                    [
                        new Language.Issue(new Language.Span(17, 2), "Undefined parameter reference: ''", IssueKind.undefinedParam)
                    ]
                );
            });

            test("with empty StringValue in variables() function", () => {
                const dt = new DeploymentTemplate("\"{}\"", fakeId);
                const visitor = new UndefinedParameterAndVariableVisitor(dt.topLevelScope);

                const stringValue = new TLE.StringValue(TLE.Token.createQuotedString(17, "''"));
                stringValue.parent = new TLE.FunctionCallValue(
                    undefined,
                    undefined,
                    TLE.Token.createLiteral(3, "variables"),
                    undefined,
                    [],
                    [stringValue],
                    undefined,
                    dt.topLevelScope);

                visitor.visitString(stringValue);
                assert.deepStrictEqual(
                    visitor.errors,
                    [
                        new Language.Issue(new Language.Span(17, 2), "Undefined variable reference: ''", IssueKind.undefinedVar)
                    ]
                );
            });
        });
    });

    suite("Parser", () => {
        suite("parse(string)", () => {
            test("with empty stringValue", () => {
                assert.throws(() => { parseExpressionWithScope(""); });
            });

            test("with non-empty non-quoted stringValue", () => {
                assert.throws(() => { parseExpressionWithScope("hello"); });
            });

            test("with single double-quote character", () => {
                let pr = parseExpressionWithScope("\"");
                assert(pr);
                assert.equal(undefined, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"")),
                    pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with empty quoted string", () => {
                let pr = parseExpressionWithScope("\"\"");
                assert(pr);
                assert.equal(undefined, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"\"")),
                    pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with non-empty quoted string", () => {
                let pr = parseExpressionWithScope("\"hello\"");
                assert(pr);
                assert.equal(undefined, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"hello\"")),
                    pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with left square bracket (but no right square bracket)", () => {
                let pr = parseExpressionWithScope("\"[\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.equal(undefined, pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(2, 1), "Expected a right square bracket (']').", tleSyntax),
                        new Language.Issue(new Language.Span(1, 1), "Expected a function or property expression.", tleSyntax)
                    ],
                    pr.errors);
            });

            test("with two left square brackets", () => {
                let pr = parseExpressionWithScope("\"[[\"");
                assert(pr);
                assert.equal(undefined, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"[[\"")),
                    pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with two left square brackets and a right square bracket", () => {
                let pr = parseExpressionWithScope("\"[[]\"");
                assert(pr);
                assert.equal(undefined, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"[[]\"")),
                    pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with two left square brackets and a literal", () => {
                let pr = parseExpressionWithScope("\"[[hello\"");
                assert(pr);
                assert.equal(undefined, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"[[hello\"")),
                    pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with left and right square brackets", () => {
                let pr = parseExpressionWithScope("\"[]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.equal(undefined, pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(2), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new Language.Issue(new Language.Span(1, 2), "Expected a function or property expression.", tleSyntax)],
                    pr.errors);
            });

            test("with left and right square brackets after whitespace", () => {
                let pr = parseExpressionWithScope("\"  []\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(3), pr.leftSquareBracketToken);
                assert.equal(undefined, pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(4), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new Language.Issue(new Language.Span(3, 2), "Expected a function or property expression.", tleSyntax)],
                    pr.errors);
            });

            test("with left and right square brackets with whitespace between them", () => {
                let pr = parseExpressionWithScope("\"[    ]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(undefined, pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(6), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new Language.Issue(new Language.Span(1, 6), "Expected a function or property expression.", tleSyntax)],
                    pr.errors);
            });

            test("with right square bracket", () => {
                let pr = parseExpressionWithScope("\"]\"");
                assert(pr);
                assert.equal(undefined, pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.StringValue(TLE.Token.createQuotedString(0, "\"]\"")),
                    pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with function name without parentheses, arguments, or right square bracket", () => {
                let pr = parseExpressionWithScope("\"[concat\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(new TLE.FunctionCallValue(undefined, undefined, TLE.Token.createLiteral(2, "concat"), undefined, [], [], undefined, pr.scope), pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(2, 6), "Missing function argument list.", tleSyntax),
                        new Language.Issue(new Language.Span(8, 1), "Expected a right square bracket (']').", tleSyntax)
                    ],
                    pr.errors);
            });

            test("with function namespace and period but no function name", () => {
                let pr = parseExpressionWithScope("\"[concat.\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(new TLE.FunctionCallValue(TLE.Token.createLiteral(2, "concat"), TLE.Token.createPeriod(2 + "concat".length), undefined, undefined, [], [], undefined, pr.scope), pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(8, 1), "Expected user-defined function name.", tleSyntax),
                        new Language.Issue(new Language.Span(2, 6), "Missing function argument list.", tleSyntax),
                        new Language.Issue(new Language.Span(9, 1), "Expected a right square bracket (']').", tleSyntax)
                    ],
                    pr.errors);
            });

            test("with function name without parentheses or arguments", () => {
                let pr = parseExpressionWithScope("\"[concat]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(new TLE.FunctionCallValue(undefined, undefined, TLE.Token.createLiteral(2, "concat"), undefined, [], [], undefined, pr.scope), pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(8), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new Language.Issue(new Language.Span(2, 6), "Missing function argument list.", tleSyntax)],
                    pr.errors);
            });

            test("with function name and left parenthesis without right square bracket", () => {
                let pr = parseExpressionWithScope("\"[concat (\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(9),
                        [],
                        [],
                        undefined,
                        pr.scope),
                    pr.expression);
                assert.equal(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(9, 1), "Expected a right parenthesis (')').", tleSyntax),
                        new Language.Issue(new Language.Span(10, 1), "Expected a right square bracket (']').", tleSyntax)
                    ],
                    pr.errors);
            });

            test("with function name and left parenthesis", () => {
                let pr = parseExpressionWithScope("\"[concat (]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(9),
                        [],
                        [],
                        undefined,
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(10), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [new Language.Issue(new Language.Span(10, 1), "Expected a right parenthesis (')').", tleSyntax)],
                    pr.errors);
            });

            test("with function name and right parenthesis", () => {
                let pr = parseExpressionWithScope("\"[concat)]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "concat"),
                        undefined,
                        [],
                        [],
                        undefined,
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(9), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(8, 1), "Expected the end of the string.", tleSyntax),
                        new Language.Issue(new Language.Span(2, 6), "Missing function argument list.", tleSyntax),
                    ],
                    pr.errors);
            });

            test("with function with no arguments", () => {
                let pr = parseExpressionWithScope("\" [ concat (    )  ]  \"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(2), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(4, "concat"),
                        TLE.Token.createLeftParenthesis(11),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(16),
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(19), pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);
            });

            test("with function with one number argument", () => {
                let pr = parseExpressionWithScope("\"[concat(12)]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(12), pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);

                const concat: TLE.FunctionCallValue = nonNullValue(TLE.asFunctionCallValue(pr.expression));
                assert.deepStrictEqual(concat.namespaceToken, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(11));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);

                const arg1: TLE.NumberValue = nonNullValue(TLE.asNumberValue(concat.argumentExpressions[0]));
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createNumber(9, "12"));
            });

            test("with user namespace and function with one number argument", () => {
                let pr = parseExpressionWithScope("\"[con.at(12)]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(12), pr.rightSquareBracketToken);
                assert.deepStrictEqual([], pr.errors);

                const concat: TLE.FunctionCallValue = nonNullValue(TLE.asFunctionCallValue(pr.expression));
                assert.deepStrictEqual(concat.namespaceToken, TLE.Token.createLiteral(2, "con"));
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(6, "at"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(11));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);

                const arg1: TLE.NumberValue = nonNullValue(TLE.asNumberValue(concat.argumentExpressions[0]));
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createNumber(9, "12"));
            });

            test("with function with no closing double quote or right square bracket", () => {
                let pr = parseExpressionWithScope("\"[concat()");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(8),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(9),
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(9, 1), "Expected a right square bracket (']').", tleSyntax)
                    ],
                    pr.errors);
            });

            test("with function with no closing right square bracket", () => {
                let pr = parseExpressionWithScope("\"[concat()\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(8),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(9),
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(undefined, pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(10, 1), "Expected a right square bracket (']').", tleSyntax)
                    ],
                    pr.errors);
            });

            test("with function with one string argument", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat('test')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(16));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(15));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                assert.deepStrictEqual(arg1!.parent, concat);
                assert.deepStrictEqual(arg1!.token, TLE.Token.createQuotedString(9, "'test'"));
            });

            test("with function with one string argument with square brackets", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat('test[]')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(18));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(17));
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                if (!arg1) { throw new Error("failed"); }
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'test[]'"));
            });

            test("with function with one string argument and a comma", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat('test',)]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(17));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(16, 1), "Expected a constant string, function, or property expression.", tleSyntax)
                    ]);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
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
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                if (!arg1) { throw new Error("failed"); }
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'test'"));
                const arg2: TLE.Value | undefined = concat.argumentExpressions[1];
                assert.deepStrictEqual(arg2, undefined);
            });

            test("with function with missing first argument and string second argument", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat(,'test')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(17));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(9, 1), "Expected a constant string, function, or property expression.", tleSyntax)
                    ]);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
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
                const arg1: TLE.Value | undefined = concat.argumentExpressions[0];
                assert.deepStrictEqual(arg1, undefined);
                const arg2: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[1]);
                if (!arg2) { throw new Error("failed"); }
                assert.deepStrictEqual(arg2.parent, concat);
                assert.deepStrictEqual(arg2.token, TLE.Token.createQuotedString(10, "'test'"));
            });

            test("with function with one missing argument and no right parenthesis", () => {
                let pr = parseExpressionWithScope("\"[concat('a1',");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, undefined);
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(13, 1), "Expected a constant string, function, or property expression.", tleSyntax),
                        new Language.Issue(new Language.Span(13, 1), "Expected a right square bracket (']').", tleSyntax)
                    ]);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(
                    concat.commaTokens,
                    [
                        TLE.Token.createComma(13)
                    ]);
                assert.deepStrictEqual(concat.rightParenthesisToken, undefined);
                assert.deepStrictEqual(concat.argumentExpressions.length, 2);
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                if (!arg1) { throw new Error("failed"); }
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'a1'"));
                const arg2: TLE.Value | undefined = concat.argumentExpressions[1];
                assert.deepStrictEqual(arg2, undefined);
            });

            test("with function with three missing arguments", () => {
                let pr = parseExpressionWithScope("\"[concat(,,)]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "concat"),
                        TLE.Token.createLeftParenthesis(8),
                        [TLE.Token.createComma(9), TLE.Token.createComma(10)],
                        [
                            undefined,
                            undefined,
                            undefined
                        ],
                        TLE.Token.createRightParenthesis(11),
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(12), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(9, 1), "Expected a constant string, function, or property expression.", tleSyntax),
                        new Language.Issue(new Language.Span(10, 1), "Expected a constant string, function, or property expression.", tleSyntax),
                        new Language.Issue(new Language.Span(11, 1), "Expected a constant string, function, or property expression.", tleSyntax)
                    ],
                    pr.errors);
            });

            test("with function with two arguments", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat('a', 'b')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(18));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
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
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                if (!arg1) { throw new Error("failed"); }
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'a'"));
                const arg2: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[1]);
                if (!arg2) { throw new Error("failed"); }
                assert.deepStrictEqual(arg2.parent, concat);
                assert.deepStrictEqual(arg2.token, TLE.Token.createQuotedString(14, "'b'"));
            });

            test("with function with three arguments", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat('a', 'b', 3)]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(21));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
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
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                if (!arg1) { throw new Error("failed"); }
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'a'"));
                const arg2: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[1]);
                if (!arg2) { throw new Error("failed"); }
                assert.deepStrictEqual(arg2.parent, concat);
                assert.deepStrictEqual(arg2.token, TLE.Token.createQuotedString(14, "'b'"));
                const arg3: TLE.NumberValue | undefined = TLE.asNumberValue(concat.argumentExpressions[2]);
                if (!arg3) { throw new Error("failed"); }
                assert.deepStrictEqual(arg3.parent, concat);
                assert.deepStrictEqual(arg3.token, TLE.Token.createNumber(19, "3"));
            });

            test("with function with function argument", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat('a', add(5, 7), 3)]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(27));
                assert.deepStrictEqual(pr.errors, []);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
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
                const concatArg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                if (!concatArg1) { throw new Error("failed"); }
                assert.deepStrictEqual(concatArg1.parent, concat);
                assert.deepStrictEqual(concatArg1.token, TLE.Token.createQuotedString(9, "'a'"));
                const concatArg2: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(concat.argumentExpressions[1]);
                if (!concatArg2) { throw new Error("failed"); }
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
                const addArg1: TLE.NumberValue | undefined = TLE.asNumberValue(concatArg2.argumentExpressions[0]);
                if (!addArg1) { throw new Error("failed"); }
                assert.deepStrictEqual(addArg1!.parent, concatArg2);
                assert.deepStrictEqual(addArg1!.token, TLE.Token.createNumber(18, "5"));
                const addArg2: TLE.NumberValue | undefined = TLE.asNumberValue(concatArg2.argumentExpressions[1]);
                assert(addArg2);
                assert.deepStrictEqual(addArg2!.parent, concatArg2);
                assert.deepStrictEqual(addArg2!.token, TLE.Token.createNumber(21, "7"));
                const concatArg3: TLE.NumberValue | undefined = TLE.asNumberValue(concat.argumentExpressions[2]);
                assert(concatArg3);
                assert.deepStrictEqual(concatArg3!.parent, concat);
                assert.deepStrictEqual(concatArg3!.token, TLE.Token.createNumber(25, "3"));
            });

            test("with function with single single-quote argument", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat(')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, undefined);
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(9, 3), "A constant string is missing an end quote.", tleSyntax),
                        new Language.Issue(new Language.Span(12, 1), "Expected a right square bracket (']').", tleSyntax)
                    ]);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
                assert.deepStrictEqual(concat!.parent, undefined);
                assert.deepStrictEqual(concat!.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat!.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat!.rightParenthesisToken, undefined);
                assert.deepStrictEqual(concat!.commaTokens, []);
                assert.deepStrictEqual(concat!.argumentExpressions.length, 1);
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat!.argumentExpressions[0]);
                if (!arg1) { throw new Error("failed"); }
                assert.deepStrictEqual(arg1!.parent, concat);
                assert.deepStrictEqual(arg1!.token, TLE.Token.createQuotedString(9, "')]"));
            });

            test("with function with missing comma between two arguments", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat('world'12)]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(19));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(16, 2), "Expected a comma (',').", tleSyntax),
                    ]);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
                assert.deepStrictEqual(concat!.parent, undefined);
                assert.deepStrictEqual(concat!.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat!.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat!.rightParenthesisToken, TLE.Token.createRightParenthesis(18));
                assert.deepStrictEqual(concat!.commaTokens, []);
                assert.deepStrictEqual(concat!.argumentExpressions.length, 1);
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                if (!arg1) { throw new Error("failed"); }
                assert.deepStrictEqual(arg1!.parent, concat);
                assert.deepStrictEqual(arg1!.token, TLE.Token.createQuotedString(9, "'world'"));
            });

            test("with function with missing comma between three arguments", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[concat('world'12'again')]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(26));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(16, 2), "Expected a comma (',').", tleSyntax),
                        new Language.Issue(new Language.Span(18, 7), "Expected a comma (',').", tleSyntax),
                    ]);

                const concat: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(pr.expression);
                if (!concat) { throw new Error("failed"); }
                assert.deepStrictEqual(concat.parent, undefined);
                assert.deepStrictEqual(concat.nameToken, TLE.Token.createLiteral(2, "concat"));
                assert.deepStrictEqual(concat.leftParenthesisToken, TLE.Token.createLeftParenthesis(8));
                assert.deepStrictEqual(concat.rightParenthesisToken, TLE.Token.createRightParenthesis(25));
                assert.deepStrictEqual(concat.commaTokens, []);
                assert.deepStrictEqual(concat.argumentExpressions.length, 1);
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(concat.argumentExpressions[0]);
                if (!arg1) { throw new Error("failed"); }
                assert.deepStrictEqual(arg1.parent, concat);
                assert.deepStrictEqual(arg1.token, TLE.Token.createQuotedString(9, "'world'"));
            });

            test("with property access", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[resourceGroup().name]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(22));
                assert.deepStrictEqual(pr.errors, []);

                const propertyAccess: TLE.PropertyAccess | undefined = TLE.asPropertyAccessValue(pr.expression);
                if (!propertyAccess) { throw new Error("failed"); }
                assert.deepStrictEqual(propertyAccess!.parent, undefined);
                assert.deepStrictEqual(propertyAccess!.nameToken, TLE.Token.createLiteral(18, "name"));
                assert.deepStrictEqual(propertyAccess!.periodToken, TLE.Token.createPeriod(17));
                const resourceGroup: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(propertyAccess.source);
                if (!resourceGroup) { throw new Error("failed"); }
                assert.deepStrictEqual(resourceGroup.parent, propertyAccess);
                assert.deepStrictEqual(resourceGroup.nameToken, TLE.Token.createLiteral(2, "resourceGroup"));
                assert.deepStrictEqual(resourceGroup.leftParenthesisToken, TLE.Token.createLeftParenthesis(15));
                assert.deepStrictEqual(resourceGroup.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(resourceGroup.commaTokens, []);
                assert.deepStrictEqual(resourceGroup.argumentExpressions, []);
            });

            test("with property access with missing period", () => {
                let pr = parseExpressionWithScope("\"[resourceGroup()name]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "resourceGroup"),
                        TLE.Token.createLeftParenthesis(15),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(16),
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(21), pr.rightSquareBracketToken);
                assert.deepStrictEqual([new Language.Issue(new Language.Span(17, 4), "Expected the end of the string.", tleSyntax)], pr.errors);
            });

            test("with quoted string instead of literal for property access", () => {
                const pr = parseExpressionWithScope("\"[resourceGroup().'name']\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(24));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(18, 6), "Expected a literal value.", tleSyntax)
                    ]);

                const propertyAccess: TLE.PropertyAccess | undefined = TLE.asPropertyAccessValue(pr.expression);
                if (!propertyAccess) { throw new Error("failed"); }
                assert.deepStrictEqual(propertyAccess.parent, undefined);
                assert.deepStrictEqual(propertyAccess.nameToken, undefined);
                assert.deepStrictEqual(propertyAccess.periodToken, TLE.Token.createPeriod(17));
                const resourceGroup: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(propertyAccess.source);
                if (!resourceGroup) { throw new Error("failed"); }
                assert.deepStrictEqual(resourceGroup.parent, propertyAccess);
                assert.deepStrictEqual(resourceGroup.nameToken, TLE.Token.createLiteral(2, "resourceGroup"));
                assert.deepStrictEqual(resourceGroup.leftParenthesisToken, TLE.Token.createLeftParenthesis(15));
                assert.deepStrictEqual(resourceGroup.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(resourceGroup.commaTokens, []);
                assert.deepStrictEqual(resourceGroup.argumentExpressions, []);
            });

            test("with property access with missing property name", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[resourceGroup().]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(18));
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(18, 1), "Expected a literal value.", tleSyntax)
                    ]);

                const propertyAccess: TLE.PropertyAccess | undefined = TLE.asPropertyAccessValue(pr.expression);
                if (!propertyAccess) { throw new Error("failed"); }
                assert.deepStrictEqual(propertyAccess.parent, undefined);
                assert.deepStrictEqual(propertyAccess.nameToken, undefined);
                assert.deepStrictEqual(propertyAccess.periodToken, TLE.Token.createPeriod(17));
                const resourceGroup: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(propertyAccess.source);
                if (!resourceGroup) { throw new Error("failed"); }
                assert.deepStrictEqual(resourceGroup.parent, propertyAccess);
                assert.deepStrictEqual(resourceGroup.nameToken, TLE.Token.createLiteral(2, "resourceGroup"));
                assert.deepStrictEqual(resourceGroup.leftParenthesisToken, TLE.Token.createLeftParenthesis(15));
                assert.deepStrictEqual(resourceGroup.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(resourceGroup.commaTokens, []);
                assert.deepStrictEqual(resourceGroup.argumentExpressions, []);
            });

            test("with a two-deep property access", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[resourceGroup().name.length]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(29));
                assert.deepStrictEqual([], pr.errors);

                const length: TLE.PropertyAccess | undefined = TLE.asPropertyAccessValue(pr.expression);
                if (!length) { throw new Error("failed"); }
                assert.deepStrictEqual(length.parent, undefined);
                assert.deepStrictEqual(length.nameToken, TLE.Token.createLiteral(23, "length"));
                assert.deepStrictEqual(length.periodToken, TLE.Token.createPeriod(22));
                const name: TLE.PropertyAccess | undefined = TLE.asPropertyAccessValue(length.source);
                if (!name) { throw new Error("failed"); }
                assert.deepStrictEqual(name.parent, length);
                assert.deepStrictEqual(name.nameToken, TLE.Token.createLiteral(18, "name"));
                assert.deepStrictEqual(name.periodToken, TLE.Token.createPeriod(17));
                const resourceGroup: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(name.source);
                if (!resourceGroup) { throw new Error("failed"); }
                assert.deepStrictEqual(resourceGroup.parent, name);
                assert.deepStrictEqual(resourceGroup.nameToken, TLE.Token.createLiteral(2, "resourceGroup"));
                assert.deepStrictEqual(resourceGroup.leftParenthesisToken, TLE.Token.createLeftParenthesis(15));
                assert.deepStrictEqual(resourceGroup.rightParenthesisToken, TLE.Token.createRightParenthesis(16));
                assert.deepStrictEqual(resourceGroup.commaTokens, []);
                assert.deepStrictEqual(resourceGroup.argumentExpressions, []);
            });

            test("with array access", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[variables('a')[15]]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(20));
                assert.deepStrictEqual(pr.errors, []);

                const arrayAccess: TLE.ArrayAccessValue | undefined = TLE.asArrayAccessValue(pr.expression);
                if (!arrayAccess) { throw new Error("failed"); }
                assert.deepStrictEqual(arrayAccess.rightSquareBracketToken, TLE.Token.createRightSquareBracket(19));
                const index: TLE.NumberValue | undefined = TLE.asNumberValue(arrayAccess.indexValue);
                assert(index);
                assert.deepStrictEqual(index!.parent, arrayAccess);
                assert.deepStrictEqual(index!.token, TLE.Token.createNumber(17, "15"));
                assert.deepStrictEqual(arrayAccess.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(16));
                const variables: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(arrayAccess.source);
                if (!variables) { throw new Error("failed"); }
                assert.deepStrictEqual(variables.parent, arrayAccess);
                assert.deepStrictEqual(variables.nameToken, TLE.Token.createLiteral(2, "variables"));
                assert.deepStrictEqual(variables.leftParenthesisToken, TLE.Token.createLeftParenthesis(11));
                assert.deepStrictEqual(variables.rightParenthesisToken, TLE.Token.createRightParenthesis(15));
                assert.deepStrictEqual(variables.commaTokens, []);
                assert.deepStrictEqual(variables.argumentExpressions.length, 1);
                const arg1: TLE.StringValue | undefined = TLE.asStringValue(variables.argumentExpressions[0]);
                assert.deepStrictEqual(arg1!.parent, variables);
                assert.deepStrictEqual(arg1!.token, TLE.Token.createQuotedString(12, "'a'"));
            });

            test("with two array accesses", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[variables('a')[15]['fido']]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(28));
                assert.deepStrictEqual(pr.errors, []);

                const arrayAccess1: TLE.ArrayAccessValue | undefined = TLE.asArrayAccessValue(pr.expression);
                if (!arrayAccess1) { throw new Error("failed"); }
                assert.deepStrictEqual(arrayAccess1.rightSquareBracketToken, TLE.Token.createRightSquareBracket(27));
                assert.deepStrictEqual(arrayAccess1.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(20));
                const fido: TLE.StringValue | undefined = TLE.asStringValue(arrayAccess1.indexValue);
                if (!fido) { throw new Error("failed"); }
                assert.deepStrictEqual(fido.parent, arrayAccess1);
                assert.deepStrictEqual(fido.token, TLE.Token.createQuotedString(21, "'fido'"));
                const arrayAccess2: TLE.ArrayAccessValue | undefined = TLE.asArrayAccessValue(arrayAccess1.source);
                if (!arrayAccess2) { throw new Error("failed"); }
                assert.deepStrictEqual(arrayAccess2.parent, arrayAccess1);
                assert.deepStrictEqual(arrayAccess2.rightSquareBracketToken, TLE.Token.createRightSquareBracket(19));
                assert.deepStrictEqual(arrayAccess2.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(16));
                const fifteen: TLE.NumberValue | undefined = TLE.asNumberValue(arrayAccess2.indexValue);
                if (!fifteen) { throw new Error("failed"); }
                assert.deepStrictEqual(fifteen.parent, arrayAccess2);
                assert.deepStrictEqual(fifteen.token, TLE.Token.createNumber(17, "15"));
                const variables: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(arrayAccess2.source);
                if (!variables) { throw new Error("failed"); }
                assert.deepStrictEqual(variables.parent, arrayAccess2);
                assert.deepStrictEqual(variables.nameToken, TLE.Token.createLiteral(2, "variables"));
                assert.deepStrictEqual(variables.leftParenthesisToken, TLE.Token.createLeftParenthesis(11));
                assert.deepStrictEqual(variables.rightParenthesisToken, TLE.Token.createRightParenthesis(15));
                assert.deepStrictEqual(variables.commaTokens, []);
                assert.deepStrictEqual(variables.argumentExpressions.length, 1);
                const a: TLE.StringValue | undefined = TLE.asStringValue(variables.argumentExpressions[0]);
                if (!a) { throw new Error("failed"); }
                assert.deepStrictEqual(a.parent, variables);
                assert.deepStrictEqual(a.token, TLE.Token.createQuotedString(12, "'a'"));
            });

            test("with array access with function index", () => {
                const pr: TLE.ParseResult = parseExpressionWithScope("\"[variables('a')[add(12,3)]]\"");
                assert(pr);
                assert.deepStrictEqual(pr.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(1));
                assert.deepStrictEqual(pr.rightSquareBracketToken, TLE.Token.createRightSquareBracket(27));
                assert.deepStrictEqual(pr.errors, []);

                const arrayAccess: TLE.ArrayAccessValue | undefined = TLE.asArrayAccessValue(pr.expression);
                if (!arrayAccess) { throw new Error("failed"); }
                assert.deepStrictEqual(arrayAccess.parent, undefined);
                assert.deepStrictEqual(arrayAccess.rightSquareBracketToken, TLE.Token.createRightSquareBracket(26));
                assert.deepStrictEqual(arrayAccess.leftSquareBracketToken, TLE.Token.createLeftSquareBracket(16));
                const add: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(arrayAccess.indexValue);
                if (!add) { throw new Error("failed"); }
                assert.deepStrictEqual(add.parent, arrayAccess);
                assert.deepStrictEqual(add.nameToken, TLE.Token.createLiteral(17, "add"));
                assert.deepStrictEqual(add.leftParenthesisToken, TLE.Token.createLeftParenthesis(20));
                assert.deepStrictEqual(add.rightParenthesisToken, TLE.Token.createRightParenthesis(25));
                assert.deepStrictEqual(
                    add.commaTokens,
                    [TLE.Token.createComma(23)]);
                assert.deepStrictEqual(add.argumentExpressions.length, 2);
                const addArg1: TLE.NumberValue | undefined = TLE.asNumberValue(add.argumentExpressions[0]);
                assert.deepStrictEqual(addArg1!.parent, add);
                assert.deepStrictEqual(addArg1!.token, TLE.Token.createNumber(21, "12"));
                const addArg2: TLE.NumberValue | undefined = TLE.asNumberValue(add.argumentExpressions[1]);
                assert.deepStrictEqual(addArg2!.parent, add);
                assert.deepStrictEqual(addArg2!.token, TLE.Token.createNumber(24, "3"));
                const variables: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(arrayAccess.source);
                if (!variables) { throw new Error("failed"); }
                assert.deepStrictEqual(variables.parent, arrayAccess);
                assert.deepStrictEqual(variables.nameToken, TLE.Token.createLiteral(2, "variables"));
                assert.deepStrictEqual(variables.leftParenthesisToken, TLE.Token.createLeftParenthesis(11));
                assert.deepStrictEqual(variables.rightParenthesisToken, TLE.Token.createRightParenthesis(15));
                assert.deepStrictEqual(variables.commaTokens, []);
                assert.deepStrictEqual(variables.argumentExpressions.length, 1);
                const a: TLE.StringValue | undefined = TLE.asStringValue(variables.argumentExpressions[0]);
                if (!a) { throw new Error("failed"); }
                assert.deepStrictEqual(a.parent, variables);
                assert.deepStrictEqual(a.token, TLE.Token.createQuotedString(12, "'a'"));
            });

            test("with function after string", () => {
                let pr = parseExpressionWithScope("\"[hello()'world']\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "hello"),
                        TLE.Token.createLeftParenthesis(7),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(8),
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(16), pr.rightSquareBracketToken);
                assert.deepStrictEqual([new Language.Issue(new Language.Span(9, 7), "Expected the end of the string.", tleSyntax)], pr.errors);
            });

            test("with function after string", () => {
                let pr = parseExpressionWithScope("\"[hello'world'()]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "hello"),
                        TLE.Token.createLeftParenthesis(14),
                        [],
                        [],
                        TLE.Token.createRightParenthesis(15),
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(16), pr.rightSquareBracketToken);
                assert.deepStrictEqual([new Language.Issue(new Language.Span(7, 7), "Expected the end of the string.", tleSyntax)], pr.errors);
            });

            test("with string followed by literal", () => {
                let pr = parseExpressionWithScope("\"['world'hello]\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(9, "hello"),
                        undefined,
                        [],
                        [],
                        undefined,
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(14), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(2, 7), "Expected a literal value.", tleSyntax),
                        new Language.Issue(new Language.Span(9, 5), "Missing function argument list.", tleSyntax),
                    ],
                    pr.errors);
            });

            test("with literal followed by string", () => {
                let pr = parseExpressionWithScope("\"[hello'world']\"");
                assert(pr);
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), pr.leftSquareBracketToken);
                assert.deepStrictEqual(
                    new TLE.FunctionCallValue(
                        undefined,
                        undefined,
                        TLE.Token.createLiteral(2, "hello"),
                        undefined,
                        [],
                        [],
                        undefined,
                        pr.scope),
                    pr.expression);
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(14), pr.rightSquareBracketToken);
                assert.deepStrictEqual(
                    [
                        new Language.Issue(new Language.Span(7, 7), "Expected the end of the string.", tleSyntax),
                        new Language.Issue(new Language.Span(2, 5), "Missing function argument list.", tleSyntax),
                    ],
                    pr.errors);
            });

            test(`with "[concat(parameters('_artifactsLocation'), '/', '/scripts/azuremysql.sh', parameters('_artifactsLocationSasToken'))], )]"`, () => {
                const pr = parseExpressionWithScope(`"[concat(parameters('_artifactsLocation'), '/', '/scripts/azuremysql.sh', parameters('_artifactsLocationSasToken'))], )]"`);
                assert.deepStrictEqual(
                    pr.errors,
                    [
                        new Language.Issue(new Language.Span(116, 1), "Nothing should exist after the closing ']' except for whitespace.", tleSyntax),
                        new Language.Issue(new Language.Span(118, 1), "Nothing should exist after the closing ']' except for whitespace.", tleSyntax),
                        new Language.Issue(new Language.Span(119, 1), "Nothing should exist after the closing ']' except for whitespace.", tleSyntax)
                    ]);
            });
        });
    });

    suite("Token", () => {
        suite("createLeftParenthesis(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createLeftParenthesis(-1);
                assert.equal(TLE.TokenType.LeftParenthesis, t.getType());
                assert.deepStrictEqual(new Language.Span(-1, 1), t.span);
                assert.equal("(", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createLeftParenthesis(0);
                assert.equal(TLE.TokenType.LeftParenthesis, t.getType());
                assert.deepStrictEqual(new Language.Span(0, 1), t.span);
                assert.equal("(", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createLeftParenthesis(7);
                assert.equal(TLE.TokenType.LeftParenthesis, t.getType());
                assert.deepStrictEqual(new Language.Span(7, 1), t.span);
                assert.equal("(", t.stringValue);
            });
        });

        suite("createRightParenthesis(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createRightParenthesis(-1);
                assert.equal(TLE.TokenType.RightParenthesis, t.getType());
                assert.deepStrictEqual(new Language.Span(-1, 1), t.span);
                assert.equal(")", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createRightParenthesis(0);
                assert.equal(TLE.TokenType.RightParenthesis, t.getType());
                assert.deepStrictEqual(new Language.Span(0, 1), t.span);
                assert.equal(")", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createRightParenthesis(7);
                assert.equal(TLE.TokenType.RightParenthesis, t.getType());
                assert.deepStrictEqual(new Language.Span(7, 1), t.span);
                assert.equal(")", t.stringValue);
            });
        });

        suite("createLeftSquareBracket(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createLeftSquareBracket(-1);
                assert.equal(TLE.TokenType.LeftSquareBracket, t.getType());
                assert.deepStrictEqual(new Language.Span(-1, 1), t.span);
                assert.equal("[", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createLeftSquareBracket(0);
                assert.equal(TLE.TokenType.LeftSquareBracket, t.getType());
                assert.deepStrictEqual(new Language.Span(0, 1), t.span);
                assert.equal("[", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createLeftSquareBracket(7);
                assert.equal(TLE.TokenType.LeftSquareBracket, t.getType());
                assert.deepStrictEqual(new Language.Span(7, 1), t.span);
                assert.equal("[", t.stringValue);
            });
        });

        suite("createRightSquareBracket(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createRightSquareBracket(-1);
                assert.equal(TLE.TokenType.RightSquareBracket, t.getType());
                assert.deepStrictEqual(new Language.Span(-1, 1), t.span);
                assert.equal("]", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createRightSquareBracket(0);
                assert.equal(TLE.TokenType.RightSquareBracket, t.getType());
                assert.deepStrictEqual(new Language.Span(0, 1), t.span);
                assert.equal("]", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createRightSquareBracket(7);
                assert.equal(TLE.TokenType.RightSquareBracket, t.getType());
                assert.deepStrictEqual(new Language.Span(7, 1), t.span);
                assert.equal("]", t.stringValue);
            });
        });

        suite("createComma(number)", () => {
            test("Negative startIndex", () => {
                let t = TLE.Token.createComma(-1);
                assert.equal(TLE.TokenType.Comma, t.getType());
                assert.deepStrictEqual(new Language.Span(-1, 1), t.span);
                assert.equal(",", t.stringValue);
            });

            test("Zero startIndex", () => {
                let t = TLE.Token.createComma(0);
                assert.equal(TLE.TokenType.Comma, t.getType());
                assert.deepStrictEqual(new Language.Span(0, 1), t.span);
                assert.equal(",", t.stringValue);
            });

            test("Positive startIndex", () => {
                let t = TLE.Token.createComma(7);
                assert.equal(TLE.TokenType.Comma, t.getType());
                assert.deepStrictEqual(new Language.Span(7, 1), t.span);
                assert.equal(",", t.stringValue);
            });
        });
    });

    suite("Tokenizer", () => {
        suite("readToken()", () => {
            test("with undefined stringValue", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { TLE.Tokenizer.fromString(<any>undefined); });
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
                assert.equal(undefined, tt.readToken());
            });

            test("with empty TLE object with whitespace inside", () => {
                let tt = TLE.Tokenizer.fromString("\"[ ]\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(2, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(3), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with comma", () => {
                let tt = TLE.Tokenizer.fromString("\",\"");
                assert.deepStrictEqual(TLE.Token.createComma(1), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with whitespace", () => {
                let tt = TLE.Tokenizer.fromString("\" \r\n\t \"");
                assert.deepStrictEqual(TLE.Token.createWhitespace(1, " \r\n\t "), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with double-quoted empty string", () => {
                let tt = TLE.Tokenizer.fromString("\"\"");
                assert.equal(undefined, tt.readToken());
            });

            test("with escaped single-quoted empty string", () => {
                let tt = TLE.Tokenizer.fromString("\"\'\'\"");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "\'\'"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with unescaped single-quoted empty string", () => {
                let tt = TLE.Tokenizer.fromString("\"''\"");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "''"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with unterminated double-quoted string", () => {
                let tt = TLE.Tokenizer.fromString("'\"hello'");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "\"hello"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with unterminated single-quoted string", () => {
                let tt = TLE.Tokenizer.fromString("\"\'hello\"");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "\'hello"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with double-quoted string with escaped back-slash inside", () => {
                let tt = TLE.Tokenizer.fromString("\"'C:\\\\Users\\\\'\"");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "'C:\\\\Users\\\\'"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with double-quoted string with escaped double-quote inside", () => {
                let tt = TLE.Tokenizer.fromString("'\"hello\\\"there\"'");
                assert.deepStrictEqual(TLE.Token.createQuotedString(1, "\"hello\\\"there\""), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with zero", () => {
                let tt = TLE.Tokenizer.fromString("'0'");
                assert.deepStrictEqual(TLE.Token.createNumber(1, "0"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with positive number", () => {
                let tt = TLE.Tokenizer.fromString("\"123\"");
                assert.deepStrictEqual(TLE.Token.createNumber(1, "123"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with negative number", () => {
                let tt = TLE.Tokenizer.fromString("'-456");
                assert.deepStrictEqual(TLE.Token.createNumber(1, "-456"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with floating-point number", () => {
                let tt = TLE.Tokenizer.fromString("\"7.8\"");
                assert.deepStrictEqual(TLE.Token.createNumber(1, "7.8"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with expression with single constant string", () => {
                let tt = TLE.Tokenizer.fromString("\"[ 'apples']\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(2, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(3, "'apples'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(11), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with true", () => {
                let tt = TLE.Tokenizer.fromString("'true'");
                assert.deepStrictEqual(TLE.Token.createLiteral(1, "true"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with value that starts with '.'", () => {
                let tt = TLE.Tokenizer.fromString("\". hello there\"");
                assert.deepStrictEqual(TLE.Token.createPeriod(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(2, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(3, "hello"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(8, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(9, "there"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with literal that ends with a number", () => {
                let tt = TLE.Tokenizer.fromString("\"base64\"");
                assert.deepStrictEqual(TLE.Token.createLiteral(1, "base64"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with several invalid literals", () => {
                let tt = TLE.Tokenizer.fromString("\".[]82348923asdglih   asl .,'\"");
                assert.deepStrictEqual(TLE.Token.createPeriod(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(2), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(3), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createNumber(4, "82348923"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(12, "asdglih"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(19, "   "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(22, "asl"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createWhitespace(25, " "), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createPeriod(26), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createComma(27), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(28, "'"), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with function TLE with no arguments", () => {
                let tt = TLE.Tokenizer.fromString("'[concat()]'");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "concat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(9), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(10), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with user-defined function TLE with no arguments", () => {
                let tt = TLE.Tokenizer.fromString("'[co.cat()]'");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "co"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createPeriod(4), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(5, "cat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(9), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(10), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with user-defined function TLE with no arguments and with name matching a built-in function", () => {
                let tt = TLE.Tokenizer.fromString("'[co.sum()]'");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "co"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createPeriod(4), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(5, "sum"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(9), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(10), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with function TLE with no arguments with no closing right square bracket", () => {
                let tt = TLE.Tokenizer.fromString("'[concat()'");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "concat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(9), tt.readToken());
                assert.equal(undefined, tt.readToken());
            });

            test("with function TLE with one argument", () => {
                let tt = TLE.Tokenizer.fromString("\"[concat('Seattle')]\"");
                assert.deepStrictEqual(TLE.Token.createLeftSquareBracket(1), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLiteral(2, "concat"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createLeftParenthesis(8), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createQuotedString(9, "'Seattle'"), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightParenthesis(18), tt.readToken());
                assert.deepStrictEqual(TLE.Token.createRightSquareBracket(19), tt.readToken());
                assert.equal(undefined, tt.readToken());
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
                assert.equal(undefined, tt.readToken());
            });

            suite("Quoted TLE strings", () => {
                test("simple string", () => {
                    let tt = TLE.Tokenizer.fromString("\"['Seattle']\"");
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createLeftSquareBracket(1));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createQuotedString(2, "'Seattle'"));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createRightSquareBracket(11));
                    assert.equal(tt.readToken(), undefined);
                });

                test("empty string", () => {
                    let tt = TLE.Tokenizer.fromString("\"['']\"");
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createLeftSquareBracket(1));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createQuotedString(2, "''"));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createRightSquareBracket(4));
                    assert.equal(tt.readToken(), undefined);
                });

                test("string with just escaped apostrophe", () => {
                    let tt = TLE.Tokenizer.fromString("\"['''']\"");
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createLeftSquareBracket(1));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createQuotedString(2, "''''"));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createRightSquareBracket(6));
                    assert.equal(tt.readToken(), undefined);
                });

                test("with single escaped apostrophe", () => {
                    let tt = TLE.Tokenizer.fromString("\"['That''s all, folks!']\"");
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createLeftSquareBracket(1));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createQuotedString(2, "'That''s all, folks!'"));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createRightSquareBracket(23));
                    assert.equal(tt.readToken(), undefined);
                });

                test("with double escaped apostrophes", () => {
                    let tt = TLE.Tokenizer.fromString("\"['That''''s all, folks!']\"");
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createLeftSquareBracket(1));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createQuotedString(2, "'That''''s all, folks!'"));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createRightSquareBracket(25));
                    assert.equal(tt.readToken(), undefined);
                });

                test("with multiple escaped apostrophes", () => {
                    let tt = TLE.Tokenizer.fromString("\"['That''s all, ''folks''!']\"");
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createLeftSquareBracket(1));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createQuotedString(2, "'That''s all, ''folks''!'"));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createRightSquareBracket(27));
                    assert.equal(tt.readToken(), undefined);
                });

                test("with escaped apostrophes at beginning and end of expression", () => {
                    let tt = TLE.Tokenizer.fromString("\"['''That is all, folks!''']\"");
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createLeftSquareBracket(1));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createQuotedString(2, "'''That is all, folks!'''"));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createRightSquareBracket(27));
                    assert.equal(tt.readToken(), undefined);
                });

                test("with double quote", () => {
                    let tt = TLE.Tokenizer.fromString("\"['That is \"all\", folks!']\"");
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createLeftSquareBracket(1));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createQuotedString(2, "'That is \"all\", folks!'"));
                    assert.deepStrictEqual(tt.readToken(), TLE.Token.createRightSquareBracket(25));
                    assert.equal(tt.readToken(), undefined);
                });

                test("https://github.com/Microsoft/vscode-azurearmtools/issues/34", () => {
                    let tt = TLE.Tokenizer.fromString("\"[concat(reference(parameters('publicIpName')).dnsSettings.fqdn, ';  sudo docker volume rm ''dockercompose_cert-volume''; sudo docker-compose up')]\"");
                    let expected = [
                        "[",
                        "concat",
                        "(",
                        "reference",
                        "(",
                        "parameters",
                        "(",
                        "'publicIpName'",
                        ")",
                        ")",
                        ".",
                        "dnsSettings",
                        ".",
                        "fqdn",
                        ",",
                        " ",
                        "';  sudo docker volume rm ''dockercompose_cert-volume''; sudo docker-compose up'",
                        ")",
                        "]"
                    ];
                    for (let expectedToken of expected) {
                        assert.deepStrictEqual(tt.readToken()!.stringValue, expectedToken);
                    }
                    assert.equal(tt.readToken(), undefined);
                });
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
                assert.equal(undefined, tt.readToken());
            });
        });
    });

    suite("UnrecognizedFunctionVisitor", () => {
        suite("visit(tle.Value)", () => {
            const functionMetadata: FunctionsMetadata = new FunctionsMetadata([new BuiltinFunctionMetadata("CONCAT", "", "", 1, 2, [])]);

            test("with recognized function", () => {
                const tleParseResult = parseExpressionWithScope("'[concat()]'");
                const visitor = UnrecognizedFunctionVisitor.visit(tleParseResult.scope, tleParseResult.expression, functionMetadata);
                assert(visitor);
                assert.deepStrictEqual([], visitor.errors);
            });

            test("with unrecognized function", () => {
                const tleParseResult = parseExpressionWithScope("'[concatenate()]'");
                const visitor = UnrecognizedFunctionVisitor.visit(tleParseResult.scope, tleParseResult.expression, functionMetadata);
                assert(visitor);
                assert.deepStrictEqual(
                    [
                        new UnrecognizedBuiltinFunctionIssue(new Language.Span(2, 11), "concatenate")
                    ],
                    visitor.errors);
                assert.equal(visitor.errors[0].message, "Unrecognized function name 'concatenate'.");
            });
        });
    });

    suite("IncorrectFunctionArgumentCountVisitor", () => {
        suite("visit(tle.Value, FunctionsMetadata)", () => {
            const functions = AzureRMAssets.getFunctionsMetadata();

            test("with undefined value", () => {
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(undefined, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with undefined value", () => {
                // tslint:disable-next-line:no-any
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(<any>undefined, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with number value", () => {
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(new TLE.NumberValue(TLE.Token.createNumber(17, "3")), functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with concat() with zero arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[concat()]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with concat() with one argument", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[concat(12)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with concat() with two arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[concat(12, 'test')]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with add() with zero arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[add()]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new IncorrectArgumentsCountIssue(new Language.Span(2, 5), "The function 'add' takes 2 arguments.", "add", 0, 2, 2)]);
            });

            test("with add() with one argument", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[add(5)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new IncorrectArgumentsCountIssue(new Language.Span(2, 6), "The function 'add' takes 2 arguments.", "add", 1, 2, 2)]);
            });

            test("with add() with two arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[add(5, 6)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with add() with three arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[add(5, 6, 7)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new IncorrectArgumentsCountIssue(new Language.Span(2, 12), "The function 'add' takes 2 arguments.", "add", 3, 2, 2)]);
            });

            test("with add() with three arguments and different casing", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[Add(5, 6, 7)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new IncorrectArgumentsCountIssue(new Language.Span(2, 12), "The function 'add' takes 2 arguments.", "add", 3, 2, 2)]);
            });

            test("with resourceId() with zero arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[resourceId()]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    // tslint:disable-next-line:no-any
                    [new IncorrectArgumentsCountIssue(new Language.Span(2, 12), "The function 'resourceId' takes at least 2 arguments.", "resourceId", 0, 2, <any>undefined)]);
            });

            test("with resourceId() with one argument", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[resourceId(5)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    // tslint:disable-next-line:no-any
                    [new IncorrectArgumentsCountIssue(new Language.Span(2, 13), "The function 'resourceId' takes at least 2 arguments.", "resourceId", 1, 2, <any>undefined)]);
            });

            test("with resourceId() with two arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[resourceId(5, 6)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with resourceId() with three arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[resourceId(5, 6, 7)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with substring() with zero arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[substring()]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new IncorrectArgumentsCountIssue(new Language.Span(2, 11), "The function 'substring' takes between 1 and 3 arguments.", "substring", 0, 1, 3)]);
            });

            test("with substring() with one argument", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[substring('abc')]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with substring() with two arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[substring('abc', 1)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with substring() with three arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[substring('abc', 1, 1)]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(visitor.errors, []);
            });

            test("with substring() with four arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[substring('abc', 1, 1, 'blah')]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new IncorrectArgumentsCountIssue(new Language.Span(2, 30), "The function 'substring' takes between 1 and 3 arguments.", "substring", 4, 1, 3)]);
            });

            test("user function with name matching a built-in, with zero arguments", () => {
                const concat: TLE.Value = nonNullValue(parseExpressionWithScope(`"[Contoso.resourceId()]"`).expression);
                const visitor = IncorrectFunctionArgumentCountVisitor.visit(concat, functions);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.errors,
                    []
                );
            });
        });
    });

    suite("UndefinedVariablePropertyVisitor", () => {
        suite("visitPropertyAccess(TLE.PropertyAccess)", () => {
            test("with child property access from undefined variable reference", () => {
                const dt = new DeploymentTemplate(`{ "a": "[variables('v1').apples]" }`, fakeId);
                const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[variables('v1').app`.length, undefined);
                const visitor = UndefinedVariablePropertyVisitor.visit(context.tleInfo!.tleValue, dt.topLevelScope);
                assert.deepStrictEqual(visitor.errors, [], "No errors should be reported for a property access to an undefined variable, because the top priority error for the developer to address is the undefined variable reference.");
            });

            test("with grandchild property access from undefined variable reference", () => {
                const dt = new DeploymentTemplate(`{ "a": "[variables('v1').apples.bananas]" }`, fakeId);
                const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "a": "[variables('v1').apples.ban`.length, undefined);
                const visitor = UndefinedVariablePropertyVisitor.visit(context.tleInfo!.tleValue, dt.topLevelScope);
                assert.deepStrictEqual(visitor.errors, [], "No errors should be reported for a property access to an undefined variable, because the top priority error for the developer to address is the undefined variable reference.");
            });

            test("with child property access from variable reference to non-object variable", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "v1": "blah" }, "a": "[variables('v1').apples]" }`, fakeId);
                const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "variables": { "v1": "blah" }, "a": "[variables('v1').app`.length, undefined);
                const visitor = UndefinedVariablePropertyVisitor.visit(context.tleInfo!.tleValue, dt.topLevelScope);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new Language.Issue(new Language.Span(18, 6), `Property "apples" is not a defined property of "variables('v1')".`, IssueKind.undefinedVarProp)]);
            });

            test("with grandchild property access from variable reference to non-object variable", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "v1": "blah" }, "a": "[variables('v1').apples.bananas]" }`, fakeId);
                const context: TemplatePositionContext = dt.getContextFromDocumentCharacterIndex(`{ "variables": { "v1": "blah" }, "a": "[variables('v1').apples.ban`.length, undefined);
                const visitor = UndefinedVariablePropertyVisitor.visit(context.tleInfo!.tleValue, dt.topLevelScope);
                assert.deepStrictEqual(
                    visitor.errors,
                    [new Language.Issue(new Language.Span(18, 6), `Property "apples" is not a defined property of "variables('v1')".`, IssueKind.undefinedVarProp)]);
            });
        });
    });

    suite("FindReferencesVisitor", () => {
        const template: Partial<IDeploymentTemplate> = {
            parameters: {
                pName: {
                    type: "securestring"
                }
            },
            outputs: {
                o1: {
                    type: "securestring",
                    value: "[parameters('pName')]"
                }
            }
        };
        const metadata = AzureRMAssets.getFunctionsMetadata();

        suite("visit(tle.Value,string,string)", () => {
            test("with undefined TLE", async () => {
                const dt = await parseTemplate(template);
                const param = dt.topLevelScope.getParameterDefinition("pName")!;
                assert(param);
                const visitor = FindReferencesVisitor.visit(undefined, param, metadata);
                assert(visitor);
                assert.deepStrictEqual(visitor.references, new ReferenceList(DefinitionKind.Parameter));
            });

            test("with undefined TLE", async () => {
                const dt = await parseTemplate(template);
                const param = dt.topLevelScope.getParameterDefinition("pName")!;
                assert(param);
                // tslint:disable-next-line:no-any
                const visitor = FindReferencesVisitor.visit(<any>undefined, param, metadata);
                assert(visitor);
                assert.deepStrictEqual(visitor.references, new ReferenceList(DefinitionKind.Parameter));
            });

            test("with TLE", async () => {
                const dt = await parseTemplate(template);
                const param = dt.topLevelScope.getParameterDefinition("pName")!;
                assert(param);
                const pr: TLE.ParseResult = parseExpressionWithScope(`"[parameters('pName')]"`, dt.topLevelScope);
                const visitor = FindReferencesVisitor.visit(pr.expression, param, metadata);
                assert(visitor);
                assert.deepStrictEqual(
                    visitor.references,
                    new ReferenceList(DefinitionKind.Parameter, [new Language.Span(14, 5)]));
            });
        });
    });
});
