// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { CachedValue } from "./CachedValue";
import * as Json from "./JSON";
import * as language from "./Language";

/**
 * This class represents the definition of a parameter in a deployment template.
 */
export class ParameterDefinition {
    private _description: CachedValue<string | null> = new CachedValue<string | null>();
    private _defaultValue: CachedValue<Json.Value | null> = new CachedValue<Json.Value | null>();

    constructor(private _property: Json.Property) {
        assert(_property);
    }

    public get name(): Json.StringValue | null {
        return this._property.name;
    }

    public get span(): language.Span {
        return this._property.span;
    }

    public get description(): string | null {
        return this._description.getOrCacheValue(() => {
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
        });
    }

    public get defaultValue(): Json.Value | null {
        return this._defaultValue.getOrCacheValue(() => {
            const parameterDefinition: Json.ObjectValue | null = Json.asObjectValue(this._property.value);
            if (parameterDefinition) {
                return parameterDefinition.getPropertyValue("defaultValue");
            }

            return null;
        });
    }
}
