// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length no-http-string max-line-length no-null-keyword

import * as assert from "assert";
import { __debugMarkPositionInString, __debugMarkRangeInString } from "../extension.bundle";

suite("__debugMarkPositionInString", () => {
    const text = "this is a short string";
    const position = "this is a ".length;

    test("short string, single char insert", () => {
        const result1 = __debugMarkPositionInString(text, position, "!");
        assert.equal(result1, "this is a !short string");
    });

    test("short string, longer insert", () => {
        const result2 = __debugMarkPositionInString(text, position, "very ");
        assert.equal(result2, "this is a very short string");
    });

    test("ellipses at front", () => {
        const result2 = __debugMarkPositionInString(text, position, "very ", 2);
        assert.equal(result2, "...a very short string");
    });

    test("ellipses at end", () => {
        const result2 = __debugMarkPositionInString(text, position, "very ", 25, 5);
        assert.equal(result2, "this is a very short...");
    });
});

suite("__debugMarkSubstring", () => {
    const text = "this is a short string";
    const position = "this is a ".length;

    test("short string, single char insert", () => {
        const result1 = __debugMarkRangeInString(text, position, 1);
        assert.equal(result1, "this is a <<s>>hort string");
    });

    test("short string, longer insert", () => {
        const result2 = __debugMarkRangeInString(text, position, 5);
        assert.equal(result2, "this is a <<short>> string");
    });

    test("ellipses at front", () => {
        const result2 = __debugMarkRangeInString(text, position, 5, "<", ">", 2);
        assert.equal(result2, "...a <short> string");
    });

    test("ellipses at end", () => {
        const result2 = __debugMarkRangeInString(text, position, 5, "<", ">", 25, 7);
        assert.equal(result2, "this is a <short> string...");
    });
});
