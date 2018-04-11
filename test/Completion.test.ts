// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import * as Completion from "../src/Completion";
import * as language from "../src/Language";

suite("Completion", () => {
    suite("Item", () => {
        test("constructor(string, Span, string, string, Type)", () => {
            const item: Completion.Item = new Completion.Item("a", "b", new language.Span(1, 2), "c", "d", Completion.Type.Function);
            assert.deepStrictEqual(item.description, "d");
            assert.deepStrictEqual(item.detail, "c");
            assert.deepStrictEqual(item.insertSpan, new language.Span(1, 2));
            assert.deepStrictEqual(item.insertText, "b");
            assert.deepStrictEqual(item.name, "a");
            assert.deepStrictEqual(item.type, Completion.Type.Function);
        });
    });
});
