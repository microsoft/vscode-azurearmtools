// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file

import { templateKeys } from "../../../constants";
import * as Json from "../../../language/json/JSON";
import { assertNever } from "../../../util/assertNever";
import { IParameterDefinition } from "../../parameters/IParameterDefinition";
import { IParameterValuesSource } from "../../parameters/IParameterValuesSource";
import { ParameterDefinition } from "../../parameters/ParameterDefinition";
import { ParameterValuesSourceFromJsonObject } from "../../parameters/ParameterValuesSourceFromJsonObject";
import { IJsonDocument } from "../IJsonDocument";
import { IResource } from "../IResource";
import { Resource } from "../Resource";
import { UserFunctionNamespaceDefinition } from "../UserFunctionNamespaceDefinition";
import { IVariableDefinition, TopLevelCopyBlockVariableDefinition, TopLevelVariableDefinition } from "../VariableDefinition";
import { TemplateScope, TemplateScopeKind } from "./TemplateScope";

export class UserFunctionScope extends TemplateScope {
    constructor(
        document: IJsonDocument,
        rootObject: Json.ObjectValue,
        private readonly userFunctionParameterDefinitions: IParameterDefinition[],
        // tslint:disable-next-line:variable-name
        public readonly __debugDisplay: string // Convenience for debugging
    ) {
        super(document, rootObject, __debugDisplay);
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.UserFunction;

    protected getParameterDefinitions(): IParameterDefinition[] | undefined {
        // User functions can only use their own parameters, they do
        //   not have access to top-level parameters
        return this.userFunctionParameterDefinitions;
    }

    protected getVariableDefinitions(): IVariableDefinition[] | undefined {
        // variable references not supported in user functions
        return undefined;
    }

    protected getNamespaceDefinitions(): UserFunctionNamespaceDefinition[] | undefined {
        // nested user functions not supported in user functions
        return undefined;
    }
}

export abstract class TemplateScopeFromObject extends TemplateScope {
    public constructor(
        document: IJsonDocument,
        private _templateRootObject: Json.ObjectValue | undefined,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(document, _templateRootObject, __debugDisplay);
    }

    protected getParameterDefinitions(): IParameterDefinition[] | undefined {
        return getParameterDefinitionsFromObject(this._templateRootObject);
    }

    protected getVariableDefinitions(): IVariableDefinition[] | undefined {
        return getVariableDefinitionsFromObject(this._templateRootObject);
    }

    protected getNamespaceDefinitions(): UserFunctionNamespaceDefinition[] | undefined {
        return getNamespaceDefinitionsFromObject(this.document, this._templateRootObject);
    }

