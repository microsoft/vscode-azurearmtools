// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file // Private classes are related to DeploymentTemplate implementation

import * as assert from 'assert';
import * as path from 'path';
import { CodeAction, CodeActionContext, CodeActionKind, Command, DocumentLink, Range, Selection, Uri } from "vscode";
import { IActionContext } from 'vscode-azureextensionui';
import { TemplateScopeKind } from '../../../extension.bundle';
import { configKeys, templateKeys } from "../../constants";
import { ext } from '../../extensionVariables';
import { AzureRMAssets, FunctionsMetadata } from "../../language/expressions/AzureRMAssets";
import { isTleExpression } from '../../language/expressions/isTleExpression';
import * as TLE from "../../language/expressions/TLE";
import { INamedDefinition } from '../../language/INamedDefinition';
import { Issue } from '../../language/Issue';
import { IssueKind } from '../../language/IssueKind';
import * as Json from "../../language/json/JSON";
import { ReferenceList } from "../../language/ReferenceList";
import { ContainsBehavior, Span } from "../../language/Span";
import { CachedValue } from '../../util/CachedValue';
import { expectParameterDocumentOrUndefined } from '../../util/expectDocument';
import { Histogram } from '../../util/Histogram';
import { nonNullValue } from '../../util/nonNull';
import { ofType } from '../../util/ofType';
import { FindReferencesAndErrorsVisitor } from "../../visitors/FindReferencesAndErrorsVisitor";
import { FunctionCountVisitor } from "../../visitors/FunctionCountVisitor";
import { GenericStringVisitor } from "../../visitors/GenericStringVisitor";
import { ReferenceInVariableDefinitionsVisitor } from '../../visitors/ReferenceInVariableDefinitionsVisitor';
import * as UndefinedVariablePropertyVisitor from "../../visitors/UndefinedVariablePropertyVisitor";
import { getVSCodeRangeFromSpan } from '../../vscodeIntegration/vscodePosition';
import { DeploymentDocument, ResolvableCodeLens } from "../DeploymentDocument";
import { IParameterDefinitionsSource } from '../parameters/IParameterDefinitionsSource';
import { IParameterValuesSourceProvider } from '../parameters/IParameterValuesSourceProvider';
import { getMissingParameterErrors, getParameterValuesCodeActions } from '../parameters/ParameterValues';
import { SynchronousParameterValuesSourceProvider } from "../parameters/SynchronousParameterValuesSourceProvider";
import { TemplatePositionContext } from "../positionContexts/TemplatePositionContext";
import { LinkedTemplateCodeLens, NestedTemplateCodeLen, ParameterDefinitionCodeLens, SelectParameterFileCodeLens, ShowCurrentParameterFileCodeLens } from './deploymentTemplateCodeLenses';
import { getResourcesInfo } from './getResourcesInfo';
import { getParentAndChildCodeLenses } from './ParentAndChildCodeLenses';
import { isArmSchema } from './schemas';
import { DeploymentScopeKind } from './scopes/DeploymentScopeKind';
import { IDeploymentSchemaReference } from './scopes/IDeploymentSchemaReference';
import { TemplateScope } from "./scopes/TemplateScope";
import { IChildDeploymentScope, LinkedTemplateScope, NestedTemplateOuterScope, TopLevelTemplateScope } from './scopes/templateScopes';
import { UserFunctionParameterDefinition } from './UserFunctionParameterDefinition';

export interface IScopedParseResult {
    parseResult: TLE.TleParseResult;
    scope: TemplateScope;
}

interface IAllReferences {
    // A map from all definitions in the template to their referenced uses as a reference list
    referenceListsMap: Map<INamedDefinition | undefined, ReferenceList>;
    // Issues found while collecting references
    issues: Issue[];
}

// This is not intended to be a complete list, just to hit 95% of cases
const resourceTypesNotAllowedInRGDeployments: string[] = [
    "microsoft.blueprint/blueprints/artifacts",
    "microsoft.blueprint/blueprints",
    "microsoft.blueprint/blueprintAssignments",
    "microsoft.blueprint/blueprints/versions",
    "Microsoft.Authorization/policyDefinitions",
    "Microsoft.Authorization/policySetDefinitions",
    "Microsoft.Resources/resourceGroups",
    "Microsoft.ManagedNetwork/scopeAssignments",
    "Microsoft.Management/managementGroups",
    "Microsoft.Subscription/aliases",
];
const resourceTypesNotAllowedInRGDeploymentsLC: string[] = resourceTypesNotAllowedInRGDeployments.map(resType => resType.toLowerCase());

export interface IDocumentLinkInternal extends DocumentLink {
    internal?: {
        scope?: LinkedTemplateScope;
        fallbackTarget?: Uri;
    };
}

