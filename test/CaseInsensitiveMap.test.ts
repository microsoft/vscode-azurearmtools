// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { CaseInsensitiveMap } from "../extension.bundle";

suite("CaseInsensitiveMap", () => {
    test("not found", () => {
        const map = new CaseInsensitiveMap<string, string>();
        assert(!map.get("not found"));
    });

    test("single set/get", () => {
        const map = new CaseInsensitiveMap<string, string>();
        map.set("abc", "hello");
        assert.equal(map.get("abc"), "hello");
    });

    test("single set/get, case differs", () => {
        const map = new CaseInsensitiveMap<string, string>();
        map.set("Abc", "hello");
        assert.equal(map.get("aBC"), "hello");
    });

    test("multiple set/get, case differs, last set wins", () => {
        const map = new CaseInsensitiveMap<string, string>();
        map.set("Abc", "hello");
        map.set("ABC", "HELLO");
        assert.equal(map.get("aBC"), "HELLO");
    });
});
