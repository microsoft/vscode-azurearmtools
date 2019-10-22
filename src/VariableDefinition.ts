// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Language } from '../extension.bundle';
import { assert } from './fixed_assert';
import { DefinitionKind, INamedDefinition } from './INamedDefinition';
import * as Json from "./JSON";

/**
 * This class represents the definition of a top-level parameter in a deployment template.
 */
export class VariableDefinition implements INamedDefinition {

    public readonly definitionKind: DefinitionKind = DefinitionKind.Variable;

    constructor(private readonly _property: Json.Property) {
        assert(_property);
    }

    public get nameValue(): Json.StringValue {
        return this._property.name;
    }

    public get value(): Json.Value | null {
        return this._property.value;
    }

    public get span(): Language.Span {
        return this._property.span;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.nameValue.toString();
    }
}
