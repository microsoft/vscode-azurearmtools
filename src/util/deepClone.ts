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
        // tslint:disable-next-line:forin no-for-in // Grandfathered in
        for (let index in value) {
            (<unknown[]>result)[index] = deepClone(value[index]);
        }
    } else {
        result = {};
        // tslint:disable-next-line:no-for-in // Grandfathered in
        for (let propertyName in value) {
            // tslint:disable-next-line: no-unsafe-any no-any
            if (value.hasOwnProperty(propertyName)) {
                (<{ [key: string]: unknown }>result)[propertyName] = deepClone(<{}>value[propertyName]);
            }
        }
    }

    return <T>result;
}
