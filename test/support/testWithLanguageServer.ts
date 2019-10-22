// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ITest, ITestCallbackContext } from "mocha";
import { DISABLE_LANGUAGE_SERVER_TESTS } from "../testConstants";
import { diagnosticsTimeout } from "./diagnostics";

export function testWithLanguageServer(expectation: string, callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    return test(
        expectation,
        async function (this: ITestCallbackContext): Promise<unknown> {
            if (DISABLE_LANGUAGE_SERVER_TESTS) {
                console.log("Skipping test because DISABLE_LANGUAGE_SERVER_TESTS is enabled");
                this.skip();
            } else {
                // tslint:disable-next-line: no-unsafe-any no-any prefer-template restrict-plus-operands
                console.log("timeout=" + (<any>this).timeout());
                this.timeout(diagnosticsTimeout);
                // tslint:disable-next-line: no-unsafe-any no-any prefer-template restrict-plus-operands
                console.log("timeout=" + (<any>this).timeout());
                if (callback) {
                    // tslint:disable-next-line: no-unsafe-any
                    return await callback.call(this);
                }
            }
        });
}
