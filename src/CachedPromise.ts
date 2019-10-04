// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/**
 * Caches a promise on the first call and always returns the same promise after that
 */
export class CachedPromise<T> {
    private _promise: Promise<T> | undefined;

    // tslint:disable-next-line: promise-function-async
    public getOrCachePromise(createPromise: () => Promise<T>): Promise<T> {
        if (!this._promise) {
            this._promise = createPromise();
        }

        return this._promise;
    }
}
