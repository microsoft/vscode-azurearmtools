// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { Uri } from "vscode";
import { decodeLinkedTemplateScheme, parseUri, prependLinkedTemplateScheme as encodeLinkedTemplateScheme, stringifyUri } from "../extension.bundle";

// tslint:disable:max-func-body-length no-http-string max-line-length no-null-keyword

suite("linkedTemplateScheme", () => {
    suite("removeLinkedTemplateScheme", () => {
        test("not there -> noop", () => {
            const uriString = 'https://fake.blob.core.windows.net/blobby/subfolder/child.json?sv=2019-12-12&si=sawdeploy&sr=b&sig=wsrxXCkFbk2IVpk489XIR0KDFyzJaeQHwFvTm5mdQcU%FF';
            const uri = parseUri(uriString);
            assert.equal(uri.toString(true), uriString);

            let uri2 = decodeLinkedTemplateScheme(uri);
            assert.equal(uri2.toString(true), uriString);
        });

        test("is there -> remove", () => {
            const uriString = 'linked-template:https://fake.blob.core.windows.net/blobby/subfolder/child.json?sv=2019-12-12&si=sawdeploy&sr=b&sig=wsrxXCkFbk2IVpk489XIR0KDFyzJaeQHwFvTm5mdQcU%FF';
            const uriStringWithScheme = `linked-template:${uriString}`;
            const uriWithScheme = parseUri(uriStringWithScheme);
            assert.equal(uriWithScheme.toString(true), uriStringWithScheme);

            let uri2 = decodeLinkedTemplateScheme(uriWithScheme);
            assert.equal(uri2.toString(true), uriString);
        });
    });

    suite("addLinkedTemplateScheme", () => {
        test("not there -> add", () => {
            const uriString = 'https://fake.blob.core.windows.net/blobby/subfolder/child.json?sv=2019-12-12&si=sawdeploy&sr=b&sig=wsrxXCkFbk2IVpk489XIR0KDFyzJaeQHwFvTm5mdQcU%FF';
            const uriStringWithScheme = `linked-template:${uriString}`;
            const uri = parseUri(uriString);

            let uri2 = encodeLinkedTemplateScheme(uri);
            assert.equal(uri2.toString(true), uriStringWithScheme);
        });

        test("is there -> don't add", () => {
            const uriString = 'https://fake.blob.core.windows.net/blobby/subfolder/child.json?sv=2019-12-12&si=sawdeploy&sr=b&sig=wsrxXCkFbk2IVpk489XIR0KDFyzJaeQHwFvTm5mdQcU%FF';
            const uriStringWithScheme = `linked-template:${uriString}`;
            const uriWithScheme = parseUri(uriStringWithScheme);

            let uri2 = encodeLinkedTemplateScheme(uriWithScheme);
            assert.equal(uri2.toString(true), uriStringWithScheme);
        });
    });

    suite("lossless round-tripping #1281", () => {
        test("round-trip 1", () => {
            const original = `https://sawdeploy.blob.core.windows.net/test/child.json?sv%3D2019-12-12%26st%3D2021-04-10T00%3A00%3A27Z%26se%3D2021-04-11T00%3A01%3A00Z%26sr%3Db%26sp%3Dr%26sig%3D29komgppogGhkO1Xy7mjE1oAWpZ%2FSZzmT%2BXttFPbLxs%3D`;
            const encoded = encodeLinkedTemplateScheme(Uri.parse(original));
            const decoded = decodeLinkedTemplateScheme(encoded);
            assert.equal(decoded, original);
        });

        test("round-trip 2", () => {
            const original = `https://sawdeploy.blob.core.windows.net/test/child.json?sv%3D2019-12-12%26st%3D2021-04-10T00%3A00%3A27Z%26se%3D2021-04-11T00%3A01%3A00Z%26sr%3Db%26sp%3Dr%26sig%3D29komgppogGhkO1Xy7mjE1oAWpZ%2FSZzmT%2BXttFPbLxs%3D`;
            const encoded = encodeLinkedTemplateScheme(Uri.parse(original));
            const encodedAsString = stringifyUri(encoded);
            const decoded = decodeLinkedTemplateScheme(parseUri(encodedAsString));
            assert.equal(decoded, original);
        });

        test("round-trip 3", () => {
            const original = `https://sawdeploy.blob.core.windows.net/test/child.json?sv%3D2019-12-12%26st%3D2021-04-10T00%3A00%3A27Z%26se%3D2021-04-11T00%3A00%3A00Z%26sr%3Db%26sp%3Dr%26sig%3DVzUR3rEwRDBK75F7riLkt%2FqQNhl5LbTQ0tjoLAr5M7w%3D`;
            const encoded = encodeLinkedTemplateScheme(parseUri(original));
            const decoded = decodeLinkedTemplateScheme(encoded);
            assert.equal(decoded, original);
        });

        test("round-trip 4", () => {
            const original = `https://sawdeploy.blob.core.windows.net/test/child.json?sv%3D2019-12-12%26st%3D2021-04-10T00%3A00%3A27Z%26se%3D2021-04-11T00%3A01%3A00Z%26sr%3Db%26sp%3Dr%26sig%3D29komgppogGhkO1Xy7mjE1oAWpZ%2FSZzmT%2BXttFPbLxs%3D`;
            const parsed = parseUri(original);
            const stringified = stringifyUri(parsed);
            const parsed2 = parseUri(stringified);
            assert.equal(parsed2.query, parsed.query);
        });
    });
});
