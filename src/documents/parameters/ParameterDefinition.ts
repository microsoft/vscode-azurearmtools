// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from "../../fixed_assert";
import { DefinitionKind, INamedDefinition } from "../../language/INamedDefinition";
import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import { IUsageInfo } from "../../vscodeIntegration/UsageInfoHoverInfo";
import { ExpressionType, toValidExpressionType } from "../templates/ExpressionType";
import { IJsonDocument } from "../templates/IJsonDocument";
import { IParameterDefinition } from "./IParameterDefinition";

export function isParameterDefinition(definition: INamedDefinition): definition is IParameterDefinition {
    return definition.definitionKind === DefinitionKind.Parameter;
}

/**
 * This class represents the definition of a top-level parameter in a deployment template.
 */
export class ParameterDefinition implements IParameterDefinition {
    public readonly definitionKind: DefinitionKind = DefinitionKind.Parameter;

    constructor(public readonly document: IJsonDocument, private readonly _property: Json.Property) {
        assert(_property);
    }

    public get nameValue(): Json.StringValue {
        return this._property.nameValue;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public get type(): Json.Value | undefined {
        const parameterDefinition: Json.ObjectValue | undefined = Json.asObjectValue(this._property.value);
        if (parameterDefinition) {
            return parameterDefinition.getPropertyValue("type");
        }

        return undefined;
    }

    // Returns undefined if not a valid expression type
    public get validType(): ExpressionType | undefined {
        return this.type ? toValidExpressionType(this.type.toString()) : undefined;
    }

    public get fullSpan(): Span {
        return this._property.span;
    }

    public get description(): string | undefined {
        const parameterDefinition: Json.ObjectValue | undefined = Json.asObjectValue(this._property.value);
        if (parameterDefinition) {
            const metadata: Json.ObjectValue | undefined = Json.asObjectValue(parameterDefinition.getPropertyValue("metadata"));
            if (metadata) {
                const description: Json.StringValue | undefined = Json.asStringValue(metadata.getPropertyValue("description"));
                if (description) {
                    return description.toString();
                }
            }
        }

        return undefined;
    }

    public get defaultValue(): Json.Value | undefined {
        const parameterDefinition: Json.ObjectValue | undefined = Json.asObjectValue(this._property.value);
        if (parameterDefinition) {
            return parameterDefinition.getPropertyValue("defaultValue");
        }

        return undefined;
    }

    public get usageInfo(): IUsageInfo {
        return {
            usage: this.nameValue.unquotedValue,
            friendlyType: "parameter",
            description: this.description
        };
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.nameValue.toString();
    }
}
