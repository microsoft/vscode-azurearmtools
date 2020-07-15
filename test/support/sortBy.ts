// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Range } from "vscode";

export function sortBy<T, U>(list: T[], getField: (item: T) => U): T[] {
    if (list.length === 0) {
        return [];
    }

    const l2 = list.sort((a, b) => {
        const field1 = getField(a);
        const field2 = getField(b);

        if (typeof field1 === 'number' && typeof field2 === 'number') {
            return field1 - field2;
        }

        if ((<Range><unknown>field1).start !== undefined) {
            const r1 = <Range><unknown>field1;
            const r2 = <Range><unknown>field2;
            return r1.start.line * 100000 + r1.start.character - (r2.start.line * 100000 + r2.start.character);
        }

        return 0;
    });

    return l2;
}
