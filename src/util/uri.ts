/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Uri } from 'vscode';

export function parseUri(uri: string): Uri {
    return Uri.parse(uri, true);
}

export function stringifyUri(uri: Uri): string {
    // true: skips the aggressive encoding
    return uri.toString(true);
}
