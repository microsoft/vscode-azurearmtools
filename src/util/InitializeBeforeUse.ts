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

    public constructor(private propertyName: string, private allowChangingValue: boolean = false) {
    }

    public get hasValue(): boolean {
        return this._value.initialized;
    }

    public set value(value: T) {
        if (!this._value.initialized) {
            this._value = { value: value, initialized: true };
        } else {
            if (!this.allowChangingValue) {
                assert.fail(`InitializeBeforeUse: Value has already been set: ${this.propertyName}`);
            }
        }
    }

    public get value(): T {
        if (this._value.initialized) {
            return this._value.value;
        } else {
            assert.fail(`InitializeBeforeUse: Trying to retrieve value from ExtensionVariables before it has been initialized: ${this.propertyName}`);
        }
    }
}
