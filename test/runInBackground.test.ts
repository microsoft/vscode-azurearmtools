// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { delayWhile, runInBackground } from "../extension.bundle";

suite("runInBackground", () => {
    test("test", async () => {
        let x = 0;
        const promise = runInBackground(() => {
            x = 1;
        });
        assert.equal(0, x);
        await promise;
        await delayWhile(1, () => x === 0, 500);
        assert.equal(1, x);
    });
});
