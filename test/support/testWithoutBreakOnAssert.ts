// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Context, Test } from "mocha";
// eslint-disable-next-line no-restricted-imports
import { ITestPreparation, ITestPreparationResult, testWithPrep } from "./testWithPrep";

export class WithoutBreakOnAssertPrep implements ITestPreparation {
    public static readonly instance: WithoutBreakOnAssertPrep = new WithoutBreakOnAssertPrep();

    public pretest(this: Mocha.Context): ITestPreparationResult {
        process.env.DISABLE_BREAK_ON_ASSERT = 'true';
        return {
            postTestActions: () => process.env.DISABLE_BREAK_ON_ASSERT = ''
        };
    }
}

export function testWithoutBreakOnAssert(expectation: string, callback?: (this: Context) => void | Promise<unknown>): Test {
    return testWithPrep(
        expectation,
        [WithoutBreakOnAssertPrep.instance],
        callback);
}
