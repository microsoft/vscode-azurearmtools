// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { templateKeys } from "../../constants";
import { DefinitionKind, INamedDefinition } from "../../language/INamedDefinition";
import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import { CachedValue } from "../../util/CachedValue";
import { getUserFunctionUsage } from "../../vscodeIntegration/signatureFormatting";
import { IUsageInfo } from "../../vscodeIntegration/UsageInfoHoverInfo";
import { IJsonDocument } from "./IJsonDocument";
import { OutputDefinition } from "./OutputDefinition";
import { TemplateScope } from "./scopes/TemplateScope";
import { UserFunctionScope } from "./scopes/templateScopes";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { UserFunctionParameterDefinition } from "./UserFunctionParameterDefinition";

export function isUserFunctionDefinition(definition: INamedDefinition): definition is UserFunctionDefinition {
    return definition.definitionKind === DefinitionKind.UserFunction;
}

/**
 * This class represents the definition of a user-defined function in a deployment template.
 */
export class UserFunctionDefinition implements INamedDefinition {
    private readonly _output: CachedValue<OutputDefinition | undefined> = new CachedValue<OutputDefinition | undefined>();
    private readonly _parameterDefinitions: CachedValue<UserFunctionParameterDefinition[]> = new CachedValue<UserFunctionParameterDefinition[]>();
    private readonly _scope: CachedValue<TemplateScope> = new CachedValue<TemplateScope>();

    public readonly definitionKind: DefinitionKind = DefinitionKind.UserFunction;

    constructor(
        public readonly document: IJsonDocument,
        public readonly namespace: UserFunctionNamespaceDefinition,
        public readonly nameValue: Json.StringValue,
        public readonly objectValue: Json.ObjectValue,
        public readonly span: Span
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
            return new UserFunctionScope(
                this.document,
                this.objectValue,
                this.parameterDefinitions,
                `'${this.fullName}' (UDF) scope`);
        });
    }

    public get fullName(): string {
        // tslint:disable-next-line: strict-boolean-expressions
        return `${this.namespace.nameValue.unquotedValue || "(none)"}.${this.nameValue.unquotedValue || "(none)"}`;
    }

    public get output(): OutputDefinition | undefined {
        return this._output.getOrCacheValue(() => {
            let output = Json.asObjectValue(this.objectValue.getPropertyValue("output"));
            if (output) {
                return new OutputDefinition(output);
            }

            return undefined;
        });
    }

    public get parameterDefinitions(): UserFunctionParameterDefinition[] {
        return this._parameterDefinitions.getOrCacheValue(() => {
            const parameterDefinitions: UserFunctionParameterDefinition[] = [];

            // User-function parameters are an ordered array, not an object
            const parametersArray: Json.ArrayValue | undefined = Json.asArrayValue(this.objectValue.getPropertyValue(templateKeys.parameters));
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
