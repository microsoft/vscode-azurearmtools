// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { Completion, Language } from "../extension.bundle";

suite("Completion", () => {
    suite("Item", () => {
        test("constructor(string, Span, string, string, Type)", () => {
            const item: Completion.Item = new Completion.Item("a", "b", new Language.Span(1, 2), Completion.CompletionKind.Function, "c", "d");
            assert.deepStrictEqual(item.documention, "d");
            assert.deepStrictEqual(item.detail, "c");
            assert.deepStrictEqual(item.insertSpan, new Language.Span(1, 2));
            assert.deepStrictEqual(item.insertText, "b");
            assert.deepStrictEqual(item.name, "a");
            assert.deepStrictEqual(item.kind, Completion.CompletionKind.Function);
        });
    });
});
