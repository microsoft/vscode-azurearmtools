// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file

import { deploymentsResourceTypeLC, templateKeys } from "../../../../common";
import { IProvideOpenedDocuments } from "../../../IProvideOpenedDocuments";
import * as Json from "../../../language/json/JSON";
import { assertNever } from "../../../util/assertNever";
import { parseUri } from "../../../util/uri";
import { IParameterDefinition } from "../../parameters/IParameterDefinition";
import { IParameterDefinitionsSource } from "../../parameters/IParameterDefinitionsSource";
import { IParameterValuesSource } from "../../parameters/IParameterValuesSource";
import { ParameterDefinition } from "../../parameters/ParameterDefinition";
import { ParameterValuesSourceFromJsonObject } from "../../parameters/ParameterValuesSourceFromJsonObject";
import { SimpleParameterDefinitionsSource } from "../../parameters/SimpleParameterDefinitionsSource";
import { DeploymentTemplateDoc } from "../DeploymentTemplateDoc";
import { IJsonDocument } from "../IJsonDocument";
import { IResource } from "../IResource";
import { getParameterDefinitionsFromLinkedTemplate } from "../linkedTemplates/getParameterDefinitionsFromLinkedTemplate";
import { ILinkedTemplateReference } from "../linkedTemplates/ILinkedTemplateReference";
import { Resource } from "../Resource";
import { UserFunctionNamespaceDefinition } from "../UserFunctionNamespaceDefinition";
import { IVariableDefinition, TopLevelCopyBlockVariableDefinition, TopLevelVariableDefinition } from "../VariableDefinition";
import { getDeploymentScopeReference } from "./getDeploymentScopeReference";
import { IDeploymentSchemaReference } from "./IDeploymentSchemaReference";
import { TemplateScope, TemplateScopeKind } from "./TemplateScope";

export interface IChildDeploymentScope {
    /**
     * The resource which is a deployments resource and defines this child deployment
     */
    owningDeploymentResource: IResource;
}

export class EmptyScope extends TemplateScope {
    public scopeKind: TemplateScopeKind = TemplateScopeKind.Empty;

    constructor(
    ) {
        super(undefined, new DeploymentTemplateDoc('', parseUri('https://emptydoc/scope'), 0), undefined, undefined, "Empty Scope");
    }

    protected getParameterDefinitionsSource(): IParameterDefinitionsSource {
        return new SimpleParameterDefinitionsSource([]);
    }
}

export class UserFunctionScope extends TemplateScope {
    constructor(
        parent: TemplateScope,
        document: IJsonDocument,
        rootObject: Json.ObjectValue,
        private readonly userFunctionParameterDefinitions: IParameterDefinition[],
        // tslint:disable-next-line:variable-name
        public readonly __debugDisplay: string // Convenience for debugging
    ) {
        super(parent, document, rootObject, undefined, __debugDisplay);
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.UserFunction;

    protected getVariableDefinitions(): IVariableDefinition[] | undefined {
        // variable references not supported in user functions
        return undefined;
    }

    protected getNamespaceDefinitions(): UserFunctionNamespaceDefinition[] | undefined {
        // nested user functions not supported in user functions
        return undefined;
    }

    protected getParameterDefinitionsSource(): IParameterDefinitionsSource {
        // User functions can only use their own parameters, they do
        //   not have access to top-level parameters
        return new SimpleParameterDefinitionsSource(this.userFunctionParameterDefinitions);
    }
}

abstract class TemplateScopeFromObject extends TemplateScope {
    private _parameterDefinitionsSource: IParameterDefinitionsSource;
    public constructor(
        parent: TemplateScope | undefined,
        document: IJsonDocument,
        private _templateRootObject: Json.ObjectValue | undefined,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(parent, document, _templateRootObject, getDeploymentScopeReferenceFromRootObject(_templateRootObject), __debugDisplay);
        this._parameterDefinitionsSource = new SimpleParameterDefinitionsSource(getParameterDefinitionsFromObject(this.document, this._templateRootObject));
    }

    protected getParameterDefinitionsSource(): IParameterDefinitionsSource {
        return this._parameterDefinitionsSource;
    }