/**
 * Represents a deployment template file
 */
export class DeploymentTemplateDoc extends DeploymentDocument {
    // The top-level parameters and variables (as opposed to those in user functions and deployment resources)
    private _topLevelScope: CachedValue<TemplateScope> = new CachedValue<TemplateScope>();

    // A map from all JSON string value nodes to their cached TLE parse results
    private _jsonStringValueToTleParseResultMap: CachedValue<Map<Json.StringValue, IScopedParseResult>> = new CachedValue<Map<Json.StringValue, IScopedParseResult>>();

    // All discovered references of all definitions in this template
    private _allReferences: CachedValue<IAllReferences> = new CachedValue<IAllReferences>();

    private _allScopes: CachedValue<TemplateScope[]> = new CachedValue<TemplateScope[]>();

    /**
     * Create a new DeploymentTemplate object.
     *
     * @param _documentText The string text of the document.
     * @param _documentUri A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(documentText: string, documentUri: Uri) {
        super(documentText, documentUri);
    }

    public get topLevelScope(): TemplateScope {
        return this._topLevelScope.getOrCacheValue(() =>
            new TopLevelTemplateScope(
                this,
                this.topLevelValue,
                `Top-level template scope for ${this.documentUri}`
            )
        );
    }

    public hasArmSchemaUri(): boolean {
        return isArmSchema(this.schemaUri);
    }

    public get apiProfile(): string | undefined {
        if (this.topLevelValue) {
            const apiProfileValue = Json.asStringValue(this.topLevelValue.getPropertyValue(templateKeys.apiProfile));
            if (apiProfileValue) {
                return apiProfileValue.unquotedValue;
            }
        }

        return undefined;
    }

    /**
     * Parses all JSON strings in the template, assigns them a scope, and caches the results.
     * Returns a map that maps from the Json.StringValue object to the parse result (we can't cache
     * by the string value itself because those strings could have different scopes, and I don't
     * think the save in parsing of identical strings makes keying by scope and string value worth
     * the associated cost).
     */
    private get quotedStringToTleParseResultMap(): Map<Json.StringValue, IScopedParseResult> {
        return this._jsonStringValueToTleParseResultMap.getOrCacheValue(() => {
            return StringParseAndScopeAssignmentVisitor.createParsedStringMap(this);
        });
    }

    public getErrorsCore(_associatedParameters: DeploymentDocument | undefined): Issue[] {
        const errors: Issue[] = [];

        // Reference-related issues (undefined param/var references, etc)
        errors.push(...this.allReferences.issues);

        // Loop through each reachable string in the template
        this.visitAllReachableStringValues(jsonStringValue => {
            //const jsonTokenStartIndex: number = jsonQuotedStringToken.span.startIndex;
            const jsonTokenStartIndex = jsonStringValue.span.startIndex;

            const tleParseResult: IScopedParseResult = this.getTLEParseResultFromJsonStringValue(jsonStringValue);
            const expressionScope: TemplateScope = tleParseResult.scope;
            const tleExpression: TLE.Value | undefined = tleParseResult.parseResult.expression;

            for (const error of tleParseResult.parseResult.errors) {
                errors.push(error.translate(jsonTokenStartIndex));
            }

            // Undefined variable properties
            const tleUndefinedVariablePropertyVisitor = UndefinedVariablePropertyVisitor.UndefinedVariablePropertyVisitor.visit(tleExpression, expressionScope);
            for (const error of tleUndefinedVariablePropertyVisitor.errors) {
                errors.push(error.translate(jsonTokenStartIndex));
            }
        });

        // ReferenceInVariableDefinitionsVisitor
        const deploymentTemplateObject: Json.ObjectValue | undefined = Json.asObjectValue(this.jsonParseResult.value);
        if (deploymentTemplateObject) {
            const variablesObject: Json.ObjectValue | undefined = Json.asObjectValue(deploymentTemplateObject.getPropertyValue(templateKeys.variables));
            if (variablesObject) {
                const referenceInVariablesFinder = new ReferenceInVariableDefinitionsVisitor(this);
                variablesObject.accept(referenceInVariablesFinder);

                // Can't call reference() inside variable definitions
                for (const referenceSpan of referenceInVariablesFinder.referenceSpans) {
                    errors.push(
                        new Issue(referenceSpan, "reference() cannot be invoked inside of a variable definition.", IssueKind.referenceInVar));
                }
            }
        }

        errors.push(...this.getMissingParameterErrors());
        return errors;
    }

    public getWarnings(): Issue[] {
        const unusedWarnings = this.getUnusedDefinitionWarnings();
        const inaccessibleScopeMembers = this.getInaccessibleScopeMemberWarnings();
        const incorrectScopeWarnings = this.getIncorrectScopeWarnings();

        return unusedWarnings.concat(inaccessibleScopeMembers, incorrectScopeWarnings);
    }

