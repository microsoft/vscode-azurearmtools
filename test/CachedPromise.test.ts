// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-func-body-length

import * as assert from "assert";
import { CachedPromise } from "../extension.bundle";

suite("CachedPromise<T>", () => {
    test("Sequential calls", async () => {
        const cv = new CachedPromise<string>();
        let calls = 0;

        // tslint:disable-next-line: promise-function-async
        function getPromise(): Promise<string> {
            return cv.getOrCachePromise(async (): Promise<string> => {
                ++calls;
                return calls.toString();
            });
        }

        assert.equal(await getPromise(), "1");
        assert.equal(await getPromise(), "1");
    });

    test("Concurrent calls", async () => {
        const cv = new CachedPromise<string>();
        let calls = 0;

        // tslint:disable-next-line: promise-function-async
        function getPromise(): Promise<string> {
            return cv.getOrCachePromise(async (): Promise<string> => {
                ++calls;
                return calls.toString();
            });
        }

        let promise1 = getPromise();
        let promise2 = getPromise();

        assert.equal(await promise1, "1");
        assert.equal(await promise2, "1");
    });

    test("Failed synchronous promises", async () => {
        const cv = new CachedPromise<string>();

        // tslint:disable-next-line: promise-function-async
        function getPromise(): Promise<string> {
            return cv.getOrCachePromise(async (): Promise<string> => {
                throw new MyError();
            });
        }

        let error1;
        try {
            await getPromise();
        } catch (error) {
            error1 = error;
        }
        assert(error1 instanceof MyError);

        let error2;
        try {
            await getPromise();
        } catch (error) {
            error2 = error;
        }
        assert(error2 instanceof MyError);
    });

    test("Failed concurrent promises", async () => {
        const cv = new CachedPromise<string>();

        // tslint:disable-next-line: promise-function-async
        function getPromise(): Promise<string> {
            return cv.getOrCachePromise(async (): Promise<string> => {
                throw new MyError();
            });
        }

        let promise1: Promise<string> = getPromise();
        let promise2: Promise<string> = getPromise();
        assert(promise1 === promise2);

        let error1;
        try {
            await promise1;
        } catch (error) {
            error1 = error;
        }
        assert(error1 instanceof MyError);

        let error2;
        try {
            await getPromise();
        } catch (error) {
            error2 = error;
        }
        assert(error2 instanceof MyError);
    });

    test("Handles undefined values", async () => {
        const cv = new CachedPromise<string | undefined>();

        // tslint:disable-next-line: promise-function-async
        function getPromise(): Promise<string | undefined> {
            return cv.getOrCachePromise(async (): Promise<string | undefined> => {
                return undefined;
            });
        }

        assert.equal(await getPromise(), undefined);
    });

    test("Handles null values", async () => {
        const cv = new CachedPromise<string | null>();

        // tslint:disable-next-line: promise-function-async
        function getPromise(): Promise<string | null> {
            return cv.getOrCachePromise(async (): Promise<string | null> => {
                return null;
            });
        }

        assert.equal(await getPromise(), null);
    });
});

class MyError extends Error {
}