    protected getVariableDefinitions(): IVariableDefinition[] | undefined {
        return getVariableDefinitionsFromObject(this._templateRootObject);
    }

    protected getNamespaceDefinitions(): UserFunctionNamespaceDefinition[] | undefined {
        return getNamespaceDefinitionsFromObject(this, this.document, this._templateRootObject);
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
            undefined,
            document,
            templateTopLevelValue,
            __debugDisplay
        );
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.TopLevel;
}

function getParameterDefinitionsFromObject(document: IJsonDocument, objectValue: Json.ObjectValue | undefined): ParameterDefinition[] {
    const parameterDefinitions: ParameterDefinition[] = [];

    if (objectValue) {
        const parameters: Json.ObjectValue | undefined = Json.asObjectValue(objectValue.getPropertyValue(templateKeys.parameters));
        if (parameters) {
            for (const parameter of parameters.properties) {
                parameterDefinitions.push(new ParameterDefinition(document, parameter));
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

function getNamespaceDefinitionsFromObject(parentScope: TemplateScope, document: IJsonDocument, objectValue: Json.ObjectValue | undefined): UserFunctionNamespaceDefinition[] {
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
                    let namespace = UserFunctionNamespaceDefinition.createIfValid(parentScope, document, namespaceObject);
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
        parent: TemplateScope,
        document: IJsonDocument,
        // The value of the "template" property containing the nested template itself
        public nestedTemplateObject: Json.ObjectValue | undefined,
        public owningDeploymentResource: IResource,
        // parameter values, not the definitions inside the template
        private parameterValuesProperty: Json.Property | undefined,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(
            parent,
            // the scope applies to the "template" property's value
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
        public readonly nestedTemplateObject: Json.ObjectValue | undefined,
        public owningDeploymentResource: IResource,
        // Parameter values, not the definitions inside the template (note: if this exists, it's an error)
        public parameterValuesProperty: Json.Property | undefined,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(
            parentScope,
            parentScope.document,
            // the scope applies to the "template" property's value
            nestedTemplateObject,
            getDeploymentScopeReferenceFromRootObject(nestedTemplateObject),
            __debugDisplay
        );
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.NestedDeploymentWithOuterScope;

    // Shares its members with its parent
    public readonly hasUniqueParamsVarsAndFunctions: boolean = false;

    protected getMemberOwningRootObject(): Json.ObjectValue | undefined {
        // Shares its members with its parent
        return this.parentScope.memberOwningRootObject;
    }

    protected getParameterDefinitionsSource(): IParameterDefinitionsSource {
        return this.parentScope.parameterDefinitionsSource;
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

export class LinkedTemplateScope extends TemplateScope implements IChildDeploymentScope {
    private _parameterValuesSource: ParameterValuesSourceFromJsonObject;

    // This is detected after the tree is created, so is set when available.
    private _linkedFileReferences: ILinkedTemplateReference[] | undefined;
    private _linkedFileParameterDefinitionsSource: SimpleParameterDefinitionsSource = new SimpleParameterDefinitionsSource();

    public constructor(
        parentScope: TemplateScope,
        // The value of the "templateLink" property for this linked template
        public templateLinkObject: Json.ObjectValue | undefined,
        // parameter values for the linked template
        private parameterValuesProperty: Json.Property | undefined,
        public owningDeploymentResource: IResource,
        // tslint:disable-next-line: variable-name
        __debugDisplay: string
    ) {
        super(
            parentScope,
            parentScope.document,
            // The vars/params/funcs defined for the linked template doesn't actually apply to evaluation of any expressions inside
            //   this template (they would only apply inside the linked template file itself), so the root object is always undefined.
            undefined,
            undefined,
            __debugDisplay
        );

        this._parameterValuesSource = new ParameterValuesSourceFromJsonObject(
            this.document,
            this.parameterValuesProperty,
            templateLinkObject
        );
    }

    /**
     * Linked files referenced by this scope (may change as new information is obtained)
     */
    public get linkedFileReferences(): ILinkedTemplateReference[] | undefined {
        return this._linkedFileReferences;
    }

    public get isRelativePath(): boolean {
        return !!(
            this.templateLinkObject?.hasProperty(templateKeys.linkedDeploymentTemplateLinkRelativePath)
            && !this.templateLinkObject?.hasProperty(templateKeys.linkedDeploymentTemplateLinkUri)
        );
    }

    public assignLinkedFileReferences(
        linkedFileReferences: ILinkedTemplateReference[] | undefined,
        provideOpenDocuments: IProvideOpenedDocuments
    ): void {
        this._linkedFileReferences = linkedFileReferences;
        this._linkedFileParameterDefinitionsSource.setParameterDefinitions([]);

        if (linkedFileReferences && linkedFileReferences.length > 0) {
            // Ignore all but the first reference for the same scope (as happens when the the deployment
            // resources is inside a COPY loop)
            const firstLinkedFileReference = linkedFileReferences[0];
            const parameterDefinitions: IParameterDefinition[] =
                getParameterDefinitionsFromLinkedTemplate(
                    firstLinkedFileReference,
                    provideOpenDocuments);
            this._linkedFileParameterDefinitionsSource.setParameterDefinitions(parameterDefinitions);
        }
    }

    public readonly scopeKind: TemplateScopeKind = TemplateScopeKind.LinkedDeployment;

    /*
        Technically, a linked template deployment does create a new scope, but it's not defined inside the main template but rather in the external
        linked template.  The parameters defined inside the linked template are exposed here for use with validation and intellisense

            {
            "name": "linkedDeployment1",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "2019-10-01",
            "properties": {
                "mode": "Incremental",
                "templateLink": {
                    // This is still part of the parent scope.
                    // Expressions here should be evaluated using the parent scope
                    "contentVersion": "expression",
                    "relativePath": "(string literal)",
                    "uri": "expression"
                },
                "parameters": {
                    // These are the parameter values to pass to the linked template.
                    // This is still part of the parent scope, so expressions here are evaluated in the parent's scope.

                    "childParam1": {
                        "value": "expression" // Part of parent scope
                    }
                }
            }
        }
    */

    public readonly hasUniqueParamsVarsAndFunctions: boolean = true;

    public readonly isExternal: boolean = true;

    protected getVariableDefinitions(): IVariableDefinition[] | undefined {
        return undefined;
    }

    protected getNamespaceDefinitions(): UserFunctionNamespaceDefinition[] | undefined {
        return undefined;
    }

    protected getResources(): IResource[] | undefined {
        return undefined;
    }

    protected getParameterValuesSource(): IParameterValuesSource | undefined {
        return this._parameterValuesSource;
    }

    protected getParameterDefinitionsSource(): IParameterDefinitionsSource {
        return this._linkedFileParameterDefinitionsSource;
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
    resource: IResource,
    // CONSIDER: get from resource
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
        const parameterValuesProperty: Json.Property | undefined = resourceObject?.getPropertyValue(templateKeys.properties)
            ?.asObjectValue
            ?.getProperty(templateKeys.parameters);

        if (nestedTemplateObject) {
            // It's a nested (embedded) template
            const scopeKind = getExpressionScopeKind(resourceObject);
            switch (scopeKind) {
                case ExpressionScopeKind.outer:
                    return new NestedTemplateOuterScope(
                        parentScope,
                        nestedTemplateObject,
                        resource,
                        parameterValuesProperty,
                        `Nested template "${templateName}" with outer scope`);
                case ExpressionScopeKind.inner:
                    return new NestedTemplateInnerScope(
                        parentScope,
                        parentScope.document,
                        nestedTemplateObject,
                        resource,
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
                return new LinkedTemplateScope(parentScope, templateLinkObject, parameterValuesProperty, resource, `Linked template "${templateName}"`);
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

function getDeploymentScopeReferenceFromRootObject(rootObject: Json.ObjectValue | undefined): IDeploymentSchemaReference {
    const schemaStringValue = rootObject?.getPropertyValue(templateKeys.schema)?.asStringValue;
    return getDeploymentScopeReference(schemaStringValue);
}
