// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { Utilities } from '../extension.bundle';
import { IParameterDefinition } from "./IParameterDefinition";
import * as Json from "./JSON";
import * as TLE from "./TLE";
import { UserFunctionDefinition } from './UserFunctionDefinition';
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";

export enum ScopeContext {
    TopLevel = "TopLevel",
    ParameterDefaultValue = "ParameterDefaultValue",
    UserFunction = "UserFunction"
}

/**
 * Represents the scoped access of parameters/variables/funtions at a particular point in the template tree.
 */
export class TemplateScope {
    /**
     * Constructor
     */
    constructor(
        public readonly scopeContext: ScopeContext,
        private readonly _parameterDefinitions: IParameterDefinition[] | undefined, // undefined means not supported in this context
        private readonly _variableDefinitions: Json.Property[] | undefined, // undefined means not supported in this context
        private readonly _namespaceDefinitions: UserFunctionNamespaceDefinition[] | undefined, // undefined means not supported in this context
        // tslint:disable-next-line:variable-name
        public readonly __debugDisplay: string // Convenience for debugging
    ) {
    }

    public get parameterDefinitions(): IParameterDefinition[] {
        // tslint:disable-next-line: strict-boolean-expressions
        return this._parameterDefinitions || [];
    }

    public get variableDefinitions(): Json.Property[] {
        // tslint:disable-next-line: strict-boolean-expressions
        return this._variableDefinitions || [];
    }

    public get namespaceDefinitions(): UserFunctionNamespaceDefinition[] {
        // tslint:disable-next-line: strict-boolean-expressions
        return this._namespaceDefinitions || [];
    }

    // parameterName can be surrounded with single quotes or not.  Search is case-insensitive
    public getParameterDefinition(parameterName: string): IParameterDefinition | null {
        assert(parameterName, "parameterName cannot be null, undefined, or empty");

        const unquotedParameterName = Utilities.unquote(parameterName);
        let parameterNameLC = unquotedParameterName.toLowerCase();

        // Find the last definition that matches, because that's what Azure does if there are matching names
        for (let i = this.parameterDefinitions.length - 1; i >= 0; --i) {
            let pd = this.parameterDefinitions[i];
            if (pd.name.toString().toLowerCase() === parameterNameLC) {
                return pd;
            }
        }
        return null;
    }

    // Search is case-insensitive
    public getFunctionNamespaceDefinition(namespaceName: string): UserFunctionNamespaceDefinition | undefined {
        assert(!!namespaceName, "namespaceName cannot be null, undefined, or empty");
        let namespaceNameLC = namespaceName.toLowerCase();
        return this.namespaceDefinitions.find((nd: UserFunctionNamespaceDefinition) => nd.namespaceName.toString().toLowerCase() === namespaceNameLC);
    }

    // Search is case-insensitive
    public getFunctionDefinition(namespaceName: string, functionName: string): UserFunctionDefinition | null {
        assert(!!functionName, "functionName cannot be null, undefined, or empty");
        let nd = this.getFunctionNamespaceDefinition(namespaceName);
        if (nd) {
            let result = nd.getMemberDefinition(functionName);
            return result ? result : null;
        }

        return null;
    }

    // variableName can be surrounded with single quotes or not.  Search is case-insensitive
    public getVariableDefinition(variableName: string): Json.Property | null {
        assert(variableName, "variableName cannot be null, undefined, or empty");

        const unquotedVariableName = Utilities.unquote(variableName);
        const variableNameLC = unquotedVariableName.toLowerCase();

        // Find the last definition that matches, because that's what Azure does
        for (let i = this.variableDefinitions.length - 1; i >= 0; --i) {
            let vd = this.variableDefinitions[i];
            if (vd.name.toString().toLowerCase() === variableNameLC) {
                return vd;
            }
        }

        return null;
    }

    /**
     * If the function call is a variables() reference, return the related variable definition
     */
    public getVariableDefinitionFromFunctionCall(tleFunction: TLE.FunctionCallValue): Json.Property | null {
        let result: Json.Property | null = null;

        if (tleFunction.isCallToBuiltinWithName("variables")) {
            const variableName: TLE.StringValue | null = TLE.asStringValue(tleFunction.argumentExpressions[0]);
            if (variableName) {
                result = this.getVariableDefinition(variableName.toString());
            }
        }

        return result;
    }

    /**
     * If the function call is a parameters() reference, return the related parameter definition
     */
    public getParameterDefinitionFromFunctionCall(tleFunction: TLE.FunctionCallValue): IParameterDefinition | null {
        assert(tleFunction);

        let result: IParameterDefinition | null = null;

        if (tleFunction.nameToken.stringValue === "parameters") {
            const propertyName: TLE.StringValue | null = TLE.asStringValue(tleFunction.argumentExpressions[0]);
            if (propertyName) {
                result = this.getParameterDefinition(propertyName.toString());
            }
        }

        return result;
    }

    public findParameterDefinitionsWithPrefix(parameterNamePrefix: string): IParameterDefinition[] {
        assert(parameterNamePrefix !== null, "parameterNamePrefix cannot be null");
        assert(parameterNamePrefix !== undefined, "parameterNamePrefix cannot be undefined");

        let result: IParameterDefinition[] = [];

        if (parameterNamePrefix !== "") {
            let lowerCasedPrefix = parameterNamePrefix.toLowerCase();
            for (let parameterDefinition of this.parameterDefinitions) {
                if (parameterDefinition.name.toString().toLowerCase().startsWith(lowerCasedPrefix)) {
                    result.push(parameterDefinition);
                }
            }
        } else {
            result = this.parameterDefinitions;
        }

        return result;
    }

    public findVariableDefinitionsWithPrefix(variableNamePrefix: string): Json.Property[] {
        assert(variableNamePrefix !== null, "variableNamePrefix cannot be null");
        assert(variableNamePrefix !== undefined, "variableNamePrefix cannot be undefined");

        let result: Json.Property[];
        if (variableNamePrefix) {
            result = [];

            const lowerCasedPrefix = variableNamePrefix.toLowerCase();
            for (const variableDefinition of this.variableDefinitions) {
                if (variableDefinition.name.toString().toLowerCase().startsWith(lowerCasedPrefix)) {
                    result.push(variableDefinition);
                }
            }
        } else {
            result = this.variableDefinitions;
        }

        return result;
    }

    public get isInUserFunction(): boolean {
        return this.scopeContext === ScopeContext.UserFunction;
    }
}
