// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export async function delayWhileSync(pollMs: number, predicate: () => boolean, timeout: number = 0, timeoutErrorMessage: string = "Timed out"): Promise<void> {
    return new Promise((resolve, reject): void => {
        const start = Date.now();
        const handler = setInterval(
            () => {
                try {
                    if (!predicate()) {
                        clearInterval(handler);
                        resolve();
                    } else if (timeout > 0 && Date.now() - start > timeout) {
                        reject(new Error(timeoutErrorMessage));
                    }
                } catch (err) {
                    reject(err);
                }
            },
            pollMs);
    });
}
