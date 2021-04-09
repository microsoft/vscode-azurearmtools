// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export function filterNotUndefined<T>(array: (T | undefined)[]): T[] {
    return <T[]>array.filter(item => !!item);
}
