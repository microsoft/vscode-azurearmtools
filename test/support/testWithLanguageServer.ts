// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ITest, ITestCallbackContext } from "mocha";
import { armTest } from "./armTest";

export function testWithLanguageServer(expectation: string, callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    return armTest(
        expectation,
        {
            requiresLanguageServer: true
        },
        callback);
}

export function testWithLanguageServerAndRealFunctionMetadata(expectation: string, callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    return armTest(
        expectation,
        {
            requiresLanguageServer: true,
            useRealFunctionMetadata: true
        },
        callback);
}
