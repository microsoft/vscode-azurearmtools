// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

//asdf test
export function compareApiVersions(version1: string, version2: string): number {
    const date1 = apiVersionToDate(version1)?.valueOf() ?? 0;
    const date2 = apiVersionToDate(version2)?.valueOf() ?? 0;

    if (date1 === date2) {
        return 0;
    } else if (date1 > date2) {
        return 1;
    } else {
        return -1;
    }
}

//asdf test
export function apiVersionToDate(version: string): Date | undefined {
    // Ignore any "-preview" etc prefix
    const match = version.match(/([0-9]{4})-([0-9]{2})-([0-9]{2})/);
    if (match) {
        // tslint:disable-next-line: no-non-null-assertion
        const year = match[1];
        // tslint:disable-next-line: no-non-null-assertion
        const month = match[2];
        // tslint:disable-next-line: no-non-null-assertion
        const date = match[3];

        try {
            return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(date, 10));
        } catch (err) {
            return undefined;
        }
    }

    return undefined;
}
