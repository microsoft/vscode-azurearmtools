// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import { HttpClient } from "../src/HttpClient";

import { networkTest } from "./Network";

suite("HttpClient", () => {
    suite("get(string)", () => {
        networkTest("with existing site ('http://www.bing.com')", () => {
            return HttpClient.request("http://www.bing.com")
                .then((content: string) => {
                    assert(content, "Content was undefined, null, or empty");
                    assert(content.includes("Word Online"), "Content did not include the phrase 'Word Online'");
                });
        });

        networkTest("with existing site without 'http' ('www.bing.com')", () => {
            return HttpClient.request("www.bing.com")
                .then((content: string) => {
                    assert(content, "Content was undefined, null, or empty");
                    assert(content.includes("Word Online"), "Content did not include the phrase 'Word Online'");
                });
        });

        networkTest("with redirection ('https://storageexplorer.com') (redirection)", () => {
            return HttpClient.request("https://storageexplorer.com")
                .then((content: string) => {
                    assert(content, "No content");
                    assert(content.includes("Azure Storage Explorer"), "Doesn't include");
                })
        });

        networkTest("with non-existing site ('http://i.dont.exist.com')", () => {
            return HttpClient.request("http://i.dont.exist.com")
                .then((content: string) => {
                    assert(false, "Expected the catch function to be called.");
                })
                .catch((reason: any) => {
                    assert(reason);
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
