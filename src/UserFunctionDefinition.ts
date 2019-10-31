// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CachedValue } from "./CachedValue";
import { templateKeys } from "./constants";
import { IUsageInfo } from "./Hover";
import { DefinitionKind, INamedDefinition } from "./INamedDefinition";
import * as Json from "./JSON";
import { OutputDefinition } from "./OutputDefinition";
import { getUserFunctionUsage } from "./signatureFormatting";
import { ScopeContext, TemplateScope } from "./TemplateScope";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { UserFunctionParameterDefinition } from "./UserFunctionParameterDefinition";

/**
 * This class represents the definition of a user-defined function in a deployment template.
 */
export class UserFunctionDefinition implements INamedDefinition {
    private readonly _output: CachedValue<OutputDefinition | null> = new CachedValue<OutputDefinition | null>();
    private readonly _parameterDefinitions: CachedValue<UserFunctionParameterDefinition[]> = new CachedValue<UserFunctionParameterDefinition[]>();
    private readonly _scope: CachedValue<TemplateScope> = new CachedValue<TemplateScope>();

    public readonly definitionKind: DefinitionKind = DefinitionKind.UserFunction;

    constructor(
        public readonly namespace: UserFunctionNamespaceDefinition,
        public readonly nameValue: Json.StringValue,
        public readonly objectValue: Json.ObjectValue
    ) { }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.fullName;
    }

    public get scope(): TemplateScope {
        return this._scope.getOrCacheValue(() => {
            // Each user function has a scope of its own
            return new TemplateScope(
                ScopeContext.UserFunction,
                // User functions can only use their own parameters, they do
                //   not have access to top-level parameters
                this.parameterDefinitions,
                // variable references not supported in user functions
                undefined,
                // nested user functions not supported in user functions
                undefined,
                `'${this.fullName}' (UDF) scope`
            );
        });
    }

    public get fullName(): string {
        // tslint:disable-next-line: strict-boolean-expressions
        return `${this.namespace.nameValue.unquotedValue || "(none)"}.${this.nameValue.unquotedValue || "(none)"}`;
    }

    public get output(): OutputDefinition | null {
        return this._output.getOrCacheValue(() => {
            let output = Json.asObjectValue(this.objectValue.getPropertyValue("output"));
            if (output) {
                return new OutputDefinition(output);
            }

            return null;
        });
    }

    public get parameterDefinitions(): UserFunctionParameterDefinition[] {
        return this._parameterDefinitions.getOrCacheValue(() => {
            const parameterDefinitions: UserFunctionParameterDefinition[] = [];

            // User-function parameters are an ordered array, not an object
            const parametersArray: Json.ArrayValue | null = Json.asArrayValue(this.objectValue.getPropertyValue(templateKeys.parameters));
            if (parametersArray) {
                for (const parameter of parametersArray.elements) {
                    const parameterObject = Json.asObjectValue(parameter);
                    if (parameterObject) {
                        const parameterDefinition = UserFunctionParameterDefinition.createIfValid(parameterObject);
                        if (parameterDefinition) {
                            parameterDefinitions.push(parameterDefinition);
                        }
                    }
                }
            }

            return parameterDefinitions;
        });
    }

    public get usageInfo(): IUsageInfo {
        return {
            usage: getUserFunctionUsage(this),
            friendlyType: "user-defined function",
            description: undefined // CONSIDER: retrieve description from metadata
        };
    }
}
