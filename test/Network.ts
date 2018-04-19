import * as dns from "dns";
import { ITestCallbackContext } from "mocha";

let internetConnected: Promise<boolean>;
/**
 * Determine if the running application has internet connectivity.
 */
function hasInternetConnection(): Promise<boolean> {
    if (internetConnected === undefined) {
        internetConnected = new Promise<boolean>((resolve, reject) => {
            dns.lookup("www.microsoft.com", (error: Error, address: string, family: number) => {
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
export function networkTest(testName: string, testFunction: () => void | Promise<any>) {
    test(testName, function (this: ITestCallbackContext) {
        this.timeout(10000);

        return hasInternetConnection()
            .then((internetConnected: boolean) => {
                if (internetConnected) {
                    return testFunction();
                }
                else {
                    return this.skip();
                }
            });
    });
}
