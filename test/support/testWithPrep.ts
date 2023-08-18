// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { Context, Test } from "mocha";
import { writeToLog } from "./testLog";

export interface ITestPreparation {
    // Perform pretest preparations, and return a Disposable which will revert those changes
    pretest(this: Context): ITestPreparationResult;
}

export interface ITestPreparationResult {
    postTestActions?(): void;

    // If non-empty, skips the test, displaying the string as a message
    skipTest?: string;
}

export function testWithPrep(expectation: string, preparations?: ITestPreparation[], callback?: (this: Context) => void | Promise<unknown>): Test {
    try {
        return test(
            expectation,
            async function (this: Context): Promise<unknown> {
                const postTestActions: (() => void)[] = [];

                try {
                    if (!callback) {
                        // This is a pending test
                        this.skip();
                    }

                    // Perform pre-test preparations
                    for (const prep of preparations ?? []) {
                        const prepResult = prep.pretest.call(this);
                        if (prepResult.skipTest) {
                            writeToLog(`Skipping test because: ${prepResult.skipTest}`);
                            this.skip();
                        }

                        if (prepResult.postTestActions) {
                            postTestActions.push(prepResult.postTestActions);
                        }
                    }

                    // Perform the test
                    try {
                        return await callback.call(this);
                    } catch (error) {
                        if ((<{ message?: string }>error).message === 'sync skip') {
                            // test skipped
                        } else {
                            throw error;
                        }
                    }
                }
                finally {
                    // Perform post-test actions
                    for (const post of postTestActions) {
                        post();
                    }
                }
            }
        );
    } catch (err) {
        assert.fail("testWithPrep shouldn't throw");
    }
}
