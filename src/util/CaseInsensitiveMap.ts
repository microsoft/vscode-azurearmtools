// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ICaseAwareMap } from "./ICaseAwareMap";

/**
 * Map with case-insensitive keys. Last set wins if keys differ only by case
 */
export class CaseInsensitiveMap<TKey extends string, TValue> implements ICaseAwareMap<TKey, TValue> {
    public toObject(): { [key: string]: TValue } {
        throw new Error("Method not implemented.");
    }
    // Maps case-insensitive key to tuple of [case-preserved key, value]
    private _map: Map<TKey, [TKey, TValue]> = new Map<TKey, [TKey, TValue]>();

    public clear(): void {
        this._map.clear();
    }

    public get size(): number {
        return this._map.size;
    }

    // tslint:disable-next-line: no-reserved-keywords
    public get(key: TKey): TValue | undefined {
        const found = this._map.get(<TKey>key.toLowerCase());
        return found ? found[1] : undefined;
    }

    // tslint:disable-next-line: no-reserved-keywords
    public set(key: TKey, value: TValue): ICaseAwareMap<TKey, TValue> {
        this._map.set(<TKey>key.toLowerCase(), [key, value]);
        return this;
    }

    // tslint:disable-next-line: no-reserved-keywords
    public delete(key: TKey): boolean {
        return this._map.delete(<TKey>key.toLowerCase());
    }

    /**
     * Retrieve the keys, in the original casing that they were set with
     */
    public keys(): IterableIterator<TKey> {
        const tuples: [TKey, TValue][] = Array.from(this._map.values());
        const casePreservedKeys: TKey[] = tuples.map(tuple => tuple[0]);
        return casePreservedKeys.values();
    }

    /**
     * Retrieve the entries, in the original casing that they were set with
     */
    public entries(): IterableIterator<[TKey, TValue]> { //asdf test
        const tuples: [TKey, [TKey, TValue]][] = Array.from(this._map.entries());
        const casePreservedEntries: [TKey, TValue][] = tuples.map(tuple => [tuple[1][0], tuple[1][1]]);
        return casePreservedEntries.values();
    }

    public map<TReturn>(callbackfn: (key: TKey, value: TValue) => TReturn): TReturn[] {
        const array: TReturn[] = [];
        this._map.forEach((entry: [TKey, TValue]) => {
            array.push(callbackfn(entry[0], entry[1]));
        });

        return array;
    }
}
