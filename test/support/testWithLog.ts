// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Context, Test } from "mocha";
import { testWithPrep } from "./testWithPrep";

export interface ITestPreparation {
    // Perform pretest preparations, and return a Disposable which will revert those changes
    pretest(this: Context): ITestPreparationResult;
}

export interface ITestPreparationResult {
    postTestActions?(): void;

    // If non-empty, skips the test, displaying the string as a message
    skipTest?: string;
}

export function testWithLog(expectation: string, callback?: (this: Context) => Promise<unknown>): Test {
    return testWithPrep(expectation, [], callback);
}
