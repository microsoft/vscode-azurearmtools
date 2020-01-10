/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export function assertNotNull<T>(v: T | undefined | null, argNameOrMessage?: string): T {
    if (v === undefined || v === null) {
        throw new Error(
            // tslint:disable-next-line:prefer-template
            'Internal error: Expected value to be neither null nor undefined'
            + (argNameOrMessage ? `: ${argNameOrMessage}` : ''));
    }

    return v;
}
