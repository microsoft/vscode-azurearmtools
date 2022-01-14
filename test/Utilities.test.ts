// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length no-http-string max-line-length no-null-keyword

import * as assert from "assert";
import { deepClone, strings } from "../extension.bundle";

suite("Utilities", () => {
    suite("clone(any)", () => {
        test("failing synchronous test", () => {
            assert.fail("whoops");
        });

        test("With null", () => {
            // tslint:disable-next-line:no-any
            assert.deepEqual(null, deepClone(<any>null));
        });

        test("With undefined", () => {
            // tslint:disable-next-line:no-any
            assert.deepEqual(undefined, deepClone(<any>undefined));
        });

        test("With number", () => {
            assert.deepEqual(50, deepClone(50));
        });

        test("With string", () => {
            assert.deepEqual("hello", deepClone("hello"));
        });

        test("With empty object", () => {
            let emptyObject = {};
            let clone = deepClone(emptyObject);
            assert.deepEqual(emptyObject, clone);
            // tslint:disable-next-line:no-string-literal
            // tslint:disable-next-line: no-any
            (<any>clone).name = "value";
            assert.deepEqual({}, emptyObject);
            assert.deepEqual({ name: "value" }, clone);
        });

        test("With empty array", () => {
            let emptyArray: string[] = [];
            let clone = deepClone(emptyArray);
            assert.deepEqual(emptyArray, clone);
            clone.push("test");
            assert.deepEqual([], emptyArray);
            assert.deepEqual(["test"], clone);
        });

        test("With object with string property", () => {
            let value = { hello: "there" };
            let clone = deepClone(value);
            assert.deepEqual(value, clone);
            // tslint:disable-next-line:no-any
            (<any>clone).test = "testValue";
            assert.deepEqual({ hello: "there" }, value);
            assert.deepEqual({ hello: "there", test: "testValue" }, clone);
        });

        test("With object with number property", () => {
            let value = { age: 3 };
            let clone = deepClone(value);
            assert.deepEqual(value, clone);
            // tslint:disable-next-line:no-any
            (<any>clone).test = "testValue";
            assert.deepEqual({ age: 3 }, value);
            assert.deepEqual({ age: 3, test: "testValue" }, clone);
        });

        test("With object with boolean property", () => {
            let value = { okay: true };
            let clone = deepClone(value);
            assert.deepEqual(value, clone);
            // tslint:disable-next-line:no-any
            (<any>clone).test = "testValue";
            assert.deepEqual({ okay: true }, value);
            assert.deepEqual({ okay: true, test: "testValue" }, clone);
        });
    });

    suite("isWhitespaceCharacter(string)", () => {
        test("With null", () => {
            // tslint:disable-next-line:no-any
            assert.equal(false, strings.isWhitespaceCharacter(<any>null));
        });

        test("With empty", () => {
            assert.equal(false, strings.isWhitespaceCharacter(""));
        });

        test("With more than 1 character", () => {
            assert.equal(false, strings.isWhitespaceCharacter("ab"));
        });

        test("With non-whitespace character", () => {
            assert.equal(false, strings.isWhitespaceCharacter("c"));
        });

        test("With space", () => {
            assert.equal(true, strings.isWhitespaceCharacter(" "));
        });

        test("With tab", () => {
            assert.equal(true, strings.isWhitespaceCharacter("\t"));
        });

        test("With carriage return", () => {
            assert.equal(true, strings.isWhitespaceCharacter("\r"));
        });

        test("With newline", () => {
            assert.equal(true, strings.isWhitespaceCharacter("\n"));
        });
    });

    suite("isQuoteCharacter(string)", () => {
        test("With null", () => {
            // tslint:disable-next-line:no-any
            assert.equal(false, strings.isQuoteCharacter(<any>null));
        });

        test("With empty", () => {
            assert.equal(false, strings.isQuoteCharacter(""));
        });

        test("With more than 1 character", () => {
            assert.equal(false, strings.isQuoteCharacter("ab"));
        });

        test("With non-quote character", () => {
            assert.equal(false, strings.isQuoteCharacter("c"));
        });

        test("With escaped single-quote", () => {
            assert.equal(true, strings.isQuoteCharacter("\'"));
        });

        test("With unescaped single-quote", () => {
            assert.equal(true, strings.isQuoteCharacter("'"));
        });

        test("With escaped double-quote", () => {
            assert.equal(true, strings.isQuoteCharacter("\""));
        });

        test("With back-tick quote", () => {
            assert.equal(false, strings.isQuoteCharacter("`"));
        });
    });

    suite("isDigit(string)", () => {
        test("With null", () => {
            // tslint:disable-next-line:no-any
            assert.equal(false, strings.isDigit(<any>null));
        });

        test("With empty", () => {
            assert.equal(false, strings.isDigit(""));
        });

        test("With more than 1 character", () => {
            assert.equal(false, strings.isDigit("ab"));
        });

        test("With non-digit character", () => {
            assert.equal(false, strings.isDigit("c"));
        });

        test("With Latin digits", () => {
            assert.equal(true, strings.isDigit("0"));
            assert.equal(true, strings.isDigit("1"));
            assert.equal(true, strings.isDigit("2"));
            assert.equal(true, strings.isDigit("3"));
            assert.equal(true, strings.isDigit("4"));
            assert.equal(true, strings.isDigit("5"));
            assert.equal(true, strings.isDigit("6"));
            assert.equal(true, strings.isDigit("7"));
            assert.equal(true, strings.isDigit("8"));
            assert.equal(true, strings.isDigit("9"));
        });

        test("With more than one digit", () => {
            assert.equal(true, strings.isDigit("03"));
        });
    });

    suite("quote(string)", () => {
        test("with null", () => {
            assert.deepStrictEqual(strings.quote(null), "null");
        });

        test("with undefined", () => {
            assert.deepStrictEqual(strings.quote(undefined), "undefined");
        });

        test(`with ""`, () => {
            assert.deepStrictEqual(strings.quote(""), `""`);
        });

        test(`with "hello"`, () => {
            assert.deepStrictEqual(strings.quote("hello"), `"hello"`);
        });
    });

    suite("unquote(string)", () => {
        function testUnquote(input: string, expected: string): void {
            test(String(input), () => {
                assert.deepStrictEqual(strings.unquote(input), expected);
            });
        }
        // tslint:disable-next-line: no-any
        testUnquote(<any>null, "");
        // tslint:disable-next-line: no-any
        testUnquote(<any>undefined, "");
        testUnquote("\"\"", "");
        testUnquote("''", "");

        testUnquote("\"hello\"", "hello");
        testUnquote("'hello'", "hello");

        suite("No quotes", () => {
            testUnquote("", "");
            testUnquote("hello", "hello");
        });

        suite("Only end quote - don't remove end quote (string tokens should have beginning quote but might not have end quote)", () => {
            testUnquote("hello'", "hello'");
            testUnquote("hello\"", "hello\"");
        });

        suite("Mismatched quotes - only remove opening quote", () => {
            testUnquote("\"'", "'");
            testUnquote("'\"", "\"");

            testUnquote("\"hello'", "hello'");
            testUnquote("'hello\"", "hello\"");
        });

        suite("Missing end quote - only remove opening quote", () => {
            testUnquote("\"", "");
            testUnquote("'", "");

            testUnquote("\"hello", "hello");
            testUnquote("'hello", "hello");
        });
    });

    suite("escape(string)", () => {
        test("with null", () => {
            assert.deepStrictEqual(strings.escape(null), null);
        });

        test("with undefined", () => {
            assert.deepStrictEqual(strings.escape(undefined), undefined);
        });

        test(`with ""`, () => {
            assert.deepStrictEqual(strings.escape(""), "");
        });

        test(`with "hello"`, () => {
            assert.deepStrictEqual(strings.escape("hello"), "hello");
        });

        test(`with "a\\bc"`, () => {
            assert.deepStrictEqual(strings.escape("a\bc"), "a\\bc");
        });

        test(`with "e\\f"`, () => {
            assert.deepStrictEqual(strings.escape("e\f"), "e\\f");
        });

        test(`with "\\no"`, () => {
            assert.deepStrictEqual(strings.escape("\no"), "\\no");
        });

        test(`with "ca\\r"`, () => {
            assert.deepStrictEqual(strings.escape("ca\r"), "ca\\r");
        });

        test(`with "ca\\t"`, () => {
            assert.deepStrictEqual(strings.escape("ca\t"), "ca\\t");
        });

        test(`with "\\very"`, () => {
            assert.deepStrictEqual(strings.escape("\very"), "\\very");
        });
    });

    suite("escapeAndQuote(string)", () => {
        test("with null", () => {
            assert.deepStrictEqual(strings.escapeAndQuote(null), "null");
        });

        test("with undefined", () => {
            assert.deepStrictEqual(strings.escapeAndQuote(undefined), "undefined");
        });

        test(`with ""`, () => {
            assert.deepStrictEqual(strings.escapeAndQuote(""), `""`);
        });

        test(`with "hello"`, () => {
            assert.deepStrictEqual(strings.escapeAndQuote("hello"), `"hello"`);
        });

        test(`with "a\\bc"`, () => {
            assert.deepStrictEqual(strings.escapeAndQuote("a\bc"), `"a\\bc"`);
        });

        test(`with "e\\f"`, () => {
            assert.deepStrictEqual(strings.escapeAndQuote("e\f"), `"e\\f"`);
        });

        test(`with "\\no"`, () => {
            assert.deepStrictEqual(strings.escapeAndQuote("\no"), `"\\no"`);
        });

        test(`with "ca\\r"`, () => {
            assert.deepStrictEqual(strings.escapeAndQuote("ca\r"), `"ca\\r"`);
        });

        test(`with "ca\\t"`, () => {
            assert.deepStrictEqual(strings.escapeAndQuote("ca\t"), `"ca\\t"`);
        });

        test(`with "\\very"`, () => {
            assert.deepStrictEqual(strings.escapeAndQuote("\very"), `"\\very"`);
        });
    });
});
