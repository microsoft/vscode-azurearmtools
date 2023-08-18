// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IParameterDefinition } from "../documents/parameters/IParameterDefinition";
import { ExpressionType, toValidExpressionType } from "../documents/templates/ExpressionType";
import { UserFunctionDefinition } from "../documents/templates/UserFunctionDefinition";
import { UserFunctionParameterDefinition } from "../documents/templates/UserFunctionParameterDefinition";

export function getUserFunctionUsage(func: UserFunctionDefinition, includeNamespaceName: boolean = true): string {
    const name = includeNamespaceName ? func.fullName : func.nameValue.unquotedValue;
    const params: UserFunctionParameterDefinition[] = func.parameterDefinitions;
    const outputType: ExpressionType | undefined = func.output ? func.output.validOutputType : undefined;
    return getFunctionUsage(name, params, outputType);
}

export function getFunctionUsage(name: string, params: IParameterDefinition[], outputTypeAsString: string | null | undefined): string {
    let usage: string = `${name}(${params.map(p => getFunctionParamUsage(p.nameValue.unquotedValue, p.validType)).join(", ")})`;
    const outputType: ExpressionType | undefined = toValidExpressionType(outputTypeAsString);
    if (outputType) {
        usage += ` [${outputType}]`;
    }
    return usage;
}

export function getFunctionParamUsage(name: string, typeAsString: string | null | undefined): string {
    const paramType: ExpressionType | undefined = toValidExpressionType(typeAsString);
    return paramType ? `${name} [${paramType}]` : name;
}
