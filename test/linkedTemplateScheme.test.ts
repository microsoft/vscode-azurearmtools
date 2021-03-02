// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { prependLinkedTemplateScheme, removeLinkedTemplateScheme } from "../extension.bundle";
import { parseUri, stringifyUri } from "../src/util/uri";

// tslint:disable:max-func-body-length no-http-string max-line-length no-null-keyword

suite("linkedTemplateScheme", () => {
    suite("removeLinkedTemplateScheme", () => {
        test("not there -> noop", () => {
            const uriString = 'https://fake.blob.core.windows.net/blobby/subfolder/child.json?sv=2019-12-12&si=sawdeploy&sr=b&sig=wsrxXCkFbk2IVpk489XIR0KDFyzJaeQHwFvTm5mdQcU%FF';
            const uri = parseUri(uriString);
            assert.equal(stringifyUri(uri), uriString);

            let uri2 = removeLinkedTemplateScheme(uri);
            assert.equal(stringifyUri(uri2), uriString);
        });

        test("is there -> remove", () => {
            const uriString = 'linked-template:https://fake.blob.core.windows.net/blobby/subfolder/child.json?sv=2019-12-12&si=sawdeploy&sr=b&sig=wsrxXCkFbk2IVpk489XIR0KDFyzJaeQHwFvTm5mdQcU%FF';
            const uriStringWithScheme = `linked-template:${uriString}`;
            const uriWithScheme = parseUri(uriStringWithScheme);
            assert.equal(stringifyUri(uriWithScheme), uriStringWithScheme);

            let uri2 = removeLinkedTemplateScheme(uriWithScheme);
            assert.equal(stringifyUri(uri2), uriString);
        });
    });

    suite("addLinkedTemplateScheme", () => {
        test("not there -> add", () => {
            const uriString = 'https://fake.blob.core.windows.net/blobby/subfolder/child.json?sv=2019-12-12&si=sawdeploy&sr=b&sig=wsrxXCkFbk2IVpk489XIR0KDFyzJaeQHwFvTm5mdQcU%FF';
            const uriStringWithScheme = `linked-template:${uriString}`;
            const uri = parseUri(uriString);

            let uri2 = prependLinkedTemplateScheme(uri);
            assert.equal(stringifyUri(uri2), uriStringWithScheme);
        });

        test("is there -> don't add", () => {
            const uriString = 'https://fake.blob.core.windows.net/blobby/subfolder/child.json?sv=2019-12-12&si=sawdeploy&sr=b&sig=wsrxXCkFbk2IVpk489XIR0KDFyzJaeQHwFvTm5mdQcU%FF';
            const uriStringWithScheme = `linked-template:${uriString}`;
            const uriWithScheme = parseUri(uriStringWithScheme);

            let uri2 = prependLinkedTemplateScheme(uriWithScheme);
            assert.equal(stringifyUri(uri2), uriStringWithScheme);
        });
    });
});
