// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from "../../fixed_assert";
import * as Json from "../../language/json/JSON";
import { ExpressionType, toValidExpressionType } from "./ExpressionType";

/**
 * This class represents the definition of a user-defined output in a deployment template.
 */
export class OutputDefinition {
    constructor(private _value: Json.ObjectValue) {
        assert(_value);
    }

    public get outputType(): Json.StringValue | undefined {
        return Json.asStringValue(this._value.getPropertyValue("type"));
    }

    // Returns undefined if not a valid type
    public get validOutputType(): ExpressionType | undefined {
        return toValidExpressionType(this.outputType && this.outputType.unquotedValue);
    }

    public get value(): Json.StringValue | undefined {
        return Json.asStringValue(this._value.getPropertyValue("value"));
    }
}
