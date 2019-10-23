// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/**
 * Map with case-insensitive keys. Last set wins if keys differ only by case
 */
export class CaseInsensitiveMap<TKey extends string, TValue> {
    // Maps case-insensitive key to tuple of [case-preserved key, value]
    private _map: Map<TKey, [TKey, TValue]> = new Map<TKey, [TKey, TValue]>();

    // tslint:disable-next-line: no-reserved-keywords
    public get(key: TKey): TValue | undefined {
        const found = this._map.get(<TKey>key.toLowerCase());
        return found ? found[1] : undefined;
    }

    // tslint:disable-next-line: no-reserved-keywords
    public set(key: TKey, value: TValue): CaseInsensitiveMap<TKey, TValue> {
        this._map.set(<TKey>key.toLowerCase(), [key, value]);
        return this;
    }

    /**
     * Retrieve the keys, in the original casing that they were set with
     */
    public keys(): IterableIterator<TKey> {
        const tuples: [TKey, TValue][] = Array.from(this._map.values());
        const casePreservedKeys: TKey[] = tuples.map(tuple => tuple[0]);
        return casePreservedKeys.values();
    }
}
