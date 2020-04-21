// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ITest, ITestCallbackContext } from "mocha";

export interface ITestPreparation {
    // Perform pretest preparations, and return a Disposable which will revert those changes
    pretest(this: ITestCallbackContext): ITestPreparationResult;
}

export interface ITestPreparationResult {
    postTest?(): void;

    // If non-empty, skips the test, displaying the string as a message
    skipTest?: string;
}

export function testWithPrep(expectation: string, preparations?: ITestPreparation[], callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    return test(
        expectation,
        async function (this: ITestCallbackContext): Promise<unknown> {
            const postTests: (() => void)[] = [];

            try {
                if (!callback) {
                    // This is a pending test - just pass it through as a pending test
                    test(expectation);
                    return;
                }

                // Perform pre-test preparations
                for (let prep of preparations ?? []) {
                    const prepResult = prep.pretest.call(this);
                    if (prepResult.skipTest) {
                        console.log(`Skipping test because: ${prepResult.skipTest}`);
                        this.skip();
                        return;
                    }

                    if (prepResult.postTest) {
                        postTests.push(prepResult.postTest);
                    }
                }

                // Perform the test
                return await callback.call(this);
            }
            finally {
                // Perform post-test preparations
                for (let post of postTests) {
                    post();
                }
            }
        }
    );
}
