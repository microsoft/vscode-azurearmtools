// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { hoursToMs, weeksToMs } from "../extension.bundle";

suite("time", () => {
    test("12 weeks", () => {
        const weeks12 = weeksToMs(12);
        assert.equal(1000 * 60 * 60 * 24 * 7 * 12, weeks12);
    });

    test("3 hours", () => {
        const hours3 = hoursToMs(3);
        assert.equal(1000 * 60 * 60 * 3, hours3);
    });
});
