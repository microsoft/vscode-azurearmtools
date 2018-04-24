// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length

import * as assert from "assert";

import { Histogram } from "../src/Histogram";

suite("Histogram", () => {
    suite("keys", () => {
        test("With empty", () => {
            let h = new Histogram();
            assert.deepEqual([], h.keys);
        });

        test("With single key with 1 count", () => {
            let h = new Histogram();
            h.add("test");
            assert.deepEqual(["test"], h.keys);
        });

        test("With single key with 6 counts", () => {
            let h = new Histogram();
            h.add("test");
            h.add("test", 5);
            assert.deepEqual(["test"], h.keys);
        });

        test("With multiple keys", () => {
            let h = new Histogram();
            h.add("a");
            h.add("b");
            h.add("c");
            assert.deepEqual(["a", "b", "c"], h.keys);
        });
    });

    suite("add()", () => {
        test("With null key", () => {
            let h = new Histogram();
            h.add(null);
            assert.deepEqual(1, h.getCount(null));
            assert.deepEqual([null], h.keys);
        });

        test("With undefined key", () => {
            let h = new Histogram();
            h.add(undefined);
            assert.deepEqual(1, h.getCount(undefined));
            assert.deepEqual([undefined], h.keys);
        });

        test("With string key", () => {
            let h = new Histogram();
            h.add("a");
            assert.deepEqual(1, h.getCount("a"));
            assert.deepEqual(["a"], h.keys);
        });

        test("With string key and count", () => {
            let h = new Histogram();
            h.add("a", 20);
            assert.deepEqual(20, h.getCount("a"));
            assert.deepEqual(["a"], h.keys);
        });

        test("With Histogram key", () => {
            let h = new Histogram();
            h.add("a", 20);
            assert.deepEqual(20, h.getCount("a"));
            assert.deepEqual(["a"], h.keys);
            h.add(h);
            assert.deepEqual(40, h.getCount("a"));
            assert.deepEqual(["a"], h.keys);
            h.add(h);
            assert.deepEqual(80, h.getCount("a"));
            assert.deepEqual(["a"], h.keys);
        });
    });

    suite("get(string)", () => {
        test("with null", () => {
            let h = new Histogram();
            assert.equal(0, h.getCount(null));

            h.add(null);
            assert.equal(1, h.getCount(null));
        });

        test("with undefined", () => {
            let h = new Histogram();
            assert.equal(0, h.getCount(undefined));

            h.add(undefined);
            assert.equal(1, h.getCount(undefined));
        });

        test("with empty", () => {
            let h = new Histogram();
            assert.equal(0, h.getCount(""));

            h.add("");
            assert.equal(1, h.getCount(""));
        });

        test("with non-empty", () => {
            let h = new Histogram();
            assert.equal(0, h.getCount("a"));

            h.add("a");
            assert.equal(1, h.getCount("a"));
        });
    });
});
