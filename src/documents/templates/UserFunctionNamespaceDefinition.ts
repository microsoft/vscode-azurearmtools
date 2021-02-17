// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as os from 'os';
import { templateKeys } from '../../constants';
import { assert } from '../../fixed_assert';
import { DefinitionKind, INamedDefinition } from '../../language/INamedDefinition';
import * as Json from "../../language/json/JSON";
import { Span } from '../../language/Span';
import { CachedValue } from '../../util/CachedValue';
import { getUserFunctionUsage } from '../../vscodeIntegration/signatureFormatting';
import { IUsageInfo } from '../../vscodeIntegration/UsageInfoHoverInfo';
import { IJsonDocument } from "./IJsonDocument";
import { TemplateScope } from './scopes/TemplateScope';
import { UserFunctionDefinition } from "./UserFunctionDefinition";

export function isUserNamespaceDefinition(definition: INamedDefinition): definition is UserFunctionNamespaceDefinition {
    return definition.definitionKind === DefinitionKind.Namespace;
}

/**
 * This class represents the definition of a user-defined namespace in a deployment template.
 */
export class UserFunctionNamespaceDefinition implements INamedDefinition {
    /* Example:

            "functions": [
                {  <----  call createIfValid on this object
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
        public readonly parentScope: TemplateScope,
        public readonly document: IJsonDocument,
        public readonly nameValue: Json.StringValue,
        private readonly _value: Json.ObjectValue
    ) {
        assert(_value);
    }

    public static createIfValid(parentScope: TemplateScope, document: IJsonDocument, functionValue: Json.ObjectValue): UserFunctionNamespaceDefinition | undefined {
        let nameValue: Json.StringValue | undefined = Json.asStringValue(functionValue.getPropertyValue("namespace"));
        if (nameValue) {
            return new UserFunctionNamespaceDefinition(parentScope, document, nameValue, functionValue);
        }

        return undefined;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.nameValue.unquotedValue;
    }

    public get span(): Span {
        return this._value.span;
    }

    public get members(): UserFunctionDefinition[] {
        return this._members.getOrCacheValue(() => {
            const membersResult: UserFunctionDefinition[] = [];

            const members: Json.ObjectValue | undefined = Json.asObjectValue(this._value.getPropertyValue(templateKeys.userFunctionMembers));
            if (members) {
                for (let member of members.properties) {
                    let name: Json.StringValue = member.nameValue;
                    let value = Json.asObjectValue(member.value);
                    if (value) {
                        let func = new UserFunctionDefinition(this.parentScope, this.document, this, name, value, member.span);
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

    public get usageInfo(): IUsageInfo {
        const ns = this.nameValue.unquotedValue;
        const methodsUsage: string[] = this.members
            .map(md => getUserFunctionUsage(md, false));
        let description: string | undefined;
        if (methodsUsage.length > 0) {
            description = `Members:${os.EOL}${methodsUsage.map(mu => `* ${mu}`).join(os.EOL)}`;
        } else {
            description = `No members`;
        }

        return {
            usage: ns,
            friendlyType: "user-defined namespace",
            description // CONSIDER: retrieve description from metadata, if supported
        };
    }
}
