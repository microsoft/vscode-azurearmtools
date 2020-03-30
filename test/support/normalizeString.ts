/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from "../../extension.bundle";

export function normalizeString(s: string): string {
    return s.replace(/(\r\n)|\r|\n/g, ext.EOL);
}
