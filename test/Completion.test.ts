// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import * as Completion from "../extension.bundle";
import * as language from "../extension.bundle";

suite("Completion", () => {
    suite("Item", () => {
        test("constructor(string, Span, string, string, Type)", () => {
            const item: Completion.Item = new Completion.Item("a", "b", new language.Span(1, 2), "c", "d", Completion.CompletionKind.Function);
            assert.deepStrictEqual(item.description, "d");
            assert.deepStrictEqual(item.detail, "c");
            assert.deepStrictEqual(item.insertSpan, new language.Span(1, 2));
            assert.deepStrictEqual(item.insertText, "b");
            assert.deepStrictEqual(item.name, "a");
            assert.deepStrictEqual(item.kind, Completion.CompletionKind.Function);
        });
    });
});
