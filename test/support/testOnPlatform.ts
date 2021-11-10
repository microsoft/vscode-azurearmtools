// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Context, Test } from "mocha";
import { DEFAULT_TESTCASE_TIMEOUT_MS, isWin32 } from "../testConstants";
import { ITestPreparation, ITestPreparationResult, testWithPrep } from "./testWithPrep";

export class RequiresWin32 implements ITestPreparation {
    public static readonly instance: RequiresWin32 = new RequiresWin32();

    public pretest(this: Context): ITestPreparationResult {
        if (!isWin32) {
            return {
                skipTest: "this is not a Windows platform"
            };
        } else {
            this.timeout(DEFAULT_TESTCASE_TIMEOUT_MS);
            return {};
        }
    }
}

export class RequiresMacLinux implements ITestPreparation {
    public static readonly instance: RequiresMacLinux = new RequiresMacLinux();

    public pretest(this: Context): ITestPreparationResult {
        if (isWin32) {
            return {
                skipTest: "this is not a Mac/Linux platform"
            };
        } else {
            this.timeout(DEFAULT_TESTCASE_TIMEOUT_MS);
            return {};
        }
    }
}

export function testOnWin32(expectation: string, callback?: (this: Context) => Promise<unknown>): Test {
    return testWithPrep(
        expectation,
        [RequiresWin32.instance],
        callback);
}

export function testOnMacLinux(expectation: string, callback?: (this: Context) => Promise<unknown>): Test {
    return testWithPrep(
        expectation,
        [RequiresWin32.instance],
        callback);
}
