// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:promise-function-async no-implicit-dependencies

import * as dns from "dns";
import { Context } from "mocha";

let internetConnected: Promise<boolean>;
/**
 * Determine if the running application has internet connectivity.
 */
function hasInternetConnection(): Promise<boolean> {
    if (internetConnected === undefined) {
        // tslint:disable-next-line:typedef
        internetConnected = new Promise<boolean>((resolve, _reject) => {
            dns.lookup("www.microsoft.com", (error: Error | null, _address: string, _family: number) => {
                resolve(!error);
            });
        });
    }
    return internetConnected;
}

/**
 * A test that is dependant on internet connectivity. If the application is not currently connected
 * to the internet, then the test will be skipped.
 */
// tslint:disable-next-line:no-any
export function networkTest(testName: string, testFunction: () => void | Promise<any>): void {
    test(testName, function (this: Context): Promise<void> {
        this.timeout(20000);

        return hasInternetConnection()
            .then((connected: boolean) => {
                if (connected) {
                    return testFunction();
                } else {
                    return this.skip();
                }
            });
    });
}
