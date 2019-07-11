// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Temporary work-around for assert.ok issue in vscode 1.36: https://github.com/microsoft/vscode/issues/77146

// tslint:disable:variable-name

import * as orig_assert from "assert";

function fixed_ok(value: unknown, message?: string): void {
    // The bug repros when assert fails and no message is supplied, so always supply a message
    orig_assert.ok(value, message || "Assertion failed");
}

const fixed_assert: typeof orig_assert = <typeof orig_assert>fixed_ok;
Object.assign(fixed_assert, orig_assert);

export const assert: typeof orig_assert = fixed_assert;
