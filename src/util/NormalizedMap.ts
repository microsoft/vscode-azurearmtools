// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export class NormalizedMap<TKey, TValue> implements Map<TKey, TValue> {
    private _map: Map<string, TValue> = new Map<string, TValue>();

    public constructor(private normalizeKey: (key: TKey) => string) {
    }

    public clear(): void {
        this._map.clear();
    }

    // tslint:disable-next-line: no-reserved-keywords
    public delete(key: TKey): boolean {
        return this._map.delete(this.normalizeKey(key));
    }

    public forEach(_callbackfn: (value: TValue, key: TKey, map: Map<TKey, TValue>) => void, _thisArg?: NormalizedMap<TKey, TValue>): void {
        throw new Error("NYI");
    }

    // tslint:disable-next-line: no-reserved-keywords
    public get(key: TKey): TValue | undefined {
        return this._map.get(this.normalizeKey(key));
    }

    public has(key: TKey): boolean {
        return this._map.has(this.normalizeKey(key));
    }

    // tslint:disable-next-line: no-reserved-keywords
    public set(key: TKey, value: TValue): this {
        this._map.set(this.normalizeKey(key), value);
        return this;
    }

    public get size(): number {
        return this._map.size;
    }

    // tslint:disable-next-line: function-name
    public [Symbol.iterator](): IterableIterator<[TKey, TValue]> {
        // tslint:disable-next-line: no-unsafe-any
        throw new Error("NYI");
    }

    public entries(): IterableIterator<[TKey, TValue]> {
        throw new Error("NYI");
    }

    public keys(): IterableIterator<TKey> {
        throw new Error("NYI");
    }

    public values(): IterableIterator<TValue> {
        return this._map.values();
    }

    public get [Symbol.toStringTag](): string {
        return "NormalizedMap<TKey, TValue>";
    }
}
