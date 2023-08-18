// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Context, Test } from "mocha";
// eslint-disable-next-line no-restricted-imports
import { disableBreakOnAssert } from "../../src/fixed_assert";
import { ITestPreparation, ITestPreparationResult, testWithPrep } from "./testWithPrep";

export class WithoutBreakOnAssertPrep implements ITestPreparation {
    public static readonly instance: WithoutBreakOnAssertPrep = new WithoutBreakOnAssertPrep();

    public pretest(this: Mocha.Context): ITestPreparationResult {
        disableBreakOnAssert(true);
        return {
            postTestActions: () => disableBreakOnAssert(false)
        };
    }
}

export function testWithoutBreakOnAssert(expectation: string, callback?: (this: Context) => void | Promise<unknown>): Test {
    return testWithPrep(
        expectation,
        [WithoutBreakOnAssertPrep.instance],
        callback);
}
