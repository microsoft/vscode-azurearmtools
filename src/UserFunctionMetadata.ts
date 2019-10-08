// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType } from "./ExpressionType";
import { UserFunctionInfo } from "./Hover";
import { IFunctionMetadata, IFunctionParameterMetadata } from "./IFunctionMetadata";
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

    // asdf have hover get from this instead
    public static fromDefinition(func: UserFunctionDefinition): UserFunctionMetadata {
        return new UserFunctionMetadata(
            func.fullName,
            UserFunctionInfo.getUsage(func, true),
            "User-defined function",
            func.parameterDefinitions.map(pd =>
                <IFunctionParameterMetadata>{
                    name: pd.name.unquotedValue,
                    usage: UserFunctionInfo.getParamUsage(pd),
                    type: pd.validType
                }),
            func.output && func.output.validOutputType,
            []);
    }
}
