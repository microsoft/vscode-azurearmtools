// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/**
 * Map with case-insensitive keys. Last set wins if keys differ only by case
 */
export class CaseInsensitiveMap<TKey extends string, TValue> {
    private _map: Map<TKey, TValue> = new Map<TKey, TValue>();

    // tslint:disable-next-line: no-reserved-keywords
    public get(key: TKey): TValue | undefined {
        const found = this._map.get(<TKey>key.toLowerCase());
        return found ? found : undefined;
    }

    // tslint:disable-next-line: no-reserved-keywords
    public set(key: TKey, value: TValue): CaseInsensitiveMap<TKey, TValue> {
        this._map.set(<TKey>key.toLowerCase(), value);
        return this;
    }

    public keys(): IterableIterator<TKey> {
        return this._map.keys();
    }
}
