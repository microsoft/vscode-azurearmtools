/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "../fixed_assert";

/**
 * Represents a scalar value that must be initialized before its getValue is called
 */
export class InitializeBeforeUse<T> {
    private _value: { value: T; initialized: true } | { initialized: false } = { initialized: false };

    public setValue(value: T): void {
        this._value = { value: value, initialized: true };
    }

    public getValue(): T {
        if (this._value.initialized) {
            return this._value.value;
        } else {
            assert.fail("ExtensionVariables has not been fully initialized");
        }
    }
}
