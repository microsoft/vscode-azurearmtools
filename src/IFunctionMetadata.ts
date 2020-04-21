// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType } from "./ExpressionType";

export enum Behaviors {
    usesResourceIdCompletions = "usesResourceIdCompletions"
}

/**
 * Metadata for a TLE (Template Language Expression) function.
 */
export interface IFunctionMetadata {
    fullName: string;
    unqualifiedName: string;
    usage: string;
    parameters: IFunctionParameterMetadata[];
    description: string;
    minimumArguments: number;
    maximumArguments: number | undefined;   // Undefined if number of args is unlimited
    returnType: ExpressionType | undefined; // Undefined if unknown
    returnValueMembers: string[]; // Used if returnType == 'object' or 'secureobject'
    hasBehavior(behavior: Behaviors): boolean;
}

export interface IFunctionParameterMetadata {
    name: string;
    // tslint:disable-next-line: no-reserved-keywords
    type: ExpressionType | undefined;
}