    private get allReferences(): IAllReferences {
        return this._allReferences.getOrCacheValue(() => {
            const referenceListsMap = new Map<INamedDefinition, ReferenceList>();
            const issues: Issue[] = [];
            const functions: FunctionsMetadata = AzureRMAssets.getFunctionsMetadata();

            // Find all references for all reachable strings
            this.visitAllReachableStringValues(jsonStringValue => {
                const tleParseResult: IScopedParseResult | undefined = this.getTLEParseResultFromJsonStringValue(jsonStringValue);
                if (tleParseResult.parseResult.expression) {
                    // tslint:disable-next-line:no-non-null-assertion // Guaranteed by if
                    const scope = tleParseResult.scope;
                    FindReferencesAndErrorsVisitor.visit(scope, jsonStringValue.startIndex, tleParseResult.parseResult.expression, functions, referenceListsMap, issues);
                }
            });

            return {
                referenceListsMap,
                issues
            };
        });
    }

    private getUnusedDefinitionWarnings(): Issue[] {
        const warnings: Issue[] = [];
        const referenceListsMap = this.allReferences.referenceListsMap;

        for (const scope of this.uniqueNonExternalScopes) { // Don't consider linked templates, they
            // Unused parameters
            for (const parameterDefinition of scope.parameterDefinitionsSource.parameterDefinitions) {
                if (!referenceListsMap.has(parameterDefinition)) {
                    const message = parameterDefinition instanceof UserFunctionParameterDefinition
                        ? `User-function parameter '${parameterDefinition.nameValue.toString()}' is never used.`
                        : `The parameter '${parameterDefinition.nameValue.toString()}' is never used.`;

                    warnings.push(
                        new Issue(
                            parameterDefinition.nameValue.span,
                            message,
                            IssueKind.unusedParam));
                }
            }

            // Unused variables
            for (const variableDefinition of scope.variableDefinitions) {
                if (!referenceListsMap.has(variableDefinition)) {
                    warnings.push(
                        new Issue(variableDefinition.nameValue.span, `The variable '${variableDefinition.nameValue.toString()}' is never used.`, IssueKind.unusedVar));
                }
            }

            // Unused user-defined functions (we don't give a warning for unused namespaces)
            for (const ns of scope.namespaceDefinitions) {
                for (const member of ns.members) {
                    if (!referenceListsMap.has(member)) {
                        warnings.push(
                            new Issue(
                                member.nameValue.span,
                                `The user-defined function '${member.fullName}' is never used.`,
                                IssueKind.unusedUdf));
                    }
                }
            }
        }

        return warnings;
    }

    /**
     * Finds parameters/variables/functions inside outer-scoped nested templates, which
     * by definition can't be accessed in any expressions.
     */
    private getInaccessibleScopeMemberWarnings(): Issue[] {
        const warnings: Issue[] = [];
        const warningMessage =
            // tslint:disable-next-line: prefer-template
            'Variables, parameters and user functions of an outer-scoped nested template are inaccessible to any expressions. '
            + `If you intended inner scope, set the deployment resource's properties.expressionEvaluationOptions.scope to 'inner'.`;

        for (const scope of this.allScopes) {
            if (scope instanceof NestedTemplateOuterScope) {
                const parameters = getPropertyValueOfScope(templateKeys.parameters);
                // tslint:disable-next-line: strict-boolean-expressions
                if (!!parameters?.asObjectValue?.properties?.length) {
                    warnings.push(
                        new Issue(parameters.span, warningMessage, IssueKind.inaccessibleNestedScopeMembers));
                }

                const variables = getPropertyValueOfScope(templateKeys.variables);
                // tslint:disable-next-line: strict-boolean-expressions
                if (!!variables?.asObjectValue?.properties.length) {
                    warnings.push(
                        new Issue(variables.span, warningMessage, IssueKind.inaccessibleNestedScopeMembers));
                }

                const namespaces = getPropertyValueOfScope(templateKeys.functions);
                // tslint:disable-next-line: strict-boolean-expressions
                if (!!namespaces?.asArrayValue?.elements.length) {
                    warnings.push(
                        new Issue(namespaces.span, warningMessage, IssueKind.inaccessibleNestedScopeMembers));
                }

                const propertyValues = scope.parameterValuesProperty;
                // tslint:disable-next-line: strict-boolean-expressions
                if (!!propertyValues?.value?.asObjectValue?.properties.length) {
                    warnings.push(
                        new Issue(propertyValues.span, warningMessage, IssueKind.inaccessibleNestedScopeMembers));
                }

                function getPropertyValueOfScope(propertyName: string): Json.Value | undefined {
                    return scope.rootObject?.getProperty(propertyName)?.value;
                }
            }
        }

        return warnings;
    }

