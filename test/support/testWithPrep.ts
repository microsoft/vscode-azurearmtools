// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { ITest, ITestCallbackContext } from "mocha";
import { writeToLog } from "./testLog";

export interface ITestPreparation {
    // Perform pretest preparations, and return a Disposable which will revert those changes
    pretest(this: ITestCallbackContext): ITestPreparationResult;
}

export interface ITestPreparationResult {
    postTestActions?(): void;

    // If non-empty, skips the test, displaying the string as a message
    skipTest?: string;
}

export function testWithPrep(expectation: string, preparations?: ITestPreparation[], callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    try {
        return test(
            expectation,
            async function (this: ITestCallbackContext): Promise<unknown> {
                const postTestActions: (() => void)[] = [];

                try {
                    if (!callback) {
                        // This is a pending test
                        this.skip();
                        return;
                    }

                    // Perform pre-test preparations
                    for (let prep of preparations ?? []) {
                        const prepResult = prep.pretest.call(this);
                        if (prepResult.skipTest) {
                            writeToLog(`Skipping test because: ${prepResult.skipTest}`);
                            this.skip();
                            return;
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
                    for (let post of postTestActions) {
                        post();
                    }
                }
            }
        );
    } catch (err) {
        assert.fail("Shouldn't throw");
    }
}
