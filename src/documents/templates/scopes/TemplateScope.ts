// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { templateKeys } from '../../../../common';
import { Json, strings } from '../../../../extension.bundle';
import { assert } from '../../../fixed_assert';
import * as TLE from "../../../language/expressions/TLE";
import { CachedValue } from '../../../util/CachedValue';
import { IParameterDefinition } from '../../parameters/IParameterDefinition';
import { IParameterDefinitionsSource } from '../../parameters/IParameterDefinitionsSource';
import { IParameterDefinitionsSourceProvider } from "../../parameters/IParameterDefinitionsSourceProvider";
import { IParameterValuesSource } from '../../parameters/IParameterValuesSource';
import { IJsonDocument } from '../IJsonDocument';
import { IResource } from '../IResource';
import { UserFunctionDefinition } from '../UserFunctionDefinition';
import { UserFunctionNamespaceDefinition } from "../UserFunctionNamespaceDefinition";
import { IVariableDefinition } from '../VariableDefinition';
import { IDeploymentSchemaReference } from './IDeploymentSchemaReference';

export enum TemplateScopeKind {
    Empty = "Empty",
    TopLevel = "TopLevel",
    ParameterDefaultValue = "ParameterDefaultValue",
    UserFunction = "UserFunction",
    NestedDeploymentWithInnerScope = "NestedDeploymentWithInnerScope",
    NestedDeploymentWithOuterScope = "NestedDeploymentWithOuterScope",
    LinkedDeployment = "LinkedDeployment",
}

// CONSIDER:
// Right now, deployments are scopes (although nested templates give back the parent's
// params/vars/funcs), but non-deployment scopes exist, too.
// Probably better to have ITemplateDeployment and IScope separate, with ITemplateDeployment
// having a scope.

/**
 * Represents the scoped access of parameters/variables/functions at a particular point in the template tree.
 */
export abstract class TemplateScope implements IParameterDefinitionsSourceProvider {
    private _variableDefinitions: CachedValue<IVariableDefinition[] | undefined> = new CachedValue<IVariableDefinition[] | undefined>();
    private _functionDefinitions: CachedValue<UserFunctionNamespaceDefinition[] | undefined> = new CachedValue<UserFunctionNamespaceDefinition[] | undefined>();
    private _resources: CachedValue<IResource[] | undefined> = new CachedValue<IResource[] | undefined>();

    constructor(
        public readonly parent: TemplateScope | undefined,
        public readonly document: IJsonDocument, // The document that contains this scope
        /** The object that the scope applies to (expressions inside this object will use this scope for evaluation) */
        public readonly rootObject: Json.ObjectValue | undefined,
        /**
         * The scope of the deployment if this represents a deployment (RG, subscription, MG, tenant)
         * Undefined if this scope is not a deployment (e.g. it's a user function scope).
         * If it is a deployment scope but the schema is invalid, deploymentScope will be undefined and
         *  contains kind=unknown
         */
        public readonly deploymentSchema: IDeploymentSchemaReference | undefined,
        // tslint:disable-next-line:variable-name
        public readonly __debugDisplay: string // Provides context for debugging
    ) {
    }

    public readonly abstract scopeKind: TemplateScopeKind;

    // CONSIDER: Better design. Split out resources from params/vars/functions, or separate
    //   concept of deployment from concept of scope?
    /**
     * Indicates whether this scope's params, vars and namespaces are unique.
     * False if it shares its members with its parents.
     * Note that resources are always unique to a scope.
     */
    public readonly hasUniqueParamsVarsAndFunctions: boolean = true;

    /**
     * True if this scope is external to the hosting template file (i.e., it's a linked deployment template)
     */
    public readonly isExternal: boolean = false;

    /**
     * The root object that owns the parameters, variables and user functions that are used by
     * this scope (will be the scope's root object itself if hasUniqueParamsVarsAndFunctions = true)
     */
    public get memberOwningRootObject(): Json.ObjectValue | undefined {
        return this.getMemberOwningRootObject();
    }

    protected getMemberOwningRootObject(): Json.ObjectValue | undefined {
        return this.rootObject;
    }

    protected getVariableDefinitions(): IVariableDefinition[] | undefined {
        // undefined means not supported in this context
        return undefined;
    }
    protected getNamespaceDefinitions(): UserFunctionNamespaceDefinition[] | undefined {
        // undefined means not supported in this context
        return undefined;
    }
    protected getResources(): IResource[] | undefined {
        // undefined means not supported in this context
        return undefined;
    }

