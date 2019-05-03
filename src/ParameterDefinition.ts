// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import * as Json from "./JSON";
import * as language from "./Language";

/**
 * This class represents the definition of a parameter in a deployment template.
 */
export class ParameterDefinition {
    private _description: string | undefined | null;
    private _defaultValue: Json.Value | undefined | null;

    constructor(private _property: Json.Property) {
        assert(_property);
    }

    public get name(): Json.StringValue {
        return this._property.name;
    }

    public get span(): language.Span {
        return this._property.span;
    }

    public get description(): string {
        if (this._description === undefined) {
            this._description = null;

            const parameterDefinition: Json.ObjectValue = Json.asObjectValue(this._property.value);
            if (parameterDefinition) {
                const metadata: Json.ObjectValue = Json.asObjectValue(parameterDefinition.getPropertyValue("metadata"));
                if (metadata) {
                    const description: Json.StringValue = Json.asStringValue(metadata.getPropertyValue("description"));
                    if (description) {
                        this._description = description.toString();
                    }
                }
            }
        }
        return this._description;
    }

    public get defaultValue(): Json.Value {
        if (this._defaultValue === undefined) {
            this._defaultValue = null;

            const parameterDefinition: Json.ObjectValue = Json.asObjectValue(this._property.value);
            if (parameterDefinition) {
                this._defaultValue = parameterDefinition.getPropertyValue("defaultValue");
            }
        }
        return this._defaultValue;
    }
}
