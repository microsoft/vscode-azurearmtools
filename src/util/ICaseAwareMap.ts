// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

/**
 * Map with case-insensitive or case-sensitive keys
 */

export interface ICaseAwareMap<TKey extends string, TValue> {
    clear(): void;
    size: number;

    // tslint:disable-next-line: no-reserved-keywords
    get(key: TKey): TValue | undefined;

    // tslint:disable-next-line: no-reserved-keywords
    set(key: TKey, value: TValue): ICaseAwareMap<TKey, TValue>;

    //asdf test
    delete(key: TKey): boolean;

    /**
     * Retrieve the keys, in the original casing that they were set with
     */
    keys(): IterableIterator<TKey>;
    /**
     * Retrieve the entries, in the original casing that they were set with
     */
    entries(): IterableIterator<[TKey, TValue]>;
    /**
     * Creates an object from the map
     */
    toObject(): { [key: string]: TValue };

    /**
     * Create a new map by applying a function to each entry
     */
    map<TReturn>(callbackfn: (key: TKey, value: TValue) => TReturn): TReturn[];
}

export function caseAwareMapToObject<TKey extends string, TValue>(map: ICaseAwareMap<TKey, TValue>): { [key: string]: TValue } {
    const newMapAsObject: { [key: string]: TValue } = {};
    for (const entry of map.entries()) {
        newMapAsObject[entry[0]] = entry[1];
    }

    return newMapAsObject;
}
