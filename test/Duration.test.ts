// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length

import * as assert from "assert";

import { Duration } from "../src/Duration";

suite("Duration", () => {
    suite("totalMilliseconds(number)", () => {
        test("With negative", () => {
            let d = Duration.milliseconds(-5);
            assert.deepEqual(-5, d.totalMilliseconds);
        });

        test("With zero", () => {
            let d = Duration.milliseconds(0);
            assert.deepEqual(0, d.totalMilliseconds);
        });

        test("With positive", () => {
            let d = Duration.milliseconds(20);
            assert.deepEqual(20, d.totalMilliseconds);
        });
    });

    suite("totalSeconds(number)", () => {
        test("With negative", () => {
            let d = Duration.seconds(-5);
            assert.deepEqual(-5000, d.totalMilliseconds);
            assert.deepEqual(-5, d.totalSeconds);
        });

        test("With zero", () => {
            let d = Duration.seconds(0);
            assert.deepEqual(0, d.totalMilliseconds);
            assert.deepEqual(0, d.totalSeconds);
        });

        test("With positive", () => {
            let d = Duration.seconds(20);
            assert.deepEqual(20000, d.totalMilliseconds);
            assert.deepEqual(20, d.totalSeconds);
        });
    });

    suite("plus(Duration)", () => {
        test("With null", () => {
            assert.throws(() => { Duration.milliseconds(1).plus(null); });
        });

        test("With undefined", () => {
            assert.throws(() => { Duration.milliseconds(1).plus(undefined); });
        });

        test("With zero", () => {
            assert.deepEqual(Duration.milliseconds(1), Duration.milliseconds(1).plus(Duration.zero));
        });

        test("With negative duration", () => {
            assert.deepEqual(Duration.milliseconds(-1), Duration.milliseconds(1).plus(Duration.milliseconds(-2)));
        });
    });

    suite("dividedBy(number)", () => {
        test("With null", () => {
            assert.throws(() => { Duration.milliseconds(20).dividedBy(null); });
        });

        test("With undefined", () => {
            assert.throws(() => { Duration.milliseconds(20).dividedBy(undefined); });
        });

        test("With zero", () => {
            assert.throws(() => { Duration.milliseconds(20).dividedBy(0); });
        });

        test("With 1", () => {
            assert.deepEqual(Duration.milliseconds(20), Duration.milliseconds(20).dividedBy(1));
        });

        test("With 2", () => {
            assert.deepEqual(Duration.milliseconds(10), Duration.milliseconds(20).dividedBy(2));
        });
    });

    suite("lessThanOrEqualTo(Duration)", () => {
        test("With null", () => {
            assert.deepEqual(false, Duration.milliseconds(20).lessThanOrEqualTo(null));
        });

        test("With undefined", () => {
            assert.deepEqual(false, Duration.milliseconds(20).lessThanOrEqualTo(undefined));
        });

        test("With less than duration", () => {
            assert.deepEqual(false, Duration.milliseconds(20).lessThanOrEqualTo(Duration.milliseconds(19)));
        });

        test("With equal duration", () => {
            assert.deepEqual(true, Duration.milliseconds(20).lessThanOrEqualTo(Duration.milliseconds(20)));
        });

        test("With greater than duration", () => {
            assert.deepEqual(true, Duration.milliseconds(20).lessThanOrEqualTo(Duration.milliseconds(21)));
        });
    });

    suite("toString()", () => {
        test("With -1 milliseconds", () => {
            assert.deepEqual("-1 milliseconds", Duration.milliseconds(-1).toString());
        });

        test("With 0 milliseconds", () => {
            assert.deepEqual("0 milliseconds", Duration.milliseconds(0).toString());
        });

        test("With 1 millisecond", () => {
            assert.deepEqual("1 millisecond", Duration.milliseconds(1).toString());
        });

        test("With 2 milliseconds", () => {
            assert.deepEqual("2 milliseconds", Duration.milliseconds(2).toString());
        });

        test("With 1000 milliseconds", () => {
            assert.deepEqual("1000 milliseconds", Duration.milliseconds(1000).toString());
        });
    });
});
