// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { CachedValue } from "./CachedValue";
import * as Json from "./JSON";
import { OutputDefinition } from "./OutputDefinition";
import { ScopeContext, TemplateScope } from "./TemplateScope";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { UserFunctionParameterDefinition } from "./UserFunctionParameterDefinition";

/**
 * This class represents the definition of a user-defined function in a deployment template.
 */
export class UserFunctionDefinition {
    private readonly _output: CachedValue<OutputDefinition | null> = new CachedValue<OutputDefinition | null>();
    private readonly _parameterDefinitions: CachedValue<UserFunctionParameterDefinition[]> = new CachedValue<UserFunctionParameterDefinition[]>();
    private readonly _scope: CachedValue<TemplateScope> = new CachedValue<TemplateScope>();

    constructor(
        public readonly namespace: UserFunctionNamespaceDefinition,
        private _name: Json.StringValue,
        public readonly objectValue: Json.ObjectValue
    ) {
        assert(_name);
        assert(objectValue);
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

    public get name(): Json.StringValue {
        return this._name;
    }

    public get fullName(): string {
        // tslint:disable-next-line: strict-boolean-expressions
        return `${this.namespace.namespaceName.unquotedValue || "(none)"}.${this.name.unquotedValue || "(none)"}`;
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
            const parametersArray: Json.ArrayValue | null = Json.asArrayValue(this.objectValue.getPropertyValue("parameters"));
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
}
