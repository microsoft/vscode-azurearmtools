// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType } from "./ExpressionType";

/**
 * Metadata for a TLE (Template Language Expression) function.
 */
export interface IFunctionMetadata {
    name: string;
    usage: string;
    parameters: IFunctionParameterMetadata[];
    description: string;
    minimumArguments: number;
    maximumArguments: number;
    returnType: ExpressionType | null;   // Undefined if unknown
    returnValueMembers: string[]; // Used if returnType == 'object' or 'secureobject'
}

export interface IFunctionParameterMetadata {
    name: string;
    usage: string;
    // tslint:disable-next-line: no-reserved-keywords
    type: ExpressionType | null;
}