    /**
     * Finds parameters/variables/functions inside outer-scoped nested templates, which
     * by definition can't be accessed in any expressions.
     */
    private getIncorrectScopeWarnings(): Issue[] {
        const warnings: Issue[] = [];

        // Only check top-level scope for now
        const scope = this.topLevelScope;
        const deploymentSchema: IDeploymentSchemaReference | undefined = scope.deploymentSchema;
        if (deploymentSchema?.matchingInfo?.deploymentScopeKind === DeploymentScopeKind.resourceGroup) {
            for (const resource of scope.resources) {
                if (resource.resourceTypeValue) {
                    const resourceTypeLC: string | undefined = resource.resourceTypeValue.asStringValue?.unquotedValue.toLowerCase();
                    if (resourceTypeLC && resourceTypesNotAllowedInRGDeploymentsLC.includes(resourceTypeLC)) {
                        const warningMessage = `This resource type may not available for a deployment scoped to resource group. Are you using the correct schema?`;
                        const warning = new Issue(resource.resourceTypeValue.span, warningMessage, IssueKind.incorrectScopeWarning);

                        const schemaSpan = deploymentSchema.schemaStringValue?.span;
                        if (schemaSpan) {
                            warning.relatedInformation.push({
                                location: {
                                    uri: this.documentUri,
                                    span: schemaSpan
                                },
                                message: "The schema is specified here"
                            });
                        }
                        warnings.push(warning);
                    }
                }
            }
        }

        return warnings;
    }

    private getMissingParameterErrors(): Issue[] {
        const errors: Issue[] = [];

        for (const scope of this.uniqueScopes) {
            if (scope.parameterValuesSource) {
                const scopeErrors = getMissingParameterErrors(scope.parameterValuesSource, scope.parameterDefinitionsSource);
                errors.push(...scopeErrors);
            }
        }

        return errors;
    }

    //#region Telemetry

    /**
     * Gets info about TLE function usage, useful for telemetry
     */
    public getFunctionCounts(): Histogram {
        const functionCounts = new Histogram();

        if (this.jsonParseResult.value) {
            GenericStringVisitor.visit(
                this.jsonParseResult.value,
                (stringValue: Json.StringValue): void => {
                    const tleParseResult = this.getTLEParseResultFromJsonStringValue(stringValue);
                    let tleFunctionCountVisitor = FunctionCountVisitor.visit(tleParseResult.parseResult.expression);
                    functionCounts.add(tleFunctionCountVisitor.functionCounts);
                });
        }

        return functionCounts;
    }

    /**
     * Gets info about schema usage, useful for telemetry
     */
    public getResourceUsage(): Histogram {
        const resourceCounts = new Histogram();
        // tslint:disable-next-line: strict-boolean-expressions
        const apiProfileString = `(profile=${this.apiProfile || 'none'})`.toLowerCase();

        // Collect all resources used
        const resources: Json.ArrayValue | undefined = this.topLevelValue ? Json.asArrayValue(this.topLevelValue.getPropertyValue(templateKeys.resources)) : undefined;
        if (resources) {
            traverseResources(resources, undefined);
        }

        return resourceCounts;

        function traverseResources(resourcesObject: Json.ArrayValue, parentKey: string | undefined): void {
            for (let resource of resourcesObject.elements) {
                const resourceObject = Json.asObjectValue(resource);
                if (resourceObject) {
                    const resourceType = Json.asStringValue(resourceObject.getPropertyValue(templateKeys.resourceType));
                    if (resourceType) {
                        const apiVersion = Json.asStringValue(resourceObject.getPropertyValue(templateKeys.resourceApiVersion));
                        let apiVersionString: string | undefined = apiVersion ? apiVersion.unquotedValue.trim().toLowerCase() : undefined;
                        if (!apiVersionString) {
                            apiVersionString = apiProfileString;
                        } else {
                            if (apiVersionString.startsWith('[')) {
                                apiVersionString = '[expression]';
                            }
                        }

                        let resourceTypeString = resourceType.unquotedValue.trim().toLowerCase();
                        if (resourceTypeString.startsWith('[')) {
                            resourceTypeString = "[expression]";
                        }

                        let simpleKey = `${resourceTypeString}@${apiVersionString}`;
                        const fullKey = parentKey ? `${simpleKey}[parent=${parentKey}]` : simpleKey;
                        resourceCounts.add(fullKey);

                        // Check for child resources
                        const childResources = Json.asArrayValue(resourceObject.getPropertyValue(templateKeys.resources));
                        if (childResources) {
                            traverseResources(childResources, simpleKey);
                        }
                    }
                }
            }
        }
    }

