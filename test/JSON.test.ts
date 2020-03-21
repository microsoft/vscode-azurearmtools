// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length align no-non-null-assertion

import * as assert from "assert";
import { basic, Json, Language, Utilities } from "../extension.bundle";

/**
 * Convert the provided text string into a sequence of basic Tokens.
 */
export function parseBasicTokens(text: string): basic.Token[] {
    const result: basic.Token[] = [];

    const tokenizer = new basic.Tokenizer(text);
    while (tokenizer.moveNext()) {
        result.push(tokenizer.current()!);
    }

    return result;
}
/**
 * Parse the provided text into a JSON Number token.
 */
export function parseNumber(text: string, startIndex: number = 0): Json.Token {
    return Json.Number(startIndex, parseBasicTokens(text));
}

/**
 * Parse the provided text into a JSON Whitespace token.
 */
export function parseWhitespace(text: string, startIndex: number = 0): Json.Token {
    return Json.Whitespace(startIndex, parseBasicTokens(text));
}

/**
 * Parse the provided text into a JSON QuotedString token.
 */
export function parseQuotedString(text: string, startIndex: number = 0): Json.Token {
    return Json.QuotedString(startIndex, parseBasicTokens(text));
}

/**
 * Parse the provided text into a JSON Literal token.
 */
export function parseLiteral(text: string, startIndex: number = 0): Json.Token {
    return Json.Literal(startIndex, parseBasicTokens(text));
}

/**
 * Parse the provided text into a JSON Boolean token.
 */
export function parseBoolean(text: string, startIndex: number = 0): Json.Token {
    const basicTokens: basic.Token[] = parseBasicTokens(text);
    assert.deepStrictEqual(basicTokens.length, 1, "Wrong basic tokens length.");
    return Json.Boolean(startIndex, basicTokens[0]);
}

/**
 * Parse the provided text into a JSON Unrecognized token.
 */
export function parseUnrecognized(text: string, startIndex: number = 0): Json.Token {
    const basicTokens: basic.Token[] = parseBasicTokens(text);
    assert.deepStrictEqual(basicTokens.length, 1, "Wrong basic tokens length.");
    return Json.Unrecognized(startIndex, basicTokens[0]);
}

/**
 * Parse the provided text into a JSON Comment token.
 */
export function parseComment(text: string, startIndex: number = 0): Json.Token {
    return Json.Comment(startIndex, parseBasicTokens(text));
}

