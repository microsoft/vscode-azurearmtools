// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CachedValue } from './CachedValue';
import { assert } from './fixed_assert';
import { DefinitionKind, INamedDefinition } from './INamedDefinition';
import * as Json from "./JSON";
import * as language from "./Language";
import { UserFunctionDefinition } from "./UserFunctionDefinition";

/**
 * This class represents the definition of a user-defined namespace in a deployment template.
 */
export class UserFunctionNamespaceDefinition implements INamedDefinition {
    /* Example:

            "functions": [
                {  <<<<  call createIfValid on this object
                    "namespace": "contoso",
                    "members": {
                        "uniqueName": {
                            "parameters": [
                                {
                                    "name": "namePrefix",
                                    "type": "string"
                                }
                            ],
                            "output": {
                            "type": "string",
                            "value": "[concat(toLower(parameters('namePrefix')), uniqueString(resourceGroup().id))]"
                            }
                        }
                    }
                }
            ],
        */

    public readonly definitionKind: DefinitionKind = DefinitionKind.Namespace;

    private _members: CachedValue<UserFunctionDefinition[]> = new CachedValue<UserFunctionDefinition[]>();

    private constructor(
        public readonly nameValue: Json.StringValue,
        private readonly _value: Json.ObjectValue
    ) {
        assert(_value);
    }

    public static createIfValid(functionValue: Json.ObjectValue): UserFunctionNamespaceDefinition | null {
        let nameValue: Json.StringValue | null = Json.asStringValue(functionValue.getPropertyValue("namespace"));
        if (nameValue) {
            return new UserFunctionNamespaceDefinition(nameValue, functionValue);
        }

        return null;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.nameValue.unquotedValue;
    }

    public get span(): language.Span {
        return this._value.span;
    }

    public get members(): UserFunctionDefinition[] {
        return this._members.getOrCacheValue(() => {
            const membersResult: UserFunctionDefinition[] = [];

            const members: Json.ObjectValue | null = Json.asObjectValue(this._value.getPropertyValue("members"));
            if (members) {
                for (let member of members.properties) {
                    let name: Json.StringValue = member.name;
                    let value = Json.asObjectValue(member.value);
                    if (value) {
                        let func = new UserFunctionDefinition(this, name, value);
                        membersResult.push(func);
                    }
                }
            }

            return membersResult;
        });
    }

    public getMemberDefinition(functionName: string): UserFunctionDefinition | undefined {
        if (functionName) {
            let functionNameLC = functionName.toLowerCase();
            return this.members.find(fd => fd.nameValue.toString().toLowerCase() === functionNameLC);
        } else {
            return undefined;
        }
    }
}
