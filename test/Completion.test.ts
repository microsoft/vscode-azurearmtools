// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { Completion, Span } from "../extension.bundle";

suite("Completion", () => {
    suite("Item", () => {
        test("constructor(string, Span, string, string, Type)", () => {
            const item: Completion.Item = new Completion.Item({
                label: "a",
                insertText: "b",
                span: new Span(1, 2),
                kind: Completion.CompletionKind.tleFunction,
                detail: "c",
                documentation: "d"
            });
            assert.deepStrictEqual(item.documention, "d");
            assert.deepStrictEqual(item.detail, "c");
            assert.deepStrictEqual(item.span, new Span(1, 2));
            assert.deepStrictEqual(item.insertText, "b");
            assert.deepStrictEqual(item.label, "a");
            assert.deepStrictEqual(item.kind, Completion.CompletionKind.tleFunction);
        });
    });
});
