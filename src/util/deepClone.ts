// ----------------------------------------------------------------------------
// Licensed under the MIT License. See License.md in the project root for license information.
// ----------------------------------------------------------------------------

/**
 * Create a deep copy of the provided value.
 */
export function deepClone<T extends {}>(value: T): T {
    let result: unknown;

    if (value === null ||
        value === undefined ||
        typeof value === "boolean" ||
        typeof value === "number" ||
        typeof value === "string") {
        result = value;
    } else if (value instanceof Array) {
        result = [];
        // eslint-disable-next-line @typescript-eslint/no-for-in-array
        for (const index in value) {
            (<unknown[]>result)[index] = deepClone(value[index]);
        }
    } else {
        result = {};
        // tslint:disable-next-line:no-for-in // Grandfathered in
        for (const propertyName in value) {
            // eslint-disable-next-line no-prototype-builtins
            if (value.hasOwnProperty(propertyName)) {
                (<{ [key: string]: unknown }>result)[propertyName] = deepClone(<T>value[propertyName]);
            }
        }
    }

    return <T>result;
}
