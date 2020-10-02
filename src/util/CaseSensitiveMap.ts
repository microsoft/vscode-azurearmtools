// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { ICaseAwareMap } from "./ICaseAwareMap";

//asdf test
/**
 * Map with case-sensitive keys.
 */

export class CaseSensitiveMap<TKey extends string, TValue> implements ICaseAwareMap<TKey, TValue> {
    toObject(): { [key: string]: TValue; } {
        throw new Error("Method not implemented.");
    }
    private _map: Map<TKey, TValue> = new Map<TKey, TValue>();

    public clear(): void {
        this._map.clear();
    }

    public get size(): number {
        return this._map.size;
    }

    // tslint:disable-next-line: no-reserved-keywords
    public get(key: TKey): TValue | undefined {
        return this._map.get(key);
    }

    // tslint:disable-next-line: no-reserved-keywords
    public set(key: TKey, value: TValue): ICaseAwareMap<TKey, TValue> {
        this._map.set(key, value);
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
        return this._map.keys();
    }

    /**
     * Retrieve the entries, in the original casing that they were set with
     */
    public entries(): IterableIterator<[TKey, TValue]> {
        return this._map.entries();
    }

    public map<TReturn>(callbackfn: (key: TKey, value: TValue) => TReturn): TReturn[] {
        const array: TReturn[] = [];
        this._map.forEach((value: TValue, key: TKey) => {
            array.push(callbackfn(key, value));
        });

        return array;
    }
}