    public getMultilineStringCount(): number {
        let count = 0;
        this.visitAllReachableStringValues(jsonStringValue => {
            if (jsonStringValue.unquotedValue.indexOf("\n") >= 0) {
                ++count;
            }
        });

        return count;
    }

    public getChildTemplatesInfo(): {
        nestedOuterCount: number;
        nestedInnerCount: number;
        linkedTemplatesCount: number;
    } {
        const scopes = this.allScopes;
        return {
            nestedOuterCount: scopes.filter(s => s.scopeKind === TemplateScopeKind.NestedDeploymentWithOuterScope).length,
            nestedInnerCount: scopes.filter(s => s.scopeKind === TemplateScopeKind.NestedDeploymentWithInnerScope).length,
            linkedTemplatesCount: scopes.filter(s => s.scopeKind === TemplateScopeKind.LinkedDeployment).length
        };
    }

    //#endregion

    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, associatedParameters: DeploymentDocument | undefined, allowOutOfBounds: boolean = true): TemplatePositionContext {
        return TemplatePositionContext.fromDocumentLineAndColumnIndexes(this, documentLineIndex, documentColumnIndex, expectParameterDocumentOrUndefined(associatedParameters), allowOutOfBounds);
    }

    public getContextFromDocumentCharacterIndex(documentCharacterIndex: number, associatedParameters: DeploymentDocument | undefined, allowOutOfBounds: boolean = true): TemplatePositionContext {
        return TemplatePositionContext.fromDocumentCharacterIndex(this, documentCharacterIndex, expectParameterDocumentOrUndefined(associatedParameters), allowOutOfBounds);
    }

    /**
     * Get the TLE parse results from this JSON string.
     */
    public getTLEParseResultFromJsonStringValue(jsonStringValue: Json.StringValue): IScopedParseResult {
        const result = this.quotedStringToTleParseResultMap.get(jsonStringValue);
        if (result) {
            return result;
        }

        // This string must not be in the reachable Json.Value tree due to syntax or other issues which
        //   the language server should show in our diagnostics.
        // Go ahead and parse it now, pretending it has top-level scope
        const tleParseResult = TLE.Parser.parse(jsonStringValue.quotedValue);
        const scopedResult: IScopedParseResult = { parseResult: tleParseResult, scope: this.topLevelScope };
        this.quotedStringToTleParseResultMap.set(jsonStringValue, scopedResult);
        return scopedResult;
    }

    public findReferencesToDefinition(definition: INamedDefinition): ReferenceList {
        const result: ReferenceList = new ReferenceList(definition.definitionKind);

        const referencesList = this.allReferences.referenceListsMap.get(definition);

        // Add the definition of whatever's being referenced to the list
        if (definition.nameValue) {
            result.add({ document: this, span: definition.nameValue.unquotedSpan });
        }

        if (referencesList) {
            result.addAll(referencesList);
        }

        return result;
    }

    private visitAllReachableStringValues(onStringValue: (stringValue: Json.StringValue) => void): void {
        let value = this.topLevelValue;
        if (value) {
            GenericStringVisitor.visit(value, onStringValue);
        }
    }

    public getCodeActions(
        _associatedDocument: DeploymentDocument | undefined,
        range: Range | Selection,
        context: CodeActionContext
    ): (Command | CodeAction)[] {
        const actions: (CodeAction | Command)[] = [];

        // Add missing parameter values
        for (const scope of this.uniqueScopes) {
            if (scope.parameterValuesSource) {
                let parentParameterDefinitionsSource: IParameterDefinitionsSource | undefined = scope.parentWithUniqueParamsVarsAndFunctions.parameterDefinitionsSource;
                const scopeActions = getParameterValuesCodeActions(
                    scope.parameterValuesSource,
                    scope.parameterDefinitionsSource,
                    parentParameterDefinitionsSource,
                    range,
                    context);
                actions.push(...scopeActions);
            }
        }

        // Extract param/var
        actions.push(...this.getExtractVarParamCodeActions(range));

        return actions;
    }

    // tslint:disable-next-line: no-suspicious-comment
    // tslint:disable-next-line: cyclomatic-complexity // TODO: Consider refactoring
    private getExtractVarParamCodeActions(range: Range | Selection): (CodeAction | Command)[] {
        let shouldAddExtractActions: boolean = false;
        let pc = this.getContextFromDocumentLineAndColumnIndexes(range.start.line, range.start.character, undefined);

        // We currently only handle single-line strings
        if (range.start.line === range.end.line) {
            // Can only call pc.jsonTokenStartIndex if we're inside a JSON token
            if (pc.jsonToken && pc.jsonTokenStartIndex > 0) {
                let jsonToken = pc.document.getJSONValueAtDocumentCharacterIndex(pc.jsonTokenStartIndex - 1, ContainsBehavior.extended);
                if ((jsonToken instanceof Json.Property || jsonToken instanceof Json.ArrayValue) && pc.document.topLevelValue) {
                    let scope = pc.getScope();
                    if (!scope.rootObject) {
                        return [];
                    }
                    let resources = scope.rootObject.getPropertyValue(templateKeys.resources);
                    // Are we inside the resources object?
                    if (!resources || !resources.span.intersect(jsonToken.span)) {
                        return [];
                    }
                    let jsonValue = pc.document.getJSONValueAtDocumentCharacterIndex(pc.jsonTokenStartIndex, ContainsBehavior.extended);
                    if (!jsonValue) {
                        return [];
                    }
                    const stringValue = jsonValue.asStringValue;
                    if (stringValue) {
                        if (!range.isEmpty) {
                            let startIndex = this.getDocumentCharacterIndex(range.start.line, range.start.character);
                            let endIndex = this.getDocumentCharacterIndex(range.end.line, range.end.character);
                            let span: Span = new Span(startIndex, endIndex - startIndex);
                            const selectedText = this.getDocumentTextWithSquareBrackets(span);
                            if (this.isParameterOrVariableReference(selectedText)) {
                                return [];
                            }
                            if (pc.jsonValue && jsonValue.span === pc.jsonValue.span && selectedText && this.equalsWithSqareBrackets(pc.jsonValue.asStringValue?.unquotedValue, selectedText)) {
                                shouldAddExtractActions = true;
                            } else {
                                if (isTleExpression(stringValue.unquotedValue)) {
                                    shouldAddExtractActions = this.isValidExpression(this.getDocumentTextWithSurroundingCharacters(span, "'", "'"));
                                }
                            }
                        } else {
                            if (this.isSimpleText(stringValue.quotedValue) && pc.jsonValue && jsonValue.span === pc.jsonValue.span) {
                                shouldAddExtractActions = true;
                            }
                        }
                    }
                }
            }
        }

        if (shouldAddExtractActions) {
            return [
                this.createExtractCommand('Extract Parameter...', 'extractParameter'),
                this.createExtractCommand('Extract Variable...', 'extractVariable'),
            ];
        }

        return [];
    }

    private getDocumentTextWithSquareBrackets(span: Span): string {
        let text = this.getDocumentText(span);
        if (text.startsWith("[") && text.endsWith("]")) {
            return text;
        }
        let extendedSpan = span.extendLeft(1).extendRight(1);
        let extendedText = this.getDocumentText(extendedSpan);
        if (extendedText.startsWith("[") && extendedText.endsWith("]")) {
            return extendedText;
        }
        return text;
    }

    private getDocumentTextWithSurroundingCharacters(span: Span, start: string, end: string): string {
        let text = this.getDocumentText(span);
        if (text.startsWith(start) && text.endsWith(end)) {
            return text;
        }
        let extendedSpan = span.extendLeft(1).extendRight(1);
        let extendedText = this.getDocumentText(extendedSpan);
        if (extendedText.startsWith(start) && extendedText.endsWith(end)) {
            return extendedText;
        }
        return text;
    }

    private isParameterOrVariableReference(text: string): boolean {
        const regEx = /^"?\[?(parameters|variables)\('.+'\)]?"?/gi;
        return regEx.test(text);
    }

    private isSimpleText(text: string): boolean {
        if (text.startsWith("\"[") || text.endsWith("]\"")) {
            return false;
        }
        return text.startsWith("\"") && text.endsWith("\"");
    }

    public isValidExpression(text: string): boolean {
        const functionCallRegex = /^\s*[\w\.]+\(.*\)\s*$/gi;
        const textRegex = /^\s*'.+'\s*$/gi;
        return functionCallRegex.test(text) || textRegex.test(text);
    }

    private equalsWithSqareBrackets(text: string | undefined, selectedText: string): boolean {
        if (!text) {
            return false;
        }
        if (text === selectedText) {
            return true;
        }
        if (text.startsWith("[") && text.endsWith("]")) {
            text = text.substr(1, text.length - 2);
        }
        return text === selectedText;
    }

    private createExtractCommand(title: string, command: string): CodeAction {
        const action = new CodeAction(title, CodeActionKind.RefactorExtract);
        action.command = { command: `azurerm-vscode-tools.codeAction.${command}`, title: '' };
        return action;
    }

    public getTextAtTleValue(tleValue: TLE.Value, parentStringToken: Json.Token): string {
        assert.equal(parentStringToken.type, Json.TokenType.QuotedString);
        const spanOfValueInsideString = tleValue.getSpan();
        return this.getDocumentText(spanOfValueInsideString, parentStringToken.span.startIndex);
    }

    /**
     * Retrieves code lenses for the top-level parameters and all child deployments
     * @param topLevelParameterValuesProvider Represents the associated parameter values for the top level (could be a parameter file), if any
     */
    public getCodeLenses(
        topLevelParameterValuesProvider: IParameterValuesSourceProvider | undefined
    ): ResolvableCodeLens[] {
        const lenses: ResolvableCodeLens[] = [];

        for (const scope of this.allScopes) {
            if (scope.hasUniqueParamsVarsAndFunctions) {
                let paramValuesSourceProvider: IParameterValuesSourceProvider | undefined;

                if (scope instanceof TopLevelTemplateScope) {
                    paramValuesSourceProvider = topLevelParameterValuesProvider;
                } else {
                    // For anything other than the top level, we already have the parameter values source, no need to resolve lazily
                    const parameterValuesSource = scope.parameterValuesSource;
                    paramValuesSourceProvider = parameterValuesSource ? new SynchronousParameterValuesSourceProvider(parameterValuesSource) : undefined;
                }

                const codelenses = this.getParameterCodeLenses(scope, paramValuesSourceProvider);
                lenses.push(...codelenses);
            }

            // This should run for all scopes, whether "unique" or not (because resources are always unique for
            // a scope with the current design)
            // CONSIDER: Optimize calls in IResource so that most work is delayed until code lens resolution
            const infos = getResourcesInfo({ scope, recognizeDecoupledChildren: true });
            lenses.push(...getParentAndChildCodeLenses(scope, infos));
        }

        lenses.push(...this.getChildTemplateCodeLenses(topLevelParameterValuesProvider));

        return lenses;
    }

    private getParameterCodeLenses(
        uniqueScope: TemplateScope,
        parameterValuesSourceProvider: IParameterValuesSourceProvider | undefined
    ): ResolvableCodeLens[] {
        if (!ext.configuration.get<boolean>(configKeys.codeLensForParameters)) {
            return [];
        }

        const lenses: ResolvableCodeLens[] = [];

        if (uniqueScope.isExternal) {
            // External parameter definitions (e.g. linked templates)
            return [];
        }

        // Code lens for the top-level "parameters" section itself - indicates where the parameters are coming from
        if (uniqueScope instanceof TopLevelTemplateScope) {
            // Top level
            const parametersCodeLensSpan = uniqueScope.rootObject?.getProperty(templateKeys.parameters)?.span
                ?? new Span(0, 0);

            // Is there a parameter file?
            const parameterFileUri = parameterValuesSourceProvider?.parameterFileUri;
            if (parameterFileUri) {
                // Yes - indicate current parameter file path
                assert(uniqueScope instanceof TopLevelTemplateScope, "Expecting top-level scope");
                lenses.push(new ShowCurrentParameterFileCodeLens(uniqueScope, parametersCodeLensSpan, parameterFileUri));
            }

            // Allow user to change or select/create parameter file
            lenses.push(new SelectParameterFileCodeLens(this.topLevelScope, parametersCodeLensSpan, parameterFileUri, {}));
        }

        // Code lens for each parameter definition
        if (parameterValuesSourceProvider) {
            lenses.push(...uniqueScope.parameterDefinitionsSource.parameterDefinitions.map(pd => new ParameterDefinitionCodeLens(uniqueScope, pd, parameterValuesSourceProvider)));
        }

        return lenses;
    }

    private getChildTemplateCodeLenses(
        topLevelParameterValuesProvider: IParameterValuesSourceProvider | undefined
    ): ResolvableCodeLens[] {
        const lenses: ResolvableCodeLens[] = [];
        for (let scope of this.allScopes) {
            const owningDeploymentResource = (<Partial<IChildDeploymentScope>>scope).owningDeploymentResource;
            if (scope.rootObject || owningDeploymentResource) {
                switch (scope.scopeKind) {
                    case TemplateScopeKind.NestedDeploymentWithInnerScope:
                    case TemplateScopeKind.NestedDeploymentWithOuterScope:
                        if (scope.rootObject) {
                            const lens = NestedTemplateCodeLen.create(scope, scope.rootObject.span);
                            if (lens) {
                                lenses.push(lens);
                            }
                        }
                        break;
                    case TemplateScopeKind.LinkedDeployment:
                        assert(scope instanceof LinkedTemplateScope, "Expected a LinkedTemplateScope");
                        if (owningDeploymentResource) {
                            const templateLinkObject = scope.templateLinkObject;
                            let span = templateLinkObject ? templateLinkObject.span : owningDeploymentResource.span;

                            lenses.push(...
                                LinkedTemplateCodeLens.create(
                                    scope,
                                    span,
                                    scope.linkedFileReferences,
                                    topLevelParameterValuesProvider)
                            );
                        }
                        break;
                    default:
                        break;
                }
            }
        }

        return lenses;
    }

    public getDocumentLinks(context: IActionContext): DocumentLink[] {
        const links: DocumentLink[] = [];

        // Make a document link out of each deployment "relativePath" property value
        for (const scope of ofType(this.allScopes, LinkedTemplateScope)) {
            const relativePathValue: Json.StringValue | undefined =
                scope.templateLinkObject?.getPropertyValue(templateKeys.linkedDeploymentTemplateLinkRelativePath)
                    ?.asStringValue;
            if (relativePathValue && relativePathValue.unquotedValue) {
                // Add info directly to the link that we return, it will be handled back to us to resolve
                const internalLink = <IDocumentLinkInternal>new DocumentLink(
                    getVSCodeRangeFromSpan(this, relativePathValue.unquotedSpan));

                // Provide the scope in order for the resolve code to be able to pick up the
                //   correct link dynamically
                // The fallback target is simply the calculated by appending the relative path to the
                //   folder the template is in (which theoretically should be the same thing)
                const fallbackTarget = Uri.file(
                    path.resolve(path.dirname(this.documentUri.fsPath), relativePathValue.unquotedValue)
                );
                internalLink.internal = {
                    scope,
                    fallbackTarget,
                };

                links.push(internalLink);
            }
        }

        return links;
    }

    /**
     * Returns all scopes which actually host unique members
     */
    public get uniqueScopes(): TemplateScope[] {
        return this.allScopes.filter(scope => scope.hasUniqueParamsVarsAndFunctions);
    }

    /**
     * Returns all scopes which actually host unique members and whose members are not defined
     * external (linked templates)
     */
    public get uniqueNonExternalScopes(): TemplateScope[] {
        return this.allScopes.filter(scope => scope.hasUniqueParamsVarsAndFunctions && !scope.isExternal);
    }

    /**
     * Returns all scopes, including those that just repeat their parents' scopes
     */
    public get allScopes(): TemplateScope[] {
        return this._allScopes.getOrCacheValue(() => {
            let scopes: TemplateScope[] = [this.topLevelScope];
            traverse(this.topLevelScope);
            return scopes;

            function traverse(scope: TemplateScope | undefined): void {
                for (let childScope of scope?.childScopes ?? []) {
                    assert(scopes.indexOf(childScope) < 0, "Already in array");
                    scopes.push(childScope);
                    traverse(childScope);
                }
            }
        });
    }
}

