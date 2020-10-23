// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

function areStringsEqualCaseInsensitive(a: string, b: string): boolean {
    // A little faster if we avoid doing the toLowerCase when possible
    if (a.length !== b.length) {
        return false;
    }

    return a.toLowerCase() === b.toLowerCase();
}
