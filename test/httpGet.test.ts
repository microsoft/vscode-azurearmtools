// tslint:disable: no-useless-files
// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/*

// tslint:disable:no-http-string
// tslint:disable:promise-function-async

import * as assert from "assert";
import { httpGet } from "../extension.bundle";
import { networkTest } from "./networkTest.test";

suite("HttpClient", () => {
    suite("get(string)", () => {
        networkTest("with existing site ('http://www.bing.com')", () => {
            return httpGet("http://www.bing.com")
                .then((content: string) => {
                    assert(content, "Content was undefined, null, or empty");
                    assert(content.includes("Bing"), "Content did not include the phrase 'Bing'");
                });
        });

        networkTest("with existing site without 'http' ('www.bing.com')", () => {
            return httpGet("www.bing.com")
                .then((content: string) => {
                    assert(content, "Content was undefined, null, or empty");
                    assert(content.includes("Bing"), "Content did not include the phrase 'Bing'");
                });
        });

        networkTest("with redirection ('https://storageexplorer.com') (redirection)", () => {
            return httpGet("https://storageexplorer.com")
                .then((content: string) => {
                    assert(content, "No content");
                    assert(content.includes("Azure Storage Explorer"), "Doesn't include 'Azure Storage Explorer'");
                });
        });

        networkTest("with non-existing site ('http://i.dont.exist.com')", () => {
            return httpGet("http://i.dont.exist.com")
                .then((content: string) => {
                    assert(false, "Expected the catch function to be called.");
                })
                // tslint:disable-next-line:no-any
                .catch((reason: { code?: string; errno?: number; hostname?: string; syscall?: string }) => {
                    assert(reason);
                    if (reason.code === 'EAI_AGAIN') {
                        return;
                    }

                    assert.deepStrictEqual(reason.code, "ENOTFOUND");
                    assert.deepStrictEqual(reason.errno, "ENOTFOUND");
                    assert.deepStrictEqual(reason.hostname, "i.dont.exist.com");
                    assert.deepStrictEqual(reason.syscall, "getaddrinfo");
                });
        });

        // Not currently using these

        // networkTest("with https ('https://azurermtools.blob.core.windows.net/redirects/TemplateExplorerRedirect2.6.0.txt')", () => {
        //     return HttpClient.get("https://azurermtools.blob.core.windows.net/redirects/TemplateExplorerRedirect2.6.0.txt")
        //         .then((content: string) => {
        //             assert.deepStrictEqual(content.trim(), "https://azurermtools.blob.core.windows.net/templateexplorer2-6-0/");
        //         });
        // });

        // networkTest("with 'https://azurermtools.blob.core.windows.net/assets-azuresdk-2-9-0/ExpressionMetadata.json'", () => {
        //     return HttpClient.get("https://azurermtools.blob.core.windows.net/assets-azuresdk-2-9-0/ExpressionMetadata.json")
        //         .then((content: string) => {
        //             assert(content);
        //         });
        // });
    });
});
*/