    protected getResources(): IResource[] | undefined {
        return getResourcesFromObject(this, this._templateRootObject);
    }
}

export class TopLevelTemplateScope extends TemplateScopeFromObject {
    public constructor(
        document: IJsonDocument,
        templateTopLevelValue: Json.ObjectValue | undefined,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(
            document,
            templateTopLevelValue,
            __debugDisplay
        );
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.TopLevel;
}

function getParameterDefinitionsFromObject(objectValue: Json.ObjectValue | undefined): ParameterDefinition[] {
    const parameterDefinitions: ParameterDefinition[] = [];

    if (objectValue) {
        const parameters: Json.ObjectValue | undefined = Json.asObjectValue(objectValue.getPropertyValue(templateKeys.parameters));
        if (parameters) {
            for (const parameter of parameters.properties) {
                parameterDefinitions.push(new ParameterDefinition(parameter));
            }
        }
    }

    return parameterDefinitions;
}

function getVariableDefinitionsFromObject(objectValue: Json.ObjectValue | undefined): IVariableDefinition[] {
    if (objectValue) {
        const variables: Json.ObjectValue | undefined = Json.asObjectValue(objectValue.getPropertyValue(templateKeys.variables));
        if (variables) {
            const varDefs: IVariableDefinition[] = [];
            for (let prop of variables.properties) {
                if (prop.nameValue.unquotedValue.toLowerCase() === templateKeys.copyLoop) {
                    // We have a top-level copy block, e.g.:
                    //
                    // "copy": [
                    //   {
                    //     "name": "top-level-object-array",
                    //     "count": 5,
                    //     "input": {
                    //       "name": "[concat('myDataDisk', copyIndex('top-level-object-array', 1))]",
                    //       "diskSizeGB": "1",
                    //       "diskIndex": "[copyIndex('top-level-object-array')]"
                    //     }
                    //   },
                    // ]
                    //
                    // Each element of the array is a TopLevelCopyBlockVariableDefinition
                    const varsArray: Json.ArrayValue | undefined = Json.asArrayValue(prop.value);
                    for (let varElement of varsArray?.elements ?? []) {
                        const def = TopLevelCopyBlockVariableDefinition.createIfValid(varElement);
                        if (def) {
                            varDefs.push(def);
                        }
                    }
                } else {
                    varDefs.push(new TopLevelVariableDefinition(prop));
                }
            }

            return varDefs;
        }
    }

    return [];
}

function getNamespaceDefinitionsFromObject(document: IJsonDocument, objectValue: Json.ObjectValue | undefined): UserFunctionNamespaceDefinition[] {
    const namespaceDefinitions: UserFunctionNamespaceDefinition[] = [];

    // Example of function definitions
    //
    // "functions": [
    //     { << This is a UserFunctionNamespaceDefinition
    //       "namespace": "<namespace-for-functions>",
    //       "members": { << This is a UserFunctionDefinition
    //         "<function-name>": {
    //           "parameters": [
    //             {
    //               "name": "<parameter-name>",
    //               "type": "<type-of-parameter-value>"
    //             }
    //           ],
    //           "output": {
    //             "type": "<type-of-output-value>",
    //             "value": "<function-return-value>"
    //           }
    //         }
    //       }
    //     }
    //   ],

    if (objectValue) {
        const functionNamespacesArray: Json.ArrayValue | undefined = Json.asArrayValue(objectValue.getPropertyValue(templateKeys.functions));
        if (functionNamespacesArray) {
            for (let namespaceElement of functionNamespacesArray.elements) {
                const namespaceObject = Json.asObjectValue(namespaceElement);
                if (namespaceObject) {
                    let namespace = UserFunctionNamespaceDefinition.createIfValid(document, namespaceObject);
                    if (namespace) {
                        namespaceDefinitions.push(namespace);
                    }
                }
            }
        }
    }

    return namespaceDefinitions;
}

function getResourceObjects(objectValue: Json.ObjectValue | undefined): Json.ArrayValue | undefined {
    if (objectValue) {
        return objectValue?.getPropertyValue(templateKeys.resources)?.asArrayValue;
    }

    return undefined;
}

// CONSIDER: scoping of resources for resourceId completion
// CONSIDER: difference between expression scope and template scope?
export function getResourcesFromObject(owningScope: TemplateScope, objectValue: Json.ObjectValue | undefined): IResource[] {
    const resources: IResource[] = [];
    if (objectValue) {
        const resourceObjects = getResourceObjects(objectValue);
        for (let resourceValue of resourceObjects?.elements ?? []) {
            const resourceObject = resourceValue.asObjectValue;
            if (resourceObject) {
                resources.push(new Resource(owningScope, resourceObject));
            }
        }
    }

    return resources;
}

const deploymentsResourceTypeLC: string = 'microsoft.resources/deployments';

export enum ExpressionScopeKind {
    inner = "inner",
    outer = "outer"
}

/**
 * A nested template with propertes.expressionEvaluationOptions.scope set to "inner".
 *
 * Evaluation of expressions, resource() etc. will be in the context of a scope unique to
 * this nested template.
 *
 * See https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/linked-templates#expression-evaluation-scope-in-nested-templates
 */
export class NestedTemplateInnerScope extends TemplateScopeFromObject {
    private _parameterValuesSource: ParameterValuesSourceFromJsonObject;

    public constructor(
        document: IJsonDocument,
        // The value of the "template" property containing the nested template itself
        private nestedTemplateObject: Json.ObjectValue | undefined,
        // parameter values, not the definitions inside the template
        private parameterValuesProperty: Json.Property | undefined,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(
            document,
            nestedTemplateObject,
            __debugDisplay
        );

        this._parameterValuesSource = new ParameterValuesSourceFromJsonObject(
            this.document,
            this.parameterValuesProperty,
            nestedTemplateObject
        );
    }

