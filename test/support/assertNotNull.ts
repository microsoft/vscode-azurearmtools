/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export function assertNotNull<T>(v: T | undefined | null): T {
    if (v === undefined || v === null) {
        throw new Error("Expecting non-null/non-unknown value");
    }

    return v;
}
