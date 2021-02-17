// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export async function delayWhileSync(pollMs: number, predicate: () => boolean): Promise<void> {
    // tslint:disable-next-line:typedef
    return new Promise(resolve => {
        const handler = setInterval(
            () => {
                if (!predicate()) {
                    clearInterval(handler);
                    resolve();
                }
            },
            pollMs);
    });
}
