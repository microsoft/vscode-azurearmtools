// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export async function delayWhileSync(pollMs: number, predicate: () => boolean): Promise<void> {
    return new Promise((resolve, reject): void => {
        const handler = setInterval(
            () => {
                try {
                    if (!predicate()) {
                        clearInterval(handler);
                        resolve();
                    }
                } catch (err) {
                    reject(err);
                }
            },
            pollMs);
    });
}