suite("JSON", () => {
    suite("ParseResult", () => {
        suite("tokenCount", () => {
            test("with 0 tokens", () => {
                assert.deepStrictEqual(0, Json.parse("").tokenCount);
            });

            test("with 1 token", () => {
                let pr = Json.parse("true");
                assert(pr);
                assert.deepStrictEqual(1, pr.tokenCount);
            });

            test("with 2 tokens", () => {
                let pr = Json.parse("[]");
                assert(pr);
                assert.deepStrictEqual(2, pr.tokenCount);
            });
        });

        suite("getCharacterIndex(number,number)", () => {
            test("with negative line index", () => {
                let pr = Json.parse("");
                assert.throws(() => { pr.getCharacterIndex(-1, 0); });
            });

            test("with negative column index", () => {
                let pr = Json.parse("");
                assert.throws(() => { pr.getCharacterIndex(0, -1); });
            });

            test("with line index greater than input string line count", () => {
                let pr = Json.parse("hello there");
                assert.throws(() => { pr.getCharacterIndex(1, 0); });
            });

            test("with column index greater than input string column length", () => {
                let pr = Json.parse("hello there");
                assert.throws(() => {
                    pr.getCharacterIndex(0, "hello there".length + 1);
                });
            });

            test("with 0 column index on empty input string line length", () => {
                let pr = Json.parse("");
                assert.deepStrictEqual(0, pr.getCharacterIndex(0, 0));
            });

            test("with a single line", () => {
                let pr = Json.parse("hello there");
                assert.deepStrictEqual(0, pr.getCharacterIndex(0, 0));
                assert.deepStrictEqual(1, pr.getCharacterIndex(0, 1));
                assert.deepStrictEqual("hello".length, pr.getCharacterIndex(0, "hello".length));
                assert.deepStrictEqual("hello there".length, pr.getCharacterIndex(0, "hello there".length));
            });

            test("with multiple lines", () => {
                let pr = Json.parse("a\nbb\n\nccc\ndddd");
                assert.deepStrictEqual([2, 3, 1, 4, 4], pr.lineLengths);

                assert.deepStrictEqual(0, pr.getCharacterIndex(0, 0));
                assert.deepStrictEqual(1, pr.getCharacterIndex(0, 1));
                assert.throws(() => { pr.getCharacterIndex(0, 2); });

                assert.deepStrictEqual(2, pr.getCharacterIndex(1, 0));
                assert.deepStrictEqual(3, pr.getCharacterIndex(1, 1));
                assert.deepStrictEqual(4, pr.getCharacterIndex(1, 2));
                assert.throws(() => { pr.getCharacterIndex(1, 3); });

                assert.deepStrictEqual(5, pr.getCharacterIndex(2, 0));
                assert.throws(() => { pr.getCharacterIndex(2, 1); });

                assert.deepStrictEqual(6, pr.getCharacterIndex(3, 0));
                assert.deepStrictEqual(7, pr.getCharacterIndex(3, 1));
                assert.deepStrictEqual(8, pr.getCharacterIndex(3, 2));
                assert.deepStrictEqual(9, pr.getCharacterIndex(3, 3));
                assert.throws(() => { pr.getCharacterIndex(3, 4); });

                assert.deepStrictEqual(10, pr.getCharacterIndex(4, 0));
                assert.deepStrictEqual(11, pr.getCharacterIndex(4, 1));
                assert.deepStrictEqual(12, pr.getCharacterIndex(4, 2));
                assert.deepStrictEqual(13, pr.getCharacterIndex(4, 3));
                assert.deepStrictEqual(14, pr.getCharacterIndex(4, 4));
                assert.throws(() => { pr.getCharacterIndex(4, 5); });

                assert.throws(() => { pr.getCharacterIndex(5, 0); });
            });
        });

        suite("getTokenAtCharacterIndex(number)", () => {
            test("with negative character index", () => {
                let pr = Json.parse("49");
                assert.throws(() => { pr.getTokenAtCharacterIndex(-1); });
            });

            test("with character index deepStrictEqual to the character count", () => {
                let pr = Json.parse("50");
                assert.deepStrictEqual(parseNumber("50", 0), pr.getTokenAtCharacterIndex(2));
            });

            test("with character index greater than the character count", () => {
                let pr = Json.parse("51");
                assert.deepStrictEqual(undefined, pr.getTokenAtCharacterIndex(3));
            });

            test("with character index inside character index range", () => {
                let pr = Json.parse("{ 'hello': 42 }  ");
                assert.deepStrictEqual(Json.LeftCurlyBracket(0), pr.getTokenAtCharacterIndex(0));
                assert.deepStrictEqual(undefined, pr.getTokenAtCharacterIndex(1));
                assert.deepStrictEqual(Json.QuotedString(2, parseBasicTokens("'hello'")), pr.getTokenAtCharacterIndex(2));
                assert.deepStrictEqual(Json.Colon(9), pr.getTokenAtCharacterIndex(9));
                assert.deepStrictEqual(undefined, pr.getTokenAtCharacterIndex(10));
                assert.deepStrictEqual(parseNumber("42", 11), pr.getTokenAtCharacterIndex(11));
                assert.deepStrictEqual(undefined, pr.getTokenAtCharacterIndex(13));
                assert.deepStrictEqual(Json.RightCurlyBracket(14), pr.getTokenAtCharacterIndex(14));
                assert.deepStrictEqual(Json.RightCurlyBracket(14), pr.getTokenAtCharacterIndex(15));
                assert.deepStrictEqual(undefined, pr.getTokenAtCharacterIndex(16));
            });
        });
    });

    suite("parse(string)", () => {
        test("with empty text", () => {
            let result: Json.ParseResult = Json.parse("");
            assert.deepStrictEqual(result.tokenCount, 0);
            assert.deepStrictEqual(result.lineLengths, [0]);
            assert.deepStrictEqual(result.value, undefined);
        });

        test("with quoted string", () => {
            let result: Json.ParseResult = Json.parse("'hello there'");
            assert.deepStrictEqual(result.tokenCount, 1);
            assert.deepStrictEqual(result.lineLengths, [13]);
            assert.deepStrictEqual(result.value, new Json.StringValue(new Language.Span(0, 13), "'hello there'"));
        });

        test("with number", () => {
            let result: Json.ParseResult = Json.parse("14");
            assert.deepStrictEqual(result.tokenCount, 1);
            assert.deepStrictEqual(result.lineLengths, [2]);
            assert.deepStrictEqual(result.value, new Json.NumberValue(new Language.Span(0, 2), "14"));
        });

        test("with boolean (false)", () => {
            let result: Json.ParseResult = Json.parse("false");
            assert.deepStrictEqual(result.tokenCount, 1);
            assert.deepStrictEqual(result.lineLengths, [5]);
            assert.deepStrictEqual(result.value, new Json.BooleanValue(new Language.Span(0, 5), false));
        });

        test("with boolean (true)", () => {
            let result: Json.ParseResult = Json.parse("true");
            assert.deepStrictEqual(result.tokenCount, 1);
            assert.deepStrictEqual(result.lineLengths, [4]);
            assert.deepStrictEqual(result.value, new Json.BooleanValue(new Language.Span(0, 4), true));
        });

        test("with left curly bracket", () => {
            let result: Json.ParseResult = Json.parse("{");
            assert.deepStrictEqual(result.tokenCount, 1);
            assert.deepStrictEqual(result.lineLengths, [1]);
            assert.deepStrictEqual(result.value, new Json.ObjectValue(new Language.Span(0, 1), []));
        });

        test("with right curly bracket", () => {
            let result: Json.ParseResult = Json.parse("}");
            assert.deepStrictEqual(result.tokenCount, 1);
            assert.deepStrictEqual(result.lineLengths, [1]);
            assert.deepStrictEqual(result.value, undefined);
        });

        test("with empty object", () => {
            let result: Json.ParseResult = Json.parse("{}");
            assert.deepStrictEqual(result.tokenCount, 2);
            assert.deepStrictEqual(result.lineLengths, [2]);
            assert.deepStrictEqual(result.value, new Json.ObjectValue(new Language.Span(0, 2), []));
        });

        test("with object with one string property", () => {
            const result: Json.ParseResult = Json.parse("{ 'name': 'Dan' }");
            assert.deepStrictEqual(result.tokenCount, 5);
            assert.deepStrictEqual(result.lineLengths, [17]);

            const v1: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!v1) { throw new Error("failed"); }
            assert.deepStrictEqual(v1.propertyNames, ["name"]);

            const v2: Json.StringValue | undefined = Json.asStringValue(v1.getPropertyValue("name"));
            if (!v2) { throw new Error("failed"); }
            assert.deepStrictEqual(v2.span, new Language.Span(10, 5));
            assert.deepStrictEqual(v2.toString(), "Dan");
        });

        test("with object with one string property and one number property", () => {
            let result: Json.ParseResult = Json.parse("{ 'a': 'A', 'b': 30 }");
            assert.deepStrictEqual(9, result.tokenCount);
            assert.deepStrictEqual([21], result.lineLengths);

            const top: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!top) { throw new Error("failed"); }
            assert.deepStrictEqual(top.propertyNames, ["a", "b"]);

            const a: Json.StringValue | undefined = Json.asStringValue(top.getPropertyValue("a"));
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Language.Span(7, 3));
            assert.deepStrictEqual(a.toString(), "A");

            const b: Json.NumberValue | undefined = Json.asNumberValue(top.getPropertyValue("b"));
            if (!b) { throw new Error("failed"); }
            assert.deepStrictEqual(b.span, new Language.Span(17, 2));
        });

        test("with object with one boolean property and one number property", () => {
            const result: Json.ParseResult = Json.parse("{ 'a': true, 'b': 30 }");
            assert.deepStrictEqual(9, result.tokenCount);
            assert.deepStrictEqual([22], result.lineLengths);

            const top: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!top) { throw new Error("failed"); }
            assert.deepStrictEqual(top.span, new Language.Span(0, 22));
            assert.deepStrictEqual(top.propertyNames, ["a", "b"]);

            const a: Json.BooleanValue | undefined = Json.asBooleanValue(top.getPropertyValue("a"));
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Language.Span(7, 4));
            assert.deepStrictEqual(a.toBoolean(), true);

            const b: Json.NumberValue | undefined = Json.asNumberValue(top.getPropertyValue("b"));
            if (!b) { throw new Error("failed"); }
            assert.deepStrictEqual(b.span, new Language.Span(18, 2));
        });

        test("with object with object property", () => {
            const result: Json.ParseResult = Json.parse("{ 'a': { 'b': 'B' } }");
            assert.deepStrictEqual(9, result.tokenCount);
            assert.deepStrictEqual([21], result.lineLengths);

            const top: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!top) { throw new Error("failed"); }
            assert.deepStrictEqual(top.span, new Language.Span(0, 21));
            assert.deepStrictEqual(top.propertyNames, ["a"]);

            const a: Json.ObjectValue | undefined = Json.asObjectValue(top.getPropertyValue("a"));
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Language.Span(7, 12));
            assert.deepStrictEqual(a.propertyNames, ["b"]);

            const b: Json.StringValue | undefined = Json.asStringValue(a.getPropertyValue("b"));
            if (!b) { throw new Error("failed"); }
            assert.deepStrictEqual(b.span, new Language.Span(14, 3));
            assert.deepStrictEqual(b.toString(), "B");
        });

        test("with object with empty array property", () => {
            const result: Json.ParseResult = Json.parse("{ 'a': [] }");
            assert.deepStrictEqual(6, result.tokenCount);
            assert.deepStrictEqual([11], result.lineLengths);

            const top: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!top) { throw new Error("failed"); }
            assert.deepStrictEqual(top.propertyNames, ["a"]);

            const a: Json.ArrayValue | undefined = Json.asArrayValue(top.getPropertyValue("a"));
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.length, 0);
        });

        test("with object with 1 element array property", () => {
            const result: Json.ParseResult = Json.parse("{ 'a': [ 'A' ] }");
            assert.deepStrictEqual(7, result.tokenCount);
            assert.deepStrictEqual([16], result.lineLengths);

            const top: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!top) { throw new Error("failed"); }
            assert.deepStrictEqual(top.span, new Language.Span(0, 16));
            assert.deepStrictEqual(top.propertyNames, ["a"]);

            const a: Json.ArrayValue | undefined = Json.asArrayValue(top.getPropertyValue("a"));
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Language.Span(7, 7));
            assert.deepStrictEqual(a.length, 1);

            const a0: Json.StringValue | undefined = Json.asStringValue(a.elements[0]);
            if (!a0) { throw new Error("failed"); }
            assert.deepStrictEqual(a0.span, new Language.Span(9, 3));
            assert.deepStrictEqual(a0.toString(), "A");
        });

        test("with object with 2 element array property", () => {
            const result: Json.ParseResult = Json.parse("{ 'a': [ 'A', 20 ] }");
            assert.deepStrictEqual(9, result.tokenCount);
            assert.deepStrictEqual([20], result.lineLengths);

            const top: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!top) { throw new Error("failed"); }
            assert.deepStrictEqual(top.span, new Language.Span(0, 20));
            assert.deepStrictEqual(top.propertyNames, ["a"]);

            const a: Json.ArrayValue | undefined = Json.asArrayValue(top.getPropertyValue("a"));
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Language.Span(7, 11));
            assert.deepStrictEqual(a.length, 2);

            const a0: Json.StringValue | undefined = Json.asStringValue(a.elements[0]);
            if (!a0) { throw new Error("failed"); }
            assert.deepStrictEqual(a0.span, new Language.Span(9, 3));
            assert.deepStrictEqual(a0.toString(), "A");

            const a1: Json.NumberValue | undefined = Json.asNumberValue(a.elements[1]);
            if (!a1) { throw new Error("failed"); }
            assert.deepStrictEqual(a1.span, new Language.Span(14, 2));
        });

        test("with array with literal and then quoted string elements without comma separator", () => {
            const result: Json.ParseResult = Json.parse("{ 'a': [ blah 'A' ] }");
            assert.deepStrictEqual(8, result.tokenCount);
            assert.deepStrictEqual([21], result.lineLengths);

            const top: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!top) { throw new Error("failed"); }
            assert.deepStrictEqual(top.span, new Language.Span(0, 21));
            assert.deepStrictEqual(top.propertyNames, ["a"]);

            const a: Json.ArrayValue | undefined = Json.asArrayValue(top.getPropertyValue("a"));
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Language.Span(7, 12));
            assert.deepStrictEqual(a.length, 1);

            const a0: Json.StringValue | undefined = Json.asStringValue(a.elements[0]);
            if (!a0) { throw new Error("failed"); }
            assert.deepStrictEqual(a0.span, new Language.Span(14, 3));
            assert.deepStrictEqual(a0.toString(), "A");
        });

        test("with array with literal and then quoted string elements with comma separator", () => {
            const result: Json.ParseResult = Json.parse("{ 'a': [ blah, 'A' ] }");
            assert.deepStrictEqual(9, result.tokenCount);
            assert.deepStrictEqual([22], result.lineLengths);

            const top: Json.ObjectValue | undefined = Json.asObjectValue(result.value);
            if (!top) { throw new Error("failed"); }
            assert.deepStrictEqual(top.span, new Language.Span(0, 22));
            assert.deepStrictEqual(top.propertyNames, ["a"]);

            const a: Json.ArrayValue | undefined = Json.asArrayValue(top.getPropertyValue("a"));
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Language.Span(7, 13));
            assert.deepStrictEqual(a.length, 1);

            const a0: Json.StringValue | undefined = Json.asStringValue(a.elements[0]);
            if (!a0) { throw new Error("failed"); }
            assert.deepStrictEqual(a0.span, new Language.Span(15, 3));
            assert.deepStrictEqual(a0.toString(), "A");
        });
    });

    suite("Tokenizer", () => {
        suite("next()", () => {
            function nextTest(text: string, expectedTokens?: Json.Token | Json.Token[]): void {
                if (!expectedTokens) {
                    expectedTokens = [];
                } else if (expectedTokens instanceof Json.Token) {
                    expectedTokens = [expectedTokens];
                }

                test(`with ${Utilities.escapeAndQuote(text)}`, () => {
                    const tokenizer = new Json.Tokenizer(text);

                    for (const expectedToken of expectedTokens as Json.Token[]) {
                        assert.deepStrictEqual(tokenizer.moveNext(), true, "Expected next() to be true");
                        assert.deepStrictEqual(tokenizer.hasStarted(), true, "Expected hasStarted() to be true");
                        assert.deepStrictEqual(tokenizer.current, expectedToken);
                    }

                    for (let i = 0; i < 2; ++i) {
                        assert.deepStrictEqual(tokenizer.moveNext(), false, "Expected next() to be false");
                        assert.deepStrictEqual(tokenizer.hasStarted(), true, "Expected hasStarted() to be true (after all expected tokens)");
                        assert.deepStrictEqual(tokenizer.current, undefined, "Expected current to be undefined");
                    }
                });
            }

            nextTest("");

            nextTest("{", Json.LeftCurlyBracket(0));
            nextTest("}", Json.RightCurlyBracket(0));
            nextTest("[", Json.LeftSquareBracket(0));
            nextTest("]", Json.RightSquareBracket(0));
            nextTest(",", Json.Comma(0));
            nextTest(":", Json.Colon(0));

            function nextTestWithWhitespace(whitespaceText: string): void {
                nextTest(whitespaceText, parseWhitespace(whitespaceText));
            }
            nextTestWithWhitespace(" ");
            nextTestWithWhitespace("  ");
            nextTestWithWhitespace("\t");
            nextTestWithWhitespace("\r");
            nextTestWithWhitespace("\r\n");
            nextTestWithWhitespace(" \r\n\t");

            function nextTestWithQuotedString(quotedStringText: string): void {
                nextTest(quotedStringText, parseQuotedString(quotedStringText));
            }
            nextTestWithQuotedString(`'`);
            nextTestWithQuotedString(`''`);
            nextTestWithQuotedString(`"`);
            nextTestWithQuotedString(`""`);
            nextTestWithQuotedString(`"hello`);
            nextTestWithQuotedString(`'hello`);
            nextTestWithQuotedString(`"C:\\\\Users\\\\"`);
            nextTestWithQuotedString(`"hello\\"there"`);

            //

            nextTest("{}",
                [
                    Json.LeftCurlyBracket(0),
                    Json.RightCurlyBracket(1)
                ]);
            nextTest("{ }",
                [
                    Json.LeftCurlyBracket(0),
                    parseWhitespace(" ", 1),
                    Json.RightCurlyBracket(2)
                ]);

            nextTest("[]",
                [
                    Json.LeftSquareBracket(0),
                    Json.RightSquareBracket(1)
                ]);
            nextTest("[ ]",
                [
                    Json.LeftSquareBracket(0),
                    parseWhitespace(" ", 1),
                    Json.RightSquareBracket(2)
                ]);

            function nextTestWithNumber(numberText: string): void {
                nextTest(numberText, parseNumber(numberText));
            }

            nextTestWithNumber("0");
            nextTestWithNumber("123");
            nextTestWithNumber("7.");
            nextTestWithNumber("7.8");
            nextTestWithNumber("1e");
            nextTestWithNumber("1e5");
            nextTestWithNumber("1e-");
            nextTestWithNumber("1e+");
            nextTestWithNumber("1e+5");
            nextTestWithNumber("-");
            nextTestWithNumber("-456");

            nextTest("-a", [parseNumber("-"), parseLiteral("a", 1)]);

            nextTest(`{ 'name': 'test' }`,
                [
                    Json.LeftCurlyBracket(0),
                    parseWhitespace(" ", 1),
                    parseQuotedString(`'name'`, 2),
                    Json.Colon(8),
                    parseWhitespace(" ", 9),
                    parseQuotedString(`'test'`, 10),
                    parseWhitespace(" ", 16),
                    Json.RightCurlyBracket(17)
                ]);

            nextTest(`{ 'name': 'te\\'st' }`,
                [
                    Json.LeftCurlyBracket(0),
                    parseWhitespace(" ", 1),
                    parseQuotedString("'name'", 2),
                    Json.Colon(8),
                    parseWhitespace(" ", 9),
                    parseQuotedString(`'te\\'st'`, 10),
                    parseWhitespace(" ", 18),
                    Json.RightCurlyBracket(19)
                ]);

            nextTest(`{ 'a': 1, 'b': -2.3 }`,
                [
                    Json.LeftCurlyBracket(0),
                    parseWhitespace(" ", 1),
                    parseQuotedString("'a'", 2),
                    Json.Colon(5),
                    parseWhitespace(" ", 6),
                    parseNumber("1", 7),
                    Json.Comma(8),
                    parseWhitespace(" ", 9),
                    parseQuotedString("'b'", 10),
                    Json.Colon(13),
                    parseWhitespace(" ", 14),
                    parseNumber("-2.3", 15),
                    parseWhitespace(" ", 19),
                    Json.RightCurlyBracket(20)
                ]);

            nextTest(`  [ { 'name': 'hello' }]`,
                [
                    parseWhitespace("  ", 0),
                    Json.LeftSquareBracket(2),
                    parseWhitespace(" ", 3),
                    Json.LeftCurlyBracket(4),
                    parseWhitespace(" ", 5),
                    parseQuotedString(`'name'`, 6),
                    Json.Colon(12),
                    parseWhitespace(" ", 13),
                    parseQuotedString(`'hello'`, 14),
                    parseWhitespace(" ", 21),
                    Json.RightCurlyBracket(22),
                    Json.RightSquareBracket(23)
                ]);

            nextTest("true", parseBoolean("true"));

            nextTest(". hello there",
                [
                    parseUnrecognized("."),
                    parseWhitespace(" ", 1),
                    parseLiteral("hello", 2),
                    parseWhitespace(" ", 7),
                    parseLiteral("there", 8)
                ]);

            nextTest(".[]82348923",
                [
                    parseUnrecognized(".", 0),
                    Json.LeftSquareBracket(1),
                    Json.RightSquareBracket(2),
                    parseNumber("82348923", 3)
                ]);
            nextTest(".[]82348923asdglih",
                [
                    parseUnrecognized(".", 0),
                    Json.LeftSquareBracket(1),
                    Json.RightSquareBracket(2),
                    parseNumber("82348923", 3),
                    parseLiteral("asdglih", 11)
                ]);
            nextTest(".[]82348923asdglih   asl .,",
                [
                    parseUnrecognized(".", 0),
                    Json.LeftSquareBracket(1),
                    Json.RightSquareBracket(2),
                    parseNumber("82348923", 3),
                    parseLiteral("asdglih", 11),
                    parseWhitespace("   ", 18),
                    parseLiteral("asl", 21),
                    parseWhitespace(" ", 24),
                    parseUnrecognized(".", 25),
                    Json.Comma(26)
                ]);
            nextTest(".[]82348923asdglih   asl .,'",
                [
                    parseUnrecognized(".", 0),
                    Json.LeftSquareBracket(1),
                    Json.RightSquareBracket(2),
                    parseNumber("82348923", 3),
                    parseLiteral("asdglih", 11),
                    parseWhitespace("   ", 18),
                    parseLiteral("asl", 21),
                    parseWhitespace(" ", 24),
                    parseUnrecognized(".", 25),
                    Json.Comma(26),
                    parseQuotedString(`'`, 27)
                ]);

            nextTest("/", parseLiteral("/"));
            nextTest("//", parseComment("//"));
            nextTest("// Hello there!", parseComment("// Hello there!"));
            nextTest("// Hello there!\n50",
                [
                    parseComment("// Hello there!"),
                    parseWhitespace("\n", 15),
                    parseNumber("50", 16)
                ]);

            nextTest("/*", parseComment("/*"));
            nextTest("/* *", parseComment("/* *"));
            nextTest("/* \n blah", parseComment("/* \n blah"));
            nextTest("/* \n * blah */ test",
                [
                    parseComment("/* \n * blah */"),
                    parseWhitespace(" ", 14),
                    parseLiteral("test", 15)
                ]);
            nextTest("/a",
                [
                    parseLiteral("/", 0),
                    parseLiteral("a", 1)
                ]);
            nextTest("hello_there", parseLiteral("hello_there"));
        });
    });

    suite("LeftCurlyBracket()", () => {
        function leftCurlyBracketTest(startIndex: number): void {
            test(`with ${startIndex} startIndex`, () => {
                const t: Json.Token = Json.LeftCurlyBracket(startIndex);
                assert.deepStrictEqual(t.type, Json.TokenType.LeftCurlyBracket);
                assert.deepStrictEqual(t.span, new Language.Span(startIndex, 1));
                assert.deepStrictEqual(t.toString(), "{");
            });
        }
        leftCurlyBracketTest(-1);
        leftCurlyBracketTest(0);
        leftCurlyBracketTest(7);
    });

    suite("RightCurlyBracket()", () => {
        function rightCurlyBracketTest(startIndex: number): void {
            test(`with ${startIndex} startIndex`, () => {
                const t: Json.Token = Json.RightCurlyBracket(startIndex);
                assert.deepStrictEqual(t.type, Json.TokenType.RightCurlyBracket);
                assert.deepStrictEqual(t.span, new Language.Span(startIndex, 1));
                assert.deepStrictEqual(t.toString(), "}");
            });
        }
        rightCurlyBracketTest(-1);
        rightCurlyBracketTest(0);
        rightCurlyBracketTest(7);
    });

    suite("LeftSquareBracket()", () => {
        function leftSquareBracketTest(startIndex: number): void {
            test(`with ${startIndex} startIndex`, () => {
                const t: Json.Token = Json.LeftSquareBracket(startIndex);
                assert.deepStrictEqual(t.type, Json.TokenType.LeftSquareBracket);
                assert.deepStrictEqual(t.span, new Language.Span(startIndex, 1));
                assert.deepStrictEqual(t.toString(), "[");
            });
        }
        leftSquareBracketTest(-1);
        leftSquareBracketTest(0);
        leftSquareBracketTest(7);
    });

    suite("RightSquareBracket()", () => {
        function rightSquareBracketTest(startIndex: number): void {
            test(`with ${startIndex} startIndex`, () => {
                const t: Json.Token = Json.RightSquareBracket(startIndex);
                assert.deepStrictEqual(t.type, Json.TokenType.RightSquareBracket);
                assert.deepStrictEqual(t.span, new Language.Span(startIndex, 1));
                assert.deepStrictEqual(t.toString(), "]");
            });
        }
        rightSquareBracketTest(-1);
        rightSquareBracketTest(0);
        rightSquareBracketTest(7);
    });

    suite("Comma()", () => {
        function commaTest(startIndex: number): void {
            test(`with ${startIndex} startIndex`, () => {
                const t: Json.Token = Json.Comma(startIndex);
                assert.deepStrictEqual(t.type, Json.TokenType.Comma);
                assert.deepStrictEqual(t.span, new Language.Span(startIndex, 1));
                assert.deepStrictEqual(t.toString(), ",");
            });
        }
        commaTest(-1);
        commaTest(0);
        commaTest(7);
    });

    suite("Colon()", () => {
        function colonTest(startIndex: number): void {
            test(`with ${startIndex} startIndex`, () => {
                const t: Json.Token = Json.Colon(startIndex);
                assert.deepStrictEqual(t.type, Json.TokenType.Colon);
                assert.deepStrictEqual(t.span, new Language.Span(startIndex, 1));
                assert.deepStrictEqual(t.toString(), ":");
            });
        }
        colonTest(-1);
        colonTest(0);
        colonTest(7);
    });

    suite("getLastTokenOnLine", () => {
        function createGetLastTokenOnLineTest(
            testName: string,
            json: string,
            expectedTokenTypesIncludingComments: (Json.TokenType | undefined)[],
            expectedTokenTypesIgnoringComments?: (Json.TokenType | undefined)[]
        ): void {
            if (!expectedTokenTypesIgnoringComments) {
                expectedTokenTypesIgnoringComments = expectedTokenTypesIncludingComments;
            }

            createTest(`${testName}, including comments`, Json.Comments.includeCommentTokens, expectedTokenTypesIncludingComments);
            createTest(`${testName}, ignoring comments`, Json.Comments.ignoreCommentTokens, expectedTokenTypesIgnoringComments);

            function createTest(name: string, comments: Json.Comments, expected: (Json.TokenType | undefined)[]): void {
                test(name, () => {
                    const result = Json.parse(json);
                    const lines = result.lineLengths.length;
                    const lastTokens: (Json.Token | undefined)[] = [];
                    for (let i = 0; i < lines; ++i) {
                        lastTokens[i] = result.getLastTokenOnLine(i, comments);
                    }
                    assert.deepStrictEqual(lastTokens.map(t => t?.type), expected);
                });
            }
        }

        suite("simple and line comments", () => {
            createGetLastTokenOnLineTest(
                "simple",
                `{
                hi: "there"
            }`,
                [
                    Json.TokenType.LeftCurlyBracket,
                    Json.TokenType.QuotedString,
                    Json.TokenType.RightCurlyBracket
                ]
            );
            createGetLastTokenOnLineTest(
                "line comments",
                `{ // one
                hi: "there" // two
            }// three`,
                [
                    Json.TokenType.Comment,
                    Json.TokenType.Comment,
                    Json.TokenType.Comment
                ],
                [
                    Json.TokenType.LeftCurlyBracket,
                    Json.TokenType.QuotedString,
                    Json.TokenType.RightCurlyBracket
                ]
            );
            createGetLastTokenOnLineTest(
                "empty string",
                ``,
                [
                    undefined,
                ],
                [
                    undefined,
                ]
            );
            createGetLastTokenOnLineTest(
                "just a line comment",
                `// hi`,
                [
                    Json.TokenType.Comment,
                ],
                [
                    undefined,
                ]
            );
            createGetLastTokenOnLineTest(
                "single line",
                `hi`,
                [
                    Json.TokenType.Literal,
                ]
            );
            createGetLastTokenOnLineTest(
                "single line plus line comment",
                `hi //there`,
                [
                    Json.TokenType.Comment,
                ],
                [
                    Json.TokenType.Literal,
                ]
            );
            createGetLastTokenOnLineTest(
                "blank line at end",
                `{ // one
            }// three
            `,
                [
                    Json.TokenType.Comment,
                    Json.TokenType.Comment,
                    undefined,
                ],
                [
                    Json.TokenType.LeftCurlyBracket,
                    Json.TokenType.RightCurlyBracket,
                    undefined,
                ]
            );
            createGetLastTokenOnLineTest(
                "blank lines",
                `
            { // one

                hi: "there" // two

            }// three
            `,
                [
                    undefined,
                    Json.TokenType.Comment,
                    undefined,
                    Json.TokenType.Comment,
                    undefined,
                    Json.TokenType.Comment,
                    undefined,
                ],
                [
                    undefined,
                    Json.TokenType.LeftCurlyBracket,
                    undefined,
                    Json.TokenType.QuotedString,
                    undefined,
                    Json.TokenType.RightCurlyBracket,
                    undefined,
                ]
            );
        });
        suite("block comments", () => {
            createGetLastTokenOnLineTest(
                "just single line block comment",
                `/* { hi: "there" } */`,
                [
                    Json.TokenType.Comment,
                ],
                [
                    undefined
                ]
            );
            createGetLastTokenOnLineTest(
                "just multiline block comment",
                `/* {
                hi: "there"
            } */`,
                [
                    Json.TokenType.Comment,
                    Json.TokenType.Comment,
                    Json.TokenType.Comment
                ],
                [
                    undefined,
                    undefined,
                    undefined
                ]
            );
            createGetLastTokenOnLineTest(
                "block comments",
                `{ /* one */
                hi: "there" /* two
                still a comment
                last of coment */ hi: "again"
            } /* three */  `,
                [
                    Json.TokenType.Comment,
                    Json.TokenType.Comment,
                    Json.TokenType.Comment,
                    Json.TokenType.QuotedString,
                    Json.TokenType.Comment,
                ],
                [
                    Json.TokenType.LeftCurlyBracket,
                    Json.TokenType.QuotedString,
                    undefined,
                    Json.TokenType.QuotedString,
                    Json.TokenType.RightCurlyBracket
                ]
            );
            createGetLastTokenOnLineTest(
                "single line plus block comment",
                `hi/*there*/`,
                [
                    Json.TokenType.Comment,
                ],
                [
                    Json.TokenType.Literal,
                ]
            );
            createGetLastTokenOnLineTest(
                "blank line at end",
                `{ /* one */
            }/* two */
            `,
                [
                    Json.TokenType.Comment,
                    Json.TokenType.Comment,
                    undefined,
                ],
                [
                    Json.TokenType.LeftCurlyBracket,
                    Json.TokenType.RightCurlyBracket,
                    undefined,
                ]
            );
        });
    });
});
