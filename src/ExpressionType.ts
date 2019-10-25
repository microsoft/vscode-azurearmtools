// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export type ExpressionType = "string" | "securestring" | "int" | "bool" | "object" | "secureobject" | "array";

export function toValidExpressionType(typeName: string | null | undefined): ExpressionType | null {
    // tslint:disable-next-line: strict-boolean-expressions
    const lowered = (typeName || "").toLowerCase();

    switch (<ExpressionType>lowered) {
        case "array":
        case "bool":
        case "int":
        case "object":
        case "secureobject":
        case "securestring":
        case "string":
            return <ExpressionType>lowered;

        default:
            return null;
    }
}
