// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as assert from "assert";
import { sortArrayByProperty } from "../extension.bundle";

suite("sortArrayByProperty", () => {
    const array: { key: string; value: number }[] = [
        { key: "four", value: 4 },
        { key: "one", value: 1 },
        { key: "eight", value: 8 },
        { key: "three", value: 3 },
        { key: "two", value: 2 },
        { key: "six", value: 6 },
        { key: "five", value: 5 },
        { key: "ten", value: 10 },
        { key: "seven", value: 7 },
        { key: "nine", value: 9 },
    ];

    test("by key", () => {
        const actual = sortArrayByProperty(array, "key");
        assert.deepStrictEqual(
            actual, [
            { key: "eight", value: 8 },
            { key: "five", value: 5 },
            { key: "four", value: 4 },
            { key: "nine", value: 9 },
            { key: "one", value: 1 },
            { key: "seven", value: 7 },
            { key: "six", value: 6 },
            { key: "ten", value: 10 },
            { key: "three", value: 3 },
            { key: "two", value: 2 },
        ]);
    });

    test("by value", () => {
        const actual = sortArrayByProperty(array, "value");
        assert.deepStrictEqual(
            actual, [
            { key: "one", value: 1 },
            { key: "two", value: 2 },
            { key: "three", value: 3 },
            { key: "four", value: 4 },
            { key: "five", value: 5 },
            { key: "six", value: 6 },
            { key: "seven", value: 7 },
            { key: "eight", value: 8 },
            { key: "nine", value: 9 },
            { key: "ten", value: 10 },
        ]);
    });

    test("descending", () => {
        const actual = sortArrayByProperty(array, "value", { descending: true });
        assert.deepStrictEqual(
            actual, [
            { key: "ten", value: 10 },
            { key: "nine", value: 9 },
            { key: "eight", value: 8 },
            { key: "seven", value: 7 },
            { key: "six", value: 6 },
            { key: "five", value: 5 },
            { key: "four", value: 4 },
            { key: "three", value: 3 },
            { key: "two", value: 2 },
            { key: "one", value: 1 },

        ]);
    });
});
