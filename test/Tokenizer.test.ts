// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import * as basic from "../src/Tokenizer";
import * as utilities from "../src/Utilities";

suite("Tokenizer", () => {
    suite("Token", () => {
        function constructorTest(text: string, type: basic.TokenType): void {
            test(`with ${utilities.escapeAndQuote(text)}`, () => {
                const token = new basic.Token(text, type);
                assert.deepStrictEqual(token.toString(), text);
                assert.deepStrictEqual(token.length(), text.length);
                assert.deepStrictEqual(token.getType(), type);
            });
        }

        constructorTest("(", basic.TokenType.LeftParenthesis);
        constructorTest("hello", basic.TokenType.Letters);
    });

    test("LeftCurlyBracket", () => {
        assert.deepStrictEqual(basic.LeftCurlyBracket, new basic.Token("{", basic.TokenType.LeftCurlyBracket));
    });

    test("RightCurlyBracket", () => {
        assert.deepStrictEqual(basic.RightCurlyBracket, new basic.Token("}", basic.TokenType.RightCurlyBracket));
    });

    test("LeftSquareBracket", () => {
        assert.deepStrictEqual(basic.LeftSquareBracket, new basic.Token("[", basic.TokenType.LeftSquareBracket));
    });

    test("RightSquareBracket", () => {
        assert.deepStrictEqual(basic.RightSquareBracket, new basic.Token("]", basic.TokenType.RightSquareBracket));
    });

    test("LeftParenthesis", () => {
        assert.deepStrictEqual(basic.LeftParenthesis, new basic.Token("(", basic.TokenType.LeftParenthesis));
    });

    test("RightParenthesis", () => {
        assert.deepStrictEqual(basic.RightParenthesis, new basic.Token(")", basic.TokenType.RightParenthesis));
    });

    test("Underscore", () => {
        assert.deepStrictEqual(basic.Underscore, new basic.Token("_", basic.TokenType.Underscore));
    });

    test("Period", () => {
        assert.deepStrictEqual(basic.Period, new basic.Token(".", basic.TokenType.Period));
    });

    test("Dash", () => {
        assert.deepStrictEqual(basic.Dash, new basic.Token("-", basic.TokenType.Dash));
    });

    test("Plus", () => {
        assert.deepStrictEqual(basic.Plus, new basic.Token("+", basic.TokenType.Plus));
    });

    test("Comma", () => {
        assert.deepStrictEqual(basic.Comma, new basic.Token(",", basic.TokenType.Comma));
    });

    test("Colon", () => {
        assert.deepStrictEqual(basic.Colon, new basic.Token(":", basic.TokenType.Colon));
    });

    test("SingleQuote", () => {
        assert.deepStrictEqual(basic.SingleQuote, new basic.Token(`'`, basic.TokenType.SingleQuote));
    });

    test("DoubleQuote", () => {
        assert.deepStrictEqual(basic.DoubleQuote, new basic.Token(`"`, basic.TokenType.DoubleQuote));
    });

    test("Backslash", () => {
        assert.deepStrictEqual(basic.Backslash, new basic.Token("\\", basic.TokenType.Backslash));
    });

    test("ForwardSlash", () => {
        assert.deepStrictEqual(basic.ForwardSlash, new basic.Token("/", basic.TokenType.ForwardSlash));
    });

    test("Asterisk", () => {
        assert.deepStrictEqual(basic.Asterisk, new basic.Token("*", basic.TokenType.Asterisk));
    });

    test("Space", () => {
        assert.deepStrictEqual(basic.Space, new basic.Token(" ", basic.TokenType.Space));
    });

    test("Tab", () => {
        assert.deepStrictEqual(basic.Tab, new basic.Token("\t", basic.TokenType.Tab));
    });

    test("NewLine", () => {
        assert.deepStrictEqual(basic.NewLine, new basic.Token("\n", basic.TokenType.NewLine));
    });

    test("CarriageReturn", () => {
        assert.deepStrictEqual(basic.CarriageReturn, new basic.Token("\r", basic.TokenType.CarriageReturn));
    });

    test("CarriageReturnNewLine", () => {
        assert.deepStrictEqual(basic.CarriageReturnNewLine, new basic.Token("\r\n", basic.TokenType.CarriageReturnNewLine));
    });

    test("Letters()", () => {
        assert.deepStrictEqual(basic.Letters("abc"), new basic.Token("abc", basic.TokenType.Letters));
    });

    test("Digits()", () => {
        assert.deepStrictEqual(basic.Digits("123"), new basic.Token("123", basic.TokenType.Digits));
    });

    test("Unrecognized()", () => {
        assert.deepStrictEqual(basic.Unrecognized("&"), new basic.Token("&", basic.TokenType.Unrecognized));
    });

    suite("Tokenizer", () => {
        suite("constructor()", () => {
            function constructorTest(text: string): void {
                test(`with ${utilities.escapeAndQuote(text)}`, () => {
                    const tokenizer = new basic.Tokenizer(text);
                    assert.deepStrictEqual(tokenizer.hasStarted(), false);
                    assert.deepStrictEqual(tokenizer.current(), undefined);
                });
            }

            constructorTest(null);
            constructorTest(undefined);
            constructorTest("");
            constructorTest("hello");
        });

        suite("next()", () => {
            function nextTest(text: string, expectedTokens?: basic.Token | basic.Token[]): void {
                if (!expectedTokens) {
                    expectedTokens = [];
                }
                else if (expectedTokens instanceof basic.Token) {
                    expectedTokens = [expectedTokens] as basic.Token[];
                }

                test(`with ${utilities.escapeAndQuote(text)}`, () => {
                    const tokenizer = new basic.Tokenizer(text);

                    for (const expectedToken of expectedTokens as basic.Token[]) {
                        tokenizer.moveNext();
                        assert.deepStrictEqual(tokenizer.hasStarted(), true);
                        assert.deepStrictEqual(tokenizer.current(), expectedToken);
                    }

                    for (let i = 0; i < 2; ++i) {
                        tokenizer.moveNext();
                        assert.deepStrictEqual(tokenizer.hasStarted(), true);
                        assert.deepStrictEqual(tokenizer.current(), undefined);
                    }
                });
            }

            nextTest(null);
            nextTest(undefined);
            nextTest("");

            nextTest("{", basic.LeftCurlyBracket);
            nextTest("}", basic.RightCurlyBracket);
            nextTest("[", basic.LeftSquareBracket);
            nextTest("]", basic.RightSquareBracket);
            nextTest("(", basic.LeftParenthesis);
            nextTest(")", basic.RightParenthesis);
            nextTest("_", basic.Underscore);
            nextTest(".", basic.Period);
            nextTest("-", basic.Dash);
            nextTest("+", basic.Plus);
            nextTest(",", basic.Comma);
            nextTest(":", basic.Colon);
            nextTest(`'`, basic.SingleQuote);
            nextTest(`"`, basic.DoubleQuote);
            nextTest("\\", basic.Backslash);
            nextTest("/", basic.ForwardSlash);
            nextTest("*", basic.Asterisk);
            nextTest("\n", basic.NewLine);
            nextTest("\r\n", basic.CarriageReturnNewLine);
            nextTest(" ", basic.Space);
            nextTest("   ", [basic.Space, basic.Space, basic.Space]);
            nextTest("\t", basic.Tab);
            nextTest("\t  ", [basic.Tab, basic.Space, basic.Space]);
            nextTest("\r", basic.CarriageReturn);
            nextTest("\r ", [basic.CarriageReturn, basic.Space]);
            nextTest("\r  ", [basic.CarriageReturn, basic.Space, basic.Space]);
            nextTest("\r\t", [basic.CarriageReturn, basic.Tab]);
            nextTest("\r\r", [basic.CarriageReturn, basic.CarriageReturn]);
            nextTest("\rf", [basic.CarriageReturn, basic.Letters("f")]);
            nextTest("hello", basic.Letters("hello"));
            nextTest("a", basic.Letters("a"));
            nextTest("z", basic.Letters("z"));
            nextTest("A", basic.Letters("A"));
            nextTest("Z", basic.Letters("Z"));
            nextTest("1", basic.Digits("1"));
            nextTest("1234", basic.Digits("1234"));
            nextTest("#", basic.Unrecognized("#"));
            nextTest("^", basic.Unrecognized("^"));
        });
    });
});
