// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Temporary work-around for assert.ok issue in vscode 1.36: https://github.com/microsoft/vscode/issues/77146

// tslint:disable:variable-name

import * as orig_assert from "assert";
import { isWebpack } from "../common";

export const breakOnAssert: boolean = /^(true|1)$/i.test(process.env.BREAK_ON_ASSERT ?? '');

export function disableBreakOnAssert(value: boolean): void {
    process.env.DISABLE_BREAK_ON_ASSERT = value ? 'true' : '';
}

function fixed_ok(value: unknown, message?: string): void {
    // eslint-disable-next-line no-extra-boolean-cast
    if (!!value) {
        return;
    }

    if (breakOnAssert && process.env.DISABLE_BREAK_ON_ASSERT !== 'true') {
        // eslint-disable-next-line no-debugger
        debugger;
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