    protected getParameterValuesSource(): IParameterValuesSource | undefined {
        return this._parameterValuesSource;
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.NestedDeploymentWithInnerScope;

    protected getResources(): IResource[] | undefined {
        return getResourcesFromObject(this, this.nestedTemplateObject);
    }
}

/**
 * A nested template with propertes.expressionEvaluationOptions.scope not present or set to "outer".
 *
 * Evaluation of expressions, resource() etc. will be in the context of the parent's scope.
 *
 * See https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/linked-templates#expression-evaluation-scope-in-nested-templates
 */
export class NestedTemplateOuterScope extends TemplateScope {
    public constructor(
        private readonly parentScope: TemplateScope,
        // The value of the "template" property containing the nested template itself
        private readonly nestedTemplateObject: Json.ObjectValue | undefined,
        // parameter values, not the definitions inside the template (note: if this exists, it's an error)
        public parameterValuesProperty: Json.Property | undefined,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(
            parentScope.document,
            nestedTemplateObject,
            __debugDisplay
        );
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.NestedDeploymentWithOuterScope;

    // Shares its members with its parent
    public readonly hasUniqueParamsVarsAndFunctions: boolean = false;

    protected getParameterDefinitions(): IParameterDefinition[] | undefined {
        return this.parentScope.parameterDefinitions;
    }

    protected getVariableDefinitions(): IVariableDefinition[] | undefined {
        return this.parentScope.variableDefinitions;
    }

    protected getNamespaceDefinitions(): UserFunctionNamespaceDefinition[] | undefined {
        return this.parentScope.namespaceDefinitions;
    }

    protected getResources(): IResource[] | undefined {
        return getResourcesFromObject(this, this.nestedTemplateObject);
    }
}

export class LinkedTemplate extends TemplateScope {
    public constructor(
        private readonly parentScope: TemplateScope,
        templateLinkObject: Json.ObjectValue | undefined,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(
            parentScope.document,
            templateLinkObject,
            __debugDisplay
        );
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.LinkedDeployment;

    // Shares its members with its parent (i.e., if the expressions inside the
    // templateLink object reference parameters and variables, those are referring to
    // the parent's parameters/variables - a linked template does create a new scope, but
    // only inside the template contents themselves, not the templateLink object)
    public readonly hasUniqueParamsVarsAndFunctions: boolean = false;

    protected getParameterDefinitions(): IParameterDefinition[] | undefined {
        return this.parentScope.parameterDefinitions;
    }

    protected getVariableDefinitions(): IVariableDefinition[] | undefined {
        return this.parentScope.variableDefinitions;
    }

    protected getNamespaceDefinitions(): UserFunctionNamespaceDefinition[] | undefined {
        return this.parentScope.namespaceDefinitions;
    }

    protected getResources(): IResource[] | undefined {
        return undefined;
    }
}

export function isDeploymentResource(resourceObject: Json.Value | undefined): boolean {
    const resourceTypeLC = resourceObject?.asObjectValue?.getPropertyValue(templateKeys.resourceType)?.asStringValue
        ?.unquotedValue;
    return resourceTypeLC?.toLowerCase() === deploymentsResourceTypeLC;
}

// Note: This is here instead of in Resource.ts to avoid a circular dependence
export function getChildTemplateForResourceObject(
    parentScope: TemplateScope,
    resourceObject: Json.ObjectValue | undefined // an element of the "resources" section
): TemplateScope | undefined {
    // Example nested template

    // "resources": [
    //     {
    //         "type": "Microsoft.Resources/deployments",
    //         "name": "innerScopedNestedTemplate",
    //         "apiVersion": "2017-05-10",
    //         "properties": {
    //             "mode": "Incremental",
    //             "expressionEvaluationOptions": {
    //                 "scope": "inner"
    //             },
    //             "template": {
    //                 "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    //                 "contentVersion": "1.0.0.0",
    //                 "parameters": {
    //                    ..
    //             "parameters": {
    //                 // parameter values to assign to the template's parameter definitions
    //             }
    //      }

    // Is the resource type a deployment?
    if (resourceObject && isDeploymentResource(resourceObject)) {
        // Is it a nested or linked template?
        const propertiesObject = resourceObject?.getPropertyValue(templateKeys.properties)?.asObjectValue;
        const nestedTemplateObject = propertiesObject
            ?.getPropertyValue(templateKeys.nestedDeploymentTemplateProperty)?.asObjectValue;
        const templateName: string = resourceObject?.getPropertyValue(templateKeys.resourceName)?.asStringValue?.unquotedValue
            ?? '(unnamed)';

        if (nestedTemplateObject) {
            // It's a nested (embedded) template
            const scopeKind = getExpressionScopeKind(resourceObject);
            const parameterValuesProperty: Json.Property | undefined = resourceObject?.getPropertyValue(templateKeys.properties)
                ?.asObjectValue
                ?.getProperty(templateKeys.parameters);
            switch (scopeKind) {
                case ExpressionScopeKind.outer:
                    return new NestedTemplateOuterScope(
                        parentScope,
                        nestedTemplateObject,
                        parameterValuesProperty,
                        `Nested template "${templateName}" with outer scope`);
                case ExpressionScopeKind.inner:
                    return new NestedTemplateInnerScope(
                        parentScope.document,
                        nestedTemplateObject,
                        parameterValuesProperty,
                        `Nested template "${templateName}" with inner scope`
                    );
                default:
                    assertNever(scopeKind);
            }
        } else {
            const templateLinkObject =
                propertiesObject
                    ?.getPropertyValue(templateKeys.linkedDeploymentTemplateLink)?.asObjectValue;
            if (templateLinkObject) {
                return new LinkedTemplate(parentScope, templateLinkObject, `Linked template "${templateName}"`);
            }
        }

        return undefined;
    }
}

function getExpressionScopeKind(resourceObject: Json.ObjectValue | undefined): ExpressionScopeKind {
    const scopeValue = resourceObject?.getPropertyValue(templateKeys.properties)?.asObjectValue
        ?.getPropertyValue(templateKeys.nestedDeploymentExprEvalOptions)?.asObjectValue
        ?.getPropertyValue(templateKeys.nestedDeploymentExprEvalScope)
        ?.asStringValue?.unquotedValue;
    return scopeValue?.toLowerCase() === templateKeys.nestedDeploymentExprEvalScopeInner
        ? ExpressionScopeKind.inner
        : ExpressionScopeKind.outer; // Defaults to outer
}
