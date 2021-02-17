// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/**
 * Caches a value on the first call and always returns the same value after that
 */
export class CachedValue<T> {
    private _isCached: boolean = false;
    private _value!: T;  // If _isCached==true, _value is guaranteed to be of type T

    public getOrCacheValue(calculateValue: () => T): T {
        if (!this._isCached) {
            this._value = calculateValue();
            this._isCached = true;
        }

        return this._value;
    }

    public clear(): void {
        this._isCached = false;
        this._value = <T><unknown>undefined;
    }
}
