// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType, toValidExpressionType } from './ExpressionType';
import { assert } from './fixed_assert';
import { IParameterDefinition } from "./IParameterDefinition";
import * as Json from "./JSON";
import * as language from "./Language";

/**
 * This class represents the definition of a top-level parameter in a deployment template.
 */
export class ParameterDefinition implements IParameterDefinition {
    constructor(private _property: Json.Property) {
        assert(_property);
    }

    public get name(): Json.StringValue {
        return this._property.name;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public get type(): Json.Value | null {
        const parameterDefinition: Json.ObjectValue | null = Json.asObjectValue(this._property.value);
        if (parameterDefinition) {
            return parameterDefinition.getPropertyValue("type");
        }

        return null;
    }

    // Returns null if not a valid expression type
    public get validType(): ExpressionType | null {
        return this.type ? toValidExpressionType(this.type.toString()) : null;
    }

    public get span(): language.Span {
        return this._property.span;
    }

    public get description(): string | null {
        const parameterDefinition: Json.ObjectValue | null = Json.asObjectValue(this._property.value);
        if (parameterDefinition) {
            const metadata: Json.ObjectValue | null = Json.asObjectValue(parameterDefinition.getPropertyValue("metadata"));
            if (metadata) {
                const description: Json.StringValue | null = Json.asStringValue(metadata.getPropertyValue("description"));
                if (description) {
                    return description.toString();
                }
            }
        }

        return null;
    }

    public get defaultValue(): Json.Value | null {
        const parameterDefinition: Json.ObjectValue | null = Json.asObjectValue(this._property.value);
        if (parameterDefinition) {
            return parameterDefinition.getPropertyValue("defaultValue");
        }

        return null;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.name.toString();
    }
}
