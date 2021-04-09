// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable-next-line: no-any
type Constructor<T> = new (...args: any[]) => T;

export function filterByType<TElements, TFilter extends TElements>(array: TElements[], filterType: Constructor<TFilter>): TFilter[] {
    return <TFilter[]>array.filter(e => e instanceof filterType);
}
