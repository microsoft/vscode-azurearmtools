// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition typedef

import * as assert from "assert";
import { NormalizedMap } from "../extension.bundle";

suite("NormalizedMap", () => {
    test("simple", () => {
        const map = new NormalizedMap<number, string>(key => Math.abs(key).toString());
        map.set(1, "one");
        const result = map.get(1);
        assert.equal("one", result);
    });

    test("transformed keys clash", () => {
        const map = new NormalizedMap<number, string>(key => Math.abs(key).toString());
        map.set(1, "one");
        map.set(-1, "negative one");

        const result = map.get(1);
        assert.equal("negative one", result);

        const result2 = map.get(1);
        assert.equal("negative one", result2);
    });
});
