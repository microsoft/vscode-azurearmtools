// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Temporary work-around for assert.ok issue in vscode 1.36: https://github.com/microsoft/vscode/issues/77146

// tslint:disable:variable-name

import * as orig_assert from "assert";
import { isWebpack } from "./constants";

function fixed_ok(value: unknown, message?: string): void {
    // tslint:disable-next-line: strict-boolean-expressions
    if (!value) {
        // tslint:disable-next-line: strict-boolean-expressions
        if (!/^(false|0)?$/i.test(process.env.STOP_ON_ASSERT_FAILURE || '')) {
            // tslint:disable-next-line: no-debugger
            debugger;
        }
    }

    if (isWebpack) {
        // The bug repros when assert fails with webpack and no message is supplied, so always supply a message
        // (this does mean that we won't see the original code for the condition, but that's where the bug is occurring)
        // tslint:disable-next-line: strict-boolean-expressions
        orig_assert.ok(value, message || "Assertion failed");
    }

    orig_assert.ok(value, message);
}

const fixed_assert: typeof orig_assert = <typeof orig_assert>fixed_ok;
Object.assign(fixed_assert, orig_assert);

export const assert: typeof orig_assert = fixed_assert;
