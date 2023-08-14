/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parseError } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { ext, wrapError } from '../extension.bundle';

suite("wrapError", () => {
    test("outer string, inner string", () => {
        const wrapped = wrapError('Outer error.', 'Inner error.');
        assert(wrapped instanceof Error);
        assert.equal(parseError(wrapped).message, `Outer error. ${ext.EOL}Inner error.`);
    });

    test("outer string, inner error", () => {
        const inner = new Error('Inner error.');
        const wrapped = wrapError('Outer error.', inner);
        assert(wrapped instanceof Error);
        assert.equal(parseError(wrapped).message, `Outer error. ${ext.EOL}Inner error.`);
        assert.equal(wrapped.stack, inner.stack);
        assert.equal(wrapped.name, inner.name);
    });

    test("read-only properties", () => {
        const inner = new Error();
        Object.defineProperty(inner, "message", {
            value: "Inner message.",
            writable: false
        });

        let isReadOnly: boolean = false;
        try {
            inner.message = "shouldn't be able to change message";
        } catch (err) {
            isReadOnly = true;
        }
        assert(isReadOnly);

        const wrapped = wrapError('Outer error.', inner);
        assert(wrapped instanceof Error);
        assert.equal(parseError(wrapped).message, `Outer error. ${ext.EOL}Inner message.`);
        assert.equal(wrapped.stack, inner.stack);
        assert.equal(wrapped.name, inner.name);
    });
});
