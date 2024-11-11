/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export async function delay(ms: number): Promise<void> {
    // tslint:disable-next-line:typedef
    return new Promise(resolve => {
        setTimeout(
            () => {
                resolve();
            },
            ms);
    });
}
