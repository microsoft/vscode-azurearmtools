// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Context, Test } from "mocha";
import { ext, LanguageServerState } from "../../extension.bundle";
import { DEFAULT_TESTCASE_TIMEOUT_MS, DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { UseRealFunctionMetadata } from "../TestData";
import { writeToError } from "./testLog";
import { ITestPreparation, ITestPreparationResult, testWithPrep } from "./testWithPrep";

export class RequiresLanguageServer implements ITestPreparation {
    public static readonly instance: RequiresLanguageServer = new RequiresLanguageServer();

    public pretest(this: Context): ITestPreparationResult {
        if (DISABLE_LANGUAGE_SERVER) {
            return {
                skipTest: "DISABLE_LANGUAGE_SERVER is set"
            };
        } else {
            if (ext.languageServerState === LanguageServerState.Failed || ext.languageServerState === LanguageServerState.Stopped) {
                const message =
                    // tslint:disable-next-line: prefer-template
                    "Cannot run test because language server is in a failed or stopped state" +
                    (ext.languageServerStartupError ? ": " + ext.languageServerStartupError : "");
                writeToError(message);
                throw new Error(message);
            }

            this.timeout(DEFAULT_TESTCASE_TIMEOUT_MS);
            return {};
        }
    }
}

export function testWithLanguageServer(expectation: string, callback?: (this: Context) => Promise<unknown>): Test {
    return testWithLanguageServerAndRealFunctionMetadata(expectation, callback);
}

export function testWithLanguageServerAndRealFunctionMetadata(expectation: string, callback?: (this: Context) => Promise<unknown>): Test {
    return testWithPrep(
        expectation,
        [UseRealFunctionMetadata.instance,
        RequiresLanguageServer.instance],
        callback);
}
