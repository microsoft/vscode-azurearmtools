/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

/**
 * Stringifies the object with newlines and indenting (JSON.stringfy(x) gives the minimum string representation)
 */
export function stringify(v: {}): string {
    return JSON.stringify(v, undefined, 2);
}
