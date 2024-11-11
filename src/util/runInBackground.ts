/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { parseError } from "@microsoft/vscode-azext-utils";

export function runInBackground(action: () => void | Promise<void>): void {
    setTimeout(
        async () => {
            try {
                await action();
            } catch (e) {
                console.error(parseError(e).message);
            }
        },
        0);
}
