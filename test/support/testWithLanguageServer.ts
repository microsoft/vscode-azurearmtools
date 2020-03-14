// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ITest, ITestCallbackContext } from "mocha";
import { DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { UseRealFunctionMetadata } from "../TestData";
import { diagnosticsTimeout } from "./diagnostics";
import { ITestPreparation, ITestPreparationResult, testWithPrep } from "./testWithPrep";

export class RequiresLanguageServer implements ITestPreparation {
    public static readonly instance: RequiresLanguageServer = new RequiresLanguageServer();

    public pretest(this: ITestCallbackContext): ITestPreparationResult {
        if (DISABLE_LANGUAGE_SERVER) {
            return {
                skipTest: "DISABLE_LANGUAGE_SERVER is set"
            };
        } else {
            this.timeout(diagnosticsTimeout);
            return {};
        }
    }
}

export function testWithLanguageServer(expectation: string, callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    return testWithLanguageServerAndRealFunctionMetadata(expectation, callback);
}

export function testWithLanguageServerAndRealFunctionMetadata(expectation: string, callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    return testWithPrep(
        expectation,
        [UseRealFunctionMetadata.instance,
        RequiresLanguageServer.instance],
        callback);
}
