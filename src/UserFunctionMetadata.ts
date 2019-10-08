// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType } from "./ExpressionType";
import { IFunctionMetadata, IFunctionParameterMetadata } from "./IFunctionMetadata";
import { getUserFunctionUsage } from "./signatureFormatting";
import { UserFunctionDefinition } from "./UserFunctionDefinition";

/**
 * This class represents information about a user-defined function (name, arguments, return type, etc)
 */
export class UserFunctionMetadata implements IFunctionMetadata {
    constructor(
        public readonly name: string,
        public readonly usage: string,
        public readonly description: string,
        public readonly parameters: IFunctionParameterMetadata[],
        public readonly returnType: ExpressionType | null,
        public readonly returnValueMembers: string[]
    ) {
        this.minimumArguments = this.maximumArguments = parameters.length;
    }

    public readonly minimumArguments: number;
    public readonly maximumArguments: number;

    public static fromDefinition(func: UserFunctionDefinition): UserFunctionMetadata {
        return new UserFunctionMetadata(
            func.fullName,
            getUserFunctionUsage(func, true),
            "User-defined function",
            func.parameterDefinitions.map(pd =>
                <IFunctionParameterMetadata>{
                    name: pd.name.unquotedValue,
                    type: pd.validType
                }),
            func.output && func.output.validOutputType,
            []);
    }
}
