// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType } from "./ExpressionType";
import { Behaviors, IFunctionMetadata, IFunctionParameterMetadata } from "./IFunctionMetadata";
import { getUserFunctionUsage } from "./signatureFormatting";
import { UserFunctionDefinition } from "./UserFunctionDefinition";

/**
 * This class represents information about a user-defined function (name, arguments, return type, etc)
 */
export class UserFunctionMetadata implements IFunctionMetadata {
    constructor(
        public readonly fullName: string,
        public readonly unqualifiedName: string,
        public readonly usage: string,
        public readonly description: string,
        public readonly parameters: IFunctionParameterMetadata[],
        public readonly returnType: ExpressionType | undefined,
        public readonly returnValueMembers: string[]
    ) {
        this.minimumArguments = this.maximumArguments = parameters.length;
    }

    public readonly minimumArguments: number;
    public readonly maximumArguments: number;

    public static fromDefinition(func: UserFunctionDefinition): UserFunctionMetadata {
        return new UserFunctionMetadata(
            func.fullName,
            func.nameValue.unquotedValue,
            getUserFunctionUsage(func, true),
            "User-defined function",
            func.parameterDefinitions.map(pd =>
                <IFunctionParameterMetadata>{
                    name: pd.nameValue.unquotedValue,
                    type: pd.validType
                }),
            func.output && func.output.validOutputType,
            []);
    }

    public hasBehavior(behavior: Behaviors): boolean {
        return false;
    }
}
