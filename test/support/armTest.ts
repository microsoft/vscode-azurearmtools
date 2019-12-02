// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ITest, ITestCallbackContext } from "mocha";
import { DISABLE_LANGUAGE_SERVER } from "../testConstants";
import { runWithRealFunctionMetadata } from "../TestData";
import { diagnosticsTimeout } from "./diagnostics";

export function armTest(
    expectation: string,
    options: {
        requiresLanguageServer?: boolean;
        useRealFunctionMetadata?: boolean;
    },
    callback?: (this: ITestCallbackContext) => Promise<unknown>
): ITest {
    return test(
        expectation,
        async function (this: ITestCallbackContext): Promise<unknown> {
            if (options.requiresLanguageServer && DISABLE_LANGUAGE_SERVER) {
                console.log("Skipping test because DISABLE_LANGUAGE_SERVER is set");
                this.skip();
            } else {
                if (options.requiresLanguageServer) {
                    this.timeout(diagnosticsTimeout);
                }

                if (callback) {
                    if (options.useRealFunctionMetadata) {
                        // tslint:disable-next-line: no-unsafe-any
                        return await runWithRealFunctionMetadata(callback.bind(this));
                    } else {
                        // tslint:disable-next-line: no-unsafe-any
                        return await callback.call(this);
                    }
                } else {
                    test(expectation); // Pending test (no callback)
                }
            }
        });
}
