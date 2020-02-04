// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { Utilities } from '../extension.bundle';
import { templateKeys } from './constants';
import { IParameterDefinition } from "./IParameterDefinition";
import * as TLE from "./TLE";
import { UserFunctionDefinition } from './UserFunctionDefinition';
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { IVariableDefinition } from './VariableDefinition';

export enum ScopeContext {
    TopLevel = "TopLevel",
    ParameterDefaultValue = "ParameterDefaultValue",
    UserFunction = "UserFunction"
}

/**
 * Represents the scoped access of parameters/variables/functions at a particular point in the template tree.
 */
export class TemplateScope {
    /**
     * Constructor
     */
    constructor(
        public readonly scopeContext: ScopeContext,
        private readonly _parameterDefinitions: IParameterDefinition[] | undefined, // undefined means not supported in this context
        private readonly _variableDefinitions: IVariableDefinition[] | undefined, // undefined means not supported in this context
        private readonly _namespaceDefinitions: UserFunctionNamespaceDefinition[] | undefined, // undefined means not supported in this context
        // tslint:disable-next-line:variable-name
        public readonly __debugDisplay: string // Convenience for debugging
    ) {
    }

    public get parameterDefinitions(): IParameterDefinition[] {
        // tslint:disable-next-line: strict-boolean-expressions
        return this._parameterDefinitions || [];
    }

    public get variableDefinitions(): IVariableDefinition[] {
        // tslint:disable-next-line: strict-boolean-expressions
        return this._variableDefinitions || [];
    }

    public get namespaceDefinitions(): UserFunctionNamespaceDefinition[] {
        // tslint:disable-next-line: strict-boolean-expressions
        return this._namespaceDefinitions || [];
    }

    // parameterName can be surrounded with single quotes or not.  Search is case-insensitive
    public getParameterDefinition(parameterName: string): IParameterDefinition | undefined {
        assert(parameterName, "parameterName cannot be null, undefined, or empty");

        const unquotedParameterName = Utilities.unquote(parameterName);
        let parameterNameLC = unquotedParameterName.toLowerCase();

        // Find the last definition that matches, because that's what Azure does if there are matching names
        for (let i = this.parameterDefinitions.length - 1; i >= 0; --i) {
            let pd = this.parameterDefinitions[i];
            if (pd.nameValue.toString().toLowerCase() === parameterNameLC) {
                return pd;
            }
        }
        return undefined;
    }

    // Search is case-insensitive
    public getFunctionNamespaceDefinition(namespaceName: string): UserFunctionNamespaceDefinition | undefined {
        assert(!!namespaceName, "namespaceName cannot be null, undefined, or empty");
        let namespaceNameLC = namespaceName.toLowerCase();
        return this.namespaceDefinitions.find((nd: UserFunctionNamespaceDefinition) => nd.nameValue.toString().toLowerCase() === namespaceNameLC);
    }

    // Search is case-insensitive
    public getUserFunctionDefinition(namespaceName: string, functionName: string): UserFunctionDefinition | undefined {
        assert(!!functionName, "functionName cannot be null, undefined, or empty");
        let nd = this.getFunctionNamespaceDefinition(namespaceName);
        if (nd) {
            let result = nd.getMemberDefinition(functionName);
            return result ? result : undefined;
        }

        return undefined;
    }

    // variableName can be surrounded with single quotes or not.  Search is case-insensitive
    public getVariableDefinition(variableName: string): IVariableDefinition | undefined {
        assert(variableName, "variableName cannot be null, undefined, or empty");

        const unquotedVariableName = Utilities.unquote(variableName);
        const variableNameLC = unquotedVariableName.toLowerCase();

        // Find the last definition that matches, because that's what Azure does
        for (let i = this.variableDefinitions.length - 1; i >= 0; --i) {
            let vd = this.variableDefinitions[i];
            if (vd.nameValue.toString().toLowerCase() === variableNameLC) {
                return vd;
            }
        }

        return undefined;
    }

    /**
     * If the function call is a variables() reference, return the related variable definition
     */
    public getVariableDefinitionFromFunctionCall(tleFunction: TLE.FunctionCallValue): IVariableDefinition | undefined {
        let result: IVariableDefinition | undefined;

        if (tleFunction.isCallToBuiltinWithName(templateKeys.variables)) {
            const variableName: TLE.StringValue | undefined = TLE.asStringValue(tleFunction.argumentExpressions[0]);
            if (variableName) {
                result = this.getVariableDefinition(variableName.toString());
            }
        }

        return result;
    }

    /**
     * If the function call is a parameters() reference, return the related parameter definition
     */
    public getParameterDefinitionFromFunctionCall(tleFunction: TLE.FunctionCallValue): IParameterDefinition | undefined {
        assert(tleFunction);

        let result: IParameterDefinition | undefined;

        if (tleFunction.isCallToBuiltinWithName(templateKeys.parameters)) {
            const propertyName: TLE.StringValue | undefined = TLE.asStringValue(tleFunction.argumentExpressions[0]);
            if (propertyName) {
                result = this.getParameterDefinition(propertyName.toString());
            }
        }

        return result;
    }

    public findFunctionDefinitionsWithPrefix(namespace: UserFunctionNamespaceDefinition, functionNamePrefix: string): UserFunctionDefinition[] {
        let results: UserFunctionDefinition[] = [];

        let lowerCasedPrefix = functionNamePrefix.toLowerCase();
        for (let member of namespace.members) {
            if (member.nameValue.unquotedValue.toLowerCase().startsWith(lowerCasedPrefix)) {
                results.push(member);
            }
        }

        return results;
    }

    public findNamespaceDefinitionsWithPrefix(namespaceNamePrefix: string): UserFunctionNamespaceDefinition[] {
        let results: UserFunctionNamespaceDefinition[] = [];

        let lowerCasedPrefix = namespaceNamePrefix.toLowerCase();
        for (let ns of this.namespaceDefinitions) {
            if (ns.nameValue.unquotedValue.toLowerCase().startsWith(lowerCasedPrefix)) {
                results.push(ns);
            }
        }

        return results;
    }

    public findParameterDefinitionsWithPrefix(parameterNamePrefix: string): IParameterDefinition[] {
        assert(parameterNamePrefix !== null, "parameterNamePrefix cannot be null");
        assert(parameterNamePrefix !== undefined, "parameterNamePrefix cannot be undefined");

        let result: IParameterDefinition[] = [];

        if (parameterNamePrefix !== "") {
            let lowerCasedPrefix = parameterNamePrefix.toLowerCase();
            for (let parameterDefinition of this.parameterDefinitions) {
                if (parameterDefinition.nameValue.toString().toLowerCase().startsWith(lowerCasedPrefix)) {
                    result.push(parameterDefinition);
                }
            }
        } else {
            result = this.parameterDefinitions;
        }

        return result;
    }

    public findVariableDefinitionsWithPrefix(variableNamePrefix: string): IVariableDefinition[] {
        assert(variableNamePrefix !== null, "variableNamePrefix cannot be null");
        assert(variableNamePrefix !== undefined, "variableNamePrefix cannot be undefined");

        let result: IVariableDefinition[];
        if (variableNamePrefix) {
            result = [];

            const lowerCasedPrefix = variableNamePrefix.toLowerCase();
            for (const variableDefinition of this.variableDefinitions) {
                if (variableDefinition.nameValue.toString().toLowerCase().startsWith(lowerCasedPrefix)) {
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
