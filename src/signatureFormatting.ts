// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType, toValidExpressionType } from "./ExpressionType";
import { IParameterDefinition } from "./IParameterDefinition";
import { UserFunctionDefinition } from "./UserFunctionDefinition";
import { UserFunctionParameterDefinition } from "./UserFunctionParameterDefinition";

export function getUserFunctionUsage(func: UserFunctionDefinition, includeNamespaceName: boolean = true): string {
    const name = includeNamespaceName ? func.fullName : func.nameValue.unquotedValue;
    const params: UserFunctionParameterDefinition[] = func.parameterDefinitions;
    const outputType: ExpressionType | null = func.output ? func.output.validOutputType : null;
    return getFunctionUsage(name, params, outputType);
}

export function getFunctionUsage(name: string, params: IParameterDefinition[], outputTypeAsString: string | null | undefined): string {
    let usage: string = `${name}(${params.map(p => getFunctionParamUsage(p.nameValue.unquotedValue, p.validType)).join(", ")})`;
    let outputType: ExpressionType | null = toValidExpressionType(outputTypeAsString);
    if (outputType) {
        usage += ` [${outputType}]`;
    }
    return usage;
}

export function getFunctionParamUsage(name: string, typeAsString: string | null | undefined): string {
    const paramType: ExpressionType | null = toValidExpressionType(typeAsString);
    return paramType ? `${name} [${paramType}]` : name;
}
