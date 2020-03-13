// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from '../fixed_assert';
import { IUsageInfo } from '../Hover';
import { DefinitionKind, INamedDefinition } from '../INamedDefinition';
import * as Json from "../JSON";
import * as language from "../Language";

export function isParameterValueDefinition(definition: INamedDefinition): definition is ParameterValueDefinition {
    return definition.definitionKind === DefinitionKind.ParameterValue;
}

/**
 * This class represents the definition of a parameter value in a deployment parameter file
 */
export class ParameterValueDefinition implements INamedDefinition {
    public readonly definitionKind: DefinitionKind = DefinitionKind.Parameter;

    constructor(private readonly _property: Json.Property) {
        assert(_property);
    }

    public get nameValue(): Json.StringValue {
        return this._property.nameValue;
    }

    public get fullSpan(): language.Span {
        return this._property.span;
    }

    public get value(): Json.Value | undefined {
        const parameterValue: Json.ObjectValue | undefined = Json.asObjectValue(this._property.value);
        if (parameterValue) {
            return parameterValue.getPropertyValue("value");
        }

        return undefined;
    }

    public get usageInfo(): IUsageInfo {
        return {
            usage: this.nameValue.unquotedValue,
            friendlyType: "parameter value",
            description: "asdf" //this.description
        };
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return `${this.nameValue.toString()} = ${this.value?.__debugDisplay}`;
    }
}
