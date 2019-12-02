/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

console.log("process.env.DISABLE_LANGUAGE_SERVER", `"${process.env.DISABLE_LANGUAGE_SERVER}"`);

// tslint:disable-next-line: no-suspicious-comment
// TODO: Remove when language server available for build
// tslint:disable-next-line: strict-boolean-expressions
export const DISABLE_SLOW_TESTS = !!/^(true|1)$/i.test(process.env.DISABLE_SLOW_TESTS || '');
// tslint:disable-next-line: strict-boolean-expressions
export const DISABLE_LANGUAGE_SERVER: boolean = !!/^(true|1)$/i.test(process.env.DISABLE_LANGUAGE_SERVER || '') || DISABLE_SLOW_TESTS;