//#region StringParseAndScopeAssignmentVisitor

class StringParseAndScopeAssignmentVisitor extends Json.Visitor {
    private readonly _jsonStringValueToTleParseResultMap: Map<Json.StringValue, IScopedParseResult> = new Map<Json.StringValue, IScopedParseResult>();
    private readonly _scopeStack: TemplateScope[] = [];
    private _currentScope: TemplateScope;
    private readonly _uniqueTemplateScopes: TemplateScope[] = [];

    public constructor(private readonly _dt: DeploymentTemplateDoc) {
        super();
        this._currentScope = _dt.topLevelScope;
        this._uniqueTemplateScopes = _dt.uniqueScopes;
    }

    public static createParsedStringMap(dt: DeploymentTemplateDoc): Map<Json.StringValue, IScopedParseResult> {
        const visitor = new StringParseAndScopeAssignmentVisitor(dt);
        return visitor.createMap();
    }

    private createMap(): Map<Json.StringValue, IScopedParseResult> {
        this._dt.topLevelValue?.accept(this);
        return this._jsonStringValueToTleParseResultMap;
    }

    public visitStringValue(jsonStringValue: Json.StringValue): void {
        assert(!this._jsonStringValueToTleParseResultMap.has(jsonStringValue), "Already parsed this string");
        // Parse the string as a possible TLE expression and cache
        let tleParseResult: TLE.TleParseResult = TLE.Parser.parse(jsonStringValue.quotedValue);
        this._jsonStringValueToTleParseResultMap.set(jsonStringValue, {
            parseResult: tleParseResult,
            scope: this._currentScope
        });
    }

    public visitObjectValue(jsonObjectValue: Json.ObjectValue): void {
        const currentScope = this._currentScope;
        const newScope = this._uniqueTemplateScopes.find(scope => scope.rootObject === jsonObjectValue);
        if (newScope) {
            this._scopeStack.push(this._currentScope);
            this._currentScope = newScope;
        }

        super.visitObjectValue(jsonObjectValue);

        if (newScope) {
            assert(this._currentScope === newScope);
            this._currentScope = nonNullValue(this._scopeStack.pop(), "Scopes stack should not be empty");
            assert(this._currentScope === currentScope);
        }
    }
}

//#endregion
