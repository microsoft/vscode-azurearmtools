// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-func-body-length

import * as assert from "assert";
import { CachedValue } from "../extension.bundle";

suite("CachedValue<T>", () => {
    test("Returns cached value without extra calls", () => {
        const cv = new CachedValue<string>();
        let calls = 0;

        function getValue(): string {
            return cv.getOrCacheValue(() => {
                ++calls;
                return calls.toString();
            });
        }

        assert.equal(getValue(), "1");
        assert.equal(getValue(), "1");
    });

    test("Handles undefined values", () => {
        const cv = new CachedValue<string | undefined>();

        function getValue(): string | undefined {
            return cv.getOrCacheValue(() => undefined);
        }

        assert.equal(getValue(), undefined);
    });

    test("Handles null values", () => {
        const cv = new CachedValue<string | null>();

        function getValue(): string | null {
            return cv.getOrCacheValue(() => null);
        }

        assert.equal(getValue(), null);
    });
});
