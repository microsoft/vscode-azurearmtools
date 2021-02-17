// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from '../../fixed_assert';
import { DefinitionKind } from '../../language/INamedDefinition';
import * as Json from "../../language/json/JSON";
import { Span } from '../../language/Span';
import { IUsageInfo } from '../../vscodeIntegration/UsageInfoHoverInfo';
import { IParameterDefinition } from '../parameters/IParameterDefinition';
import { ExpressionType, toValidExpressionType } from './ExpressionType';
import { IJsonDocument } from './IJsonDocument';

/**
 * This class represents the definition of a parameter in a user-defined function
 */
export class UserFunctionParameterDefinition implements IParameterDefinition {
    public readonly definitionKind: DefinitionKind = DefinitionKind.Parameter;

    private constructor(public readonly document: IJsonDocument, private _name: Json.StringValue, private _objectValue: Json.ObjectValue) {
        assert(_objectValue);
    }

    public static createIfValid(document: IJsonDocument, parameterObject: Json.ObjectValue): UserFunctionParameterDefinition | undefined {
        const name = Json.asStringValue(parameterObject.getPropertyValue('name'));
        if (name) {
            return new UserFunctionParameterDefinition(document, name, parameterObject);
        }

        return undefined;
    }

    public get nameValue(): Json.StringValue {
        return this._name;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public get type(): Json.StringValue | undefined {
        const parameterDefinition: Json.ObjectValue | undefined = Json.asObjectValue(this._objectValue);
        if (parameterDefinition) {
            return Json.asStringValue(parameterDefinition.getPropertyValue("type"));
        }

        return undefined;
    }

    // Returns undefined if not a valid expression type
    public get validType(): ExpressionType | undefined {
        return this.type ? toValidExpressionType(this.type.toString()) : undefined;
    }

    public get fullSpan(): Span {
        return this._objectValue.span;
    }

    public readonly description: string | undefined;
    public readonly defaultValue: Json.Value | undefined;

    public get usageInfo(): IUsageInfo {
        return {
            usage: this.nameValue.unquotedValue,
            friendlyType: "function parameter",
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