    // NOTE: This returns undefined for top-level scopes, since that would need to
    //   come from a parameter file loaded later
    // CONSIDER: Return IParameterValuesSourceProvider instead. It's not good that getParameterValuesSource
    //   returns an invalid value (undefined) for the top level.
    protected getParameterValuesSource(): IParameterValuesSource | undefined {
        return undefined;
    }

    protected abstract getParameterDefinitionsSource(): IParameterDefinitionsSource;

    public get parameterDefinitions(): IParameterDefinition[] {
        // Note: This must not be cached, as a deployment template's parameter definitions can change when
        //   linked template processing is completed.
        return this.getParameterDefinitionsSource().parameterDefinitions;
    }

    public get variableDefinitions(): IVariableDefinition[] {
        return this._variableDefinitions.getOrCacheValue(() => this.getVariableDefinitions())
            ?? [];
    }

    public get namespaceDefinitions(): UserFunctionNamespaceDefinition[] {
        return this._functionDefinitions.getOrCacheValue(() => this.getNamespaceDefinitions())
            ?? [];
    }

    // Retrieves only the top level of resources
    public get resources(): IResource[] {
        return this._resources.getOrCacheValue(() => this.getResources())
            ?? [];
    }

    public get parameterValuesSource(): IParameterValuesSource | undefined {
        return this.getParameterValuesSource();
    }

    public get parameterDefinitionsSource(): IParameterDefinitionsSource {
        return this.getParameterDefinitionsSource();
    }

    public get childScopes(): TemplateScope[] {
        const scopes: TemplateScope[] = [];
        for (let resource of this.resources ?? []) {
            if (resource.childDeployment) {
                scopes.push(resource.childDeployment);
            }
        }

        // Get function definition scopes
        // (If it's not unique, we'd end up getting the parent's function definitions
        // instead of our own, so ignore)
        if (this.hasUniqueParamsVarsAndFunctions) {
            for (let namespace of this.namespaceDefinitions) {
                for (let member of namespace.members) {
                    scopes.push(member.scope);
                }
            }
        }

        return scopes;
    }

    // parameterName can be surrounded with single quotes or not.  Search is case-insensitive
    public getParameterDefinition(parameterName: string): IParameterDefinition | undefined {
        const unquotedParameterName = strings.unquote(parameterName);
        if (unquotedParameterName) {
            let parameterNameLC = unquotedParameterName.toLowerCase();

            // Find the last definition that matches, because that's what Azure does if there are matching names
            for (let i = this.parameterDefinitionsSource.parameterDefinitions.length - 1; i >= 0; --i) {
                let pd = this.parameterDefinitionsSource.parameterDefinitions[i];
                if (pd.nameValue.toString().toLowerCase() === parameterNameLC) {
                    return pd;
                }
            }
        }

        return undefined;
    }

    // Search is case-insensitive
    public getFunctionNamespaceDefinition(namespaceName: string): UserFunctionNamespaceDefinition | undefined {
        if (!namespaceName) {
            return undefined;
        }

        let namespaceNameLC = namespaceName.toLowerCase();
        return this.namespaceDefinitions.find((nd: UserFunctionNamespaceDefinition) => nd.nameValue.toString().toLowerCase() === namespaceNameLC);
    }

    // Search is case-insensitive
    public getUserFunctionDefinition(namespace: string | UserFunctionNamespaceDefinition, functionName: string): UserFunctionDefinition | undefined {
        if (!functionName) {
            return undefined;
        }

        let nd = typeof namespace === 'string' ? this.getFunctionNamespaceDefinition(namespace) : namespace;
        if (nd) {
            let result = nd.getMemberDefinition(functionName);
            return result ? result : undefined;
        }

        return undefined;
    }

    // variableName can be surrounded with single quotes or not.  Search is case-insensitive
    public getVariableDefinition(variableName: string): IVariableDefinition | undefined {
        const unquotedVariableName = strings.unquote(variableName);
        if (unquotedVariableName) {
            const variableNameLC = unquotedVariableName.toLowerCase();

            // Find the last definition that matches, because that's what Azure does
            for (let i = this.variableDefinitions.length - 1; i >= 0; --i) {
                let vd = this.variableDefinitions[i];
                if (vd.nameValue.toString().toLowerCase() === variableNameLC) {
                    return vd;
                }
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

    public get isInUserFunction(): boolean {
        return this.scopeKind === TemplateScopeKind.UserFunction;
    }

    public get parentWithUniqueParamsVarsAndFunctions(): TemplateScope {
        let parent = this.parent;
        while (!parent?.hasUniqueParamsVarsAndFunctions) {
            parent = parent?.parent;
        }

        assert(parent, "Should have found parent with unique params/vars/functions (top-level should be unique)");
        return parent;
    }
}
