/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Uri } from 'vscode';

export function parseUri(uri: string): Uri {
    return Uri.parse(uri, true);
}

export function stringifyUri(uri: Uri): string {
    // can't use true argument, seems to create invalid SAS tokens (or at least Azure storage doesn't like them)
    return uri.toString(false);
}
