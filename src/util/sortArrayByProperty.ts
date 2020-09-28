// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

/**
 * Sorts the input array by a given property
 * @param input The input array
 * @param property The name of the property to sort by
 */
export function sortArrayByProperty<T, K extends keyof T>(input: T[], property: K): T[] {
    return input.sort((a, b) => {
        const value1 = a[property];
        const value2 = b[property];

        if (value1 < value2) {
            return -1;
        } else if (value1 > value2) {
            return 1;
        } else {
            return 0;
        }
    });
}
