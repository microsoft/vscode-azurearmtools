// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length no-http-string max-line-length no-null-keyword

import * as assert from "assert";
import { Utilities } from "../extension.bundle";

suite("Utilities", () => {
    suite("clone(any)", () => {
        test("With null", () => {
            // tslint:disable-next-line:no-any
            assert.deepEqual(null, Utilities.clone(<any>null));
        });

        test("With undefined", () => {
            // tslint:disable-next-line:no-any
            assert.deepEqual(undefined, Utilities.clone(<any>undefined));
        });

        test("With number", () => {
            assert.deepEqual(50, Utilities.clone(50));
        });

        test("With string", () => {
            assert.deepEqual("hello", Utilities.clone("hello"));
        });

        test("With empty object", () => {
            let emptyObject = {};
            let clone = Utilities.clone(emptyObject);
            assert.deepEqual(emptyObject, clone);
            // tslint:disable-next-line:no-string-literal
            // tslint:disable-next-line: no-any
            (<any>clone).name = "value";
            assert.deepEqual({}, emptyObject);
            assert.deepEqual({ name: "value" }, clone);
        });

        test("With empty array", () => {
            let emptyArray: string[] = [];
            let clone = Utilities.clone(emptyArray);
            assert.deepEqual(emptyArray, clone);
            clone.push("test");
            assert.deepEqual([], emptyArray);
            assert.deepEqual(["test"], clone);
        });

        test("With object with string property", () => {
            let value = { hello: "there" };
            let clone = Utilities.clone(value);
            assert.deepEqual(value, clone);
            // tslint:disable-next-line:no-any
            (<any>clone).test = "testValue";
            assert.deepEqual({ hello: "there" }, value);
            assert.deepEqual({ hello: "there", test: "testValue" }, clone);
        });

        test("With object with number property", () => {
            let value = { age: 3 };
            let clone = Utilities.clone(value);
            assert.deepEqual(value, clone);
            // tslint:disable-next-line:no-any
            (<any>clone).test = "testValue";
            assert.deepEqual({ age: 3 }, value);
            assert.deepEqual({ age: 3, test: "testValue" }, clone);
        });

        test("With object with boolean property", () => {
            let value = { okay: true };
            let clone = Utilities.clone(value);
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
            assert.equal(false, Utilities.isWhitespaceCharacter(<any>null));
        });

        test("With empty", () => {
            assert.equal(false, Utilities.isWhitespaceCharacter(""));
        });

        test("With more than 1 character", () => {
            assert.equal(false, Utilities.isWhitespaceCharacter("ab"));
        });

        test("With non-whitespace character", () => {
            assert.equal(false, Utilities.isWhitespaceCharacter("c"));
        });

        test("With space", () => {
            assert.equal(true, Utilities.isWhitespaceCharacter(" "));
        });

        test("With tab", () => {
            assert.equal(true, Utilities.isWhitespaceCharacter("\t"));
        });

        test("With carriage return", () => {
            assert.equal(true, Utilities.isWhitespaceCharacter("\r"));
        });

        test("With newline", () => {
            assert.equal(true, Utilities.isWhitespaceCharacter("\n"));
        });
    });

    suite("isQuoteCharacter(string)", () => {
        test("With null", () => {
            // tslint:disable-next-line:no-any
            assert.equal(false, Utilities.isQuoteCharacter(<any>null));
        });

        test("With empty", () => {
            assert.equal(false, Utilities.isQuoteCharacter(""));
        });

        test("With more than 1 character", () => {
            assert.equal(false, Utilities.isQuoteCharacter("ab"));
        });

        test("With non-quote character", () => {
            assert.equal(false, Utilities.isQuoteCharacter("c"));
        });

        test("With escaped single-quote", () => {
            assert.equal(true, Utilities.isQuoteCharacter("\'"));
        });

        test("With unescaped single-quote", () => {
            assert.equal(true, Utilities.isQuoteCharacter("'"));
        });

        test("With escaped double-quote", () => {
            assert.equal(true, Utilities.isQuoteCharacter("\""));
        });

        test("With back-tick quote", () => {
            assert.equal(false, Utilities.isQuoteCharacter("`"));
        });
    });

    suite("isDigit(string)", () => {
        test("With null", () => {
            // tslint:disable-next-line:no-any
            assert.equal(false, Utilities.isDigit(<any>null));
        });

        test("With empty", () => {
            assert.equal(false, Utilities.isDigit(""));
        });

        test("With more than 1 character", () => {
            assert.equal(false, Utilities.isDigit("ab"));
        });

        test("With non-digit character", () => {
            assert.equal(false, Utilities.isDigit("c"));
        });

        test("With Latin digits", () => {
            assert.equal(true, Utilities.isDigit("0"));
            assert.equal(true, Utilities.isDigit("1"));
            assert.equal(true, Utilities.isDigit("2"));
            assert.equal(true, Utilities.isDigit("3"));
            assert.equal(true, Utilities.isDigit("4"));
            assert.equal(true, Utilities.isDigit("5"));
            assert.equal(true, Utilities.isDigit("6"));
            assert.equal(true, Utilities.isDigit("7"));
            assert.equal(true, Utilities.isDigit("8"));
            assert.equal(true, Utilities.isDigit("9"));
        });

        test("With more than one digit", () => {
            assert.equal(true, Utilities.isDigit("03"));
        });
    });

    suite("quote(string)", () => {
        test("with null", () => {
            assert.deepStrictEqual(Utilities.quote(null), "null");
        });

        test("with undefined", () => {
            assert.deepStrictEqual(Utilities.quote(undefined), "undefined");
        });

        test(`with ""`, () => {
            assert.deepStrictEqual(Utilities.quote(""), `""`);
        });

        test(`with "hello"`, () => {
            assert.deepStrictEqual(Utilities.quote("hello"), `"hello"`);
        });
    });

    suite("unquote(string)", () => {
        function testUnquote(input: string, expected: string): void {
            test(String(input), () => {
                assert.deepStrictEqual(Utilities.unquote(input), expected);
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
            assert.deepStrictEqual(Utilities.escape(null), null);
        });

        test("with undefined", () => {
            assert.deepStrictEqual(Utilities.escape(undefined), undefined);
        });

        test(`with ""`, () => {
            assert.deepStrictEqual(Utilities.escape(""), "");
        });

        test(`with "hello"`, () => {
            assert.deepStrictEqual(Utilities.escape("hello"), "hello");
        });

        test(`with "a\\bc"`, () => {
            assert.deepStrictEqual(Utilities.escape("a\bc"), "a\\bc");
        });

        test(`with "e\\f"`, () => {
            assert.deepStrictEqual(Utilities.escape("e\f"), "e\\f");
        });

        test(`with "\\no"`, () => {
            assert.deepStrictEqual(Utilities.escape("\no"), "\\no");
        });

        test(`with "ca\\r"`, () => {
            assert.deepStrictEqual(Utilities.escape("ca\r"), "ca\\r");
        });

        test(`with "ca\\t"`, () => {
            assert.deepStrictEqual(Utilities.escape("ca\t"), "ca\\t");
        });

        test(`with "\\very"`, () => {
            assert.deepStrictEqual(Utilities.escape("\very"), "\\very");
        });
    });

    suite("escapeAndQuote(string)", () => {
        test("with null", () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote(null), "null");
        });

        test("with undefined", () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote(undefined), "undefined");
        });

        test(`with ""`, () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote(""), `""`);
        });

        test(`with "hello"`, () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote("hello"), `"hello"`);
        });

        test(`with "a\\bc"`, () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote("a\bc"), `"a\\bc"`);
        });

        test(`with "e\\f"`, () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote("e\f"), `"e\\f"`);
        });

        test(`with "\\no"`, () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote("\no"), `"\\no"`);
        });

        test(`with "ca\\r"`, () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote("ca\r"), `"ca\\r"`);
        });

        test(`with "ca\\t"`, () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote("ca\t"), `"ca\\t"`);
        });

        test(`with "\\very"`, () => {
            assert.deepStrictEqual(Utilities.escapeAndQuote("\very"), `"\\very"`);
        });
    });
});
