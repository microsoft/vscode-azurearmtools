// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as assert from "assert";

export namespace assertEx {
    type keyedObject = { [key: string]: unknown };

    export interface IEqualExOptions {
        /** If true, will only match against the properties in the expected object */
        ignorePropertiesNotInExpected: boolean;
    }

    export function strictEqual<T>(actual: T, expected: T, options: {}, message?: string): asserts actual is T {
        if (typeof actual === 'string' && typeof expected === 'string') {
            const actualNoWitespace = actual.replace(/\s+/g, ' ');
            const expectedNoWhitespace = expected.replace(/\s+/g, ' ');
            if (expectedNoWhitespace === actualNoWitespace) {
                assert.strictEqual(actual, expected, `${message ?? 'String match failed'}\n*** STRINGS DIFFER ONLY IN WHITESPACE ***`);
                return;
            } else if (actual.toLowerCase() === expected.toLowerCase()) {
                assert.strictEqual(actual, expected, `${message ?? 'String match failed'}\n*** STRINGS DIFFER ONLY IN CASING ***`);
                return;
            }
        }

        assert.strictEqual(actual, expected, message);
    }

    export function deepEqual<T>(actual: T, expected: T, options: IEqualExOptions): asserts actual is T {
        let partial: Partial<T> = actual;
        if (options.ignorePropertiesNotInExpected) {
            partial = <Partial<T>>deepPartialClone(actual, expected);
        }

        assert.deepStrictEqual(partial, expected);
    }

    /**
     * Creates a deep clone of 'o' that includes only the (deep) properties of 'shape'
     */
    function deepPartialClone(o: unknown, shape: unknown): unknown {
        if (Array.isArray(o) || Array.isArray(shape)) {
            if (!(Array.isArray(o) || Array.isArray(shape))) {
                // Only one is an array
                return o;
            }

            // tslint:disable-next-line: prefer-array-literal
            const a = <unknown[]>o;
            const arrayShape = <unknown[]>shape;
            const newArray: unknown[] = [];

            for (let i = 0; i < Math.max(a.length, arrayShape.length); ++i) {
                newArray[i] = deepPartialClone(a[i], arrayShape[i]);
            }

            return newArray;
        } else if (shape instanceof Object && o instanceof Object) {
            const clonedObject = <keyedObject>{};

            for (const propName of Object.getOwnPropertyNames(shape)) {
                clonedObject[propName] = deepPartialClone((<keyedObject>o)[propName], (<keyedObject>shape)[propName]);
            }

            return clonedObject;
        } else {
            return o;
        }
    }
}
