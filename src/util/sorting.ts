// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

/**
 * Returns -1, 0 or 1 by comparing two values, appropriate as a comparison function for Array.sort()
 */
export function compareForSort<T>(value1: T, value2: T, descending?: boolean): number {
    if (descending) {
        [value1, value2] = [value2, value1];
    }

    if (value1 < value2) {
        return -1;
    } else if (value1 > value2) {
        return 1;
    } else {
        return 0;
    }
}

/**
 * Sorts the input array by a value which is determined by calling a user-supplied function
 * @param input The input array
 * @param property The name of the property to sort by
 */
export function sortArray<T, V>(input: T[], getSortValue: (a: T) => V, options?: { descending?: boolean }): T[] {
    return input.sort((a, b) => {
        const value1 = getSortValue(a);
        const value2 = getSortValue(b);
        return compareForSort(value1, value2, options?.descending);
    });
}

/**
 * Sorts the input array by a given property name
 * @param input The input array
 * @param property The name of the property to sort by
 */
export function sortArrayByProperty<T, K extends keyof T>(input: T[], property: K, options?: { descending?: boolean }): T[] {
    return sortArray(input, element => element[property], options);
}
