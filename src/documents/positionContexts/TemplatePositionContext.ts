// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------
// tslint:disable:max-line-length
import { templateKeys } from "../../constants";
import { ext } from "../../extensionVariables";
import { assert } from '../../fixed_assert';
import { AzureRMAssets, BuiltinFunctionMetadata } from "../../language/expressions/AzureRMAssets";
import * as TLE from "../../language/expressions/TLE";
import { INamedDefinition } from "../../language/INamedDefinition";
import * as Json from "../../language/json/JSON";
import { ReferenceList } from "../../language/ReferenceList";
import { ContainsBehavior, Span } from "../../language/Span";
import { InsertionContext } from "../../snippets/InsertionContext";
import { KnownContexts } from "../../snippets/KnownContexts";
import { CachedValue } from "../../util/CachedValue";
import * as Completion from "../../vscodeIntegration/Completion";
import { DeploymentParametersDoc } from "../parameters/DeploymentParametersDoc";
import { IParameterDefinition } from "../parameters/IParameterDefinition";
import { getPropertyValueCompletionItems } from "../parameters/ParameterValues";
import { DeploymentTemplateDoc } from "../templates/DeploymentTemplateDoc";
import { getDependsOnCompletions } from "../templates/getDependsOnCompletions";
import { getResourceIdCompletions } from "../templates/getResourceIdCompletions";
import { IFunctionMetadata, IFunctionParameterMetadata } from "../templates/IFunctionMetadata";
import { TemplateScope } from "../templates/scopes/TemplateScope";
import { isDeploymentResource } from "../templates/scopes/templateScopes";
import { UserFunctionDefinition } from "../templates/UserFunctionDefinition";
import { UserFunctionMetadata } from "../templates/UserFunctionMetadata";
import { UserFunctionNamespaceDefinition } from "../templates/UserFunctionNamespaceDefinition";
import { IVariableDefinition } from "../templates/VariableDefinition";
import { ICompletionItemsResult, IReferenceSite, PositionContext, ReferenceSiteKind } from "./PositionContext";

/**
 * Information about the TLE expression (if position is at an expression string)
 */
class TleInfo implements ITleInfo {
    public constructor(
        public readonly tleParseResult: TLE.TleParseResult,
        /**
         * Index of the cursor from the start of the TLE string
         */
        public readonly tleCharacterIndex: number,
        public readonly tleValue: TLE.Value | undefined,
        public readonly scope: TemplateScope
    ) {
    }
}

/**
 * Represents a position inside the snapshot of a deployment template, plus all related information
 * that can be parsed and analyzed about it
 */
export class TemplatePositionContext extends PositionContext {
    private _tleInfo: CachedValue<TleInfo | undefined> = new CachedValue<TleInfo | undefined>();

    public static fromDocumentLineAndColumnIndexes(deploymentTemplate: DeploymentTemplateDoc, documentLineIndex: number, documentColumnIndex: number, associatedParameters: DeploymentParametersDoc | undefined, allowOutOfBounds: boolean = true): TemplatePositionContext {
        let context = new TemplatePositionContext(deploymentTemplate, associatedParameters);
        context.initFromDocumentLineAndColumnIndices(documentLineIndex, documentColumnIndex, allowOutOfBounds);
        return context;
    }

    public static fromDocumentCharacterIndex(deploymentTemplate: DeploymentTemplateDoc, documentCharacterIndex: number, associatedParameters: DeploymentParametersDoc | undefined, allowOutOfBounds: boolean = true): TemplatePositionContext {
        let context = new TemplatePositionContext(deploymentTemplate, associatedParameters);
        context.initFromDocumentCharacterIndex(documentCharacterIndex, allowOutOfBounds);
        return context;
    }

    private constructor(deploymentTemplate: DeploymentTemplateDoc, associatedParameters: DeploymentParametersDoc | undefined) {
        super(deploymentTemplate, associatedParameters);
    }

    public get document(): DeploymentTemplateDoc {
        return <DeploymentTemplateDoc>super.document;
    }

    /**
     * Retrieves TleInfo for the current position if it's inside a string
     */
    public get tleInfo(): TleInfo | undefined {
        return this._tleInfo.getOrCacheValue(() => {
            //const tleParseResult = this._deploymentTemplate.getTLEParseResultFromJSONToken(this.jsonToken);
            const jsonToken = this.jsonToken;
            if (
                jsonToken
                && jsonToken.type === Json.TokenType.QuotedString
                && this.jsonValue
                && this.jsonValue instanceof Json.StringValue
            ) {
                const tleParseResult = this.document.getTLEParseResultFromJsonStringValue(this.jsonValue);
                const tleCharacterIndex = this.documentCharacterIndex - this.jsonTokenStartIndex;
                const tleValue = tleParseResult.parseResult.getValueAtCharacterIndex(tleCharacterIndex);
                return new TleInfo(tleParseResult.parseResult, tleCharacterIndex, tleValue, tleParseResult.scope);
            }
            return undefined;
        });
    }

    /**
     * If this position is inside an expression, inside a reference to an interesting function/parameter/etc, then
     * return an object with information about this reference and the corresponding definition
     */
    // tslint:disable-next-line:no-suspicious-comment
    // CONSIDER: should includeDefinition should always be true?  For instance, it would mean
    //  that we get hover over the definition of a param/var/etc and not just at references.
    //  Any bad side effects?
    public getReferenceSiteInfo(includeDefinition: boolean): IReferenceSite | undefined {
        const tleInfo = this.tleInfo;
        if (tleInfo) {
            const scope = tleInfo.scope;
            const tleCharacterIndex = tleInfo.tleCharacterIndex;
            const definitionDocument = this.document;
            const referenceDocument = this.document;

            const tleFuncCall: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(tleInfo.tleValue);
            if (tleFuncCall) {
                if (tleFuncCall.namespaceToken && tleFuncCall.namespaceToken.span.contains(tleCharacterIndex, ContainsBehavior.strict)) {
                    // Inside the namespace of a user-function reference
                    const ns = tleFuncCall.namespaceToken.stringValue;
                    const nsDefinition = scope.getFunctionNamespaceDefinition(ns);
                    if (nsDefinition) {
                        const unquotedReferenceSpan: Span = tleFuncCall.namespaceToken.span.translate(this.jsonTokenStartIndex);
                        return { referenceKind: ReferenceSiteKind.reference, referenceDocument, definition: nsDefinition, unquotedReferenceSpan, definitionDocument };
                    }
                } else if (tleFuncCall.nameToken) {
                    const unquotedReferenceSpan: Span = tleFuncCall.nameToken.span.translate(this.jsonTokenStartIndex);
                    const referenceKind = ReferenceSiteKind.reference;

                    if (tleFuncCall.nameToken.span.contains(tleCharacterIndex, ContainsBehavior.strict)) {
                        if (tleFuncCall.namespaceToken) {
                            // Inside the name of a user-function reference
                            const ns = tleFuncCall.namespaceToken.stringValue;
                            const name = tleFuncCall.nameToken.stringValue;
                            const nsDefinition = scope.getFunctionNamespaceDefinition(ns);
                            const userFunctiondefinition = scope.getUserFunctionDefinition(ns, name);
                            if (nsDefinition && userFunctiondefinition) {
                                return { referenceKind, referenceDocument, definition: userFunctiondefinition, unquotedReferenceSpan, definitionDocument };
                            }
                        } else {
                            // Inside a reference to a built-in function
                            const functionMetadata: BuiltinFunctionMetadata | undefined = AzureRMAssets.getFunctionMetadataFromName(tleFuncCall.nameToken.stringValue);
                            if (functionMetadata) {
                                return { referenceKind, referenceDocument, definition: functionMetadata, unquotedReferenceSpan, definitionDocument };
                            }
                        }
                    }
                }
            }

            const tleStringValue: TLE.StringValue | undefined = TLE.asStringValue(tleInfo.tleValue);
            if (tleStringValue instanceof TLE.StringValue) {
                const referenceKind = ReferenceSiteKind.reference;

                if (tleStringValue.isParametersArgument()) {
                    // Inside the 'xxx' of a parameters('xxx') reference
                    const parameterDefinition: IParameterDefinition | undefined = scope.getParameterDefinition(tleStringValue.toString());
                    if (parameterDefinition) {
                        const unquotedReferenceSpan: Span = tleStringValue.unquotedSpan.translate(this.jsonTokenStartIndex);
                        return { referenceKind, referenceDocument, definition: parameterDefinition, unquotedReferenceSpan, definitionDocument };
                    }
                } else if (tleStringValue.isVariablesArgument()) {
                    const variableDefinition: IVariableDefinition | undefined = scope.getVariableDefinition(tleStringValue.toString());
                    if (variableDefinition) {
                        // Inside the 'xxx' of a variables('xxx') reference
                        const unquotedReferenceSpan: Span = tleStringValue.unquotedSpan.translate(this.jsonTokenStartIndex);
                        return { referenceKind, referenceDocument, definition: variableDefinition, unquotedReferenceSpan, definitionDocument };
                    }
                }
            }
        }

        if (includeDefinition) {
            const definition = this.getDefinitionAtSite();
            if (definition && definition.nameValue) {
                return {
                    referenceKind: ReferenceSiteKind.definition,
                    definition: definition,
                    referenceDocument: this.document,
                    definitionDocument: this.document,
                    unquotedReferenceSpan: definition.nameValue?.unquotedSpan
                };
            }
        }

        return undefined;
    }

    private isInsideParameterDefinitions(parents: (Json.ObjectValue | Json.ArrayValue | Json.Property)[]): boolean {
        // Is it the top-level "parameters"?
        //
        // { << top level
        //     "parameters": {
        //         << CURSOR HERE
        //     }...
        if (parents[0] instanceof Json.ObjectValue
            && parents[1]?.isPropertyWithName(templateKeys.parameters)
            && parents[2] === this.document.topLevelValue
        ) {
            return true;
        }

        // Is it a nested template's parameters section?
        //
        // "template": {
        //     "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        //     "contentVersion": "1.0.0.0",
        //     "parameters": {
        //         << CURSOR HERE
        //     }...
        // }
        if (parents[0] instanceof Json.ObjectValue
            && parents[1]?.isPropertyWithName(templateKeys.parameters)
            && parents[2] instanceof Json.ObjectValue
            && parents[3]?.isPropertyWithName(templateKeys.nestedDeploymentTemplateProperty)
        ) {
            return true;
        }

        return false;
    }

    private isInsideParameterValues(parents: (Json.ObjectValue | Json.ArrayValue | Json.Property)[]): boolean {
        // Is it a nested template parameters?
        //
        // {
        //     "type": "Microsoft.Resources/deployments",
        //     "properties": {
        //         "parameters": {
        //             << CURSOR HERE
        //         }...
        if (parents[0] instanceof Json.ObjectValue
            && parents[1]?.isPropertyWithName(templateKeys.parameters)
            && parents[2] instanceof Json.ObjectValue
            && parents[3]?.isPropertyWithName(templateKeys.properties)
            && isDeploymentResource(parents[4])
        ) {
            return true;
        }

        return false;
    }

    private isInsideUserFunctionParameterDefinitions(parents: (Json.ObjectValue | Json.ArrayValue | Json.Property)[]): boolean {
        // "functions": [
        // {
        //     "namespace": "namespacename",
        //     "members": { << We end up to this level
        //         "functionname": {
        //             "parameters": [
        //                 {
        //                     << CURSOR HERE
        // (This occurs after the user types "{" inside the "parameters" object)
        if (parents[0] instanceof Json.ObjectValue) {
            // Remove the object from the parents stack and compare like the second scenario
            parents = parents.slice(1);
        }

        // "functions": [
        // {
        //     "namespace": "namespacename",
        //     "members": { << We end up to this level
        //         "functionname": {
        //             "parameters": [
        //                 << CURSOR HERE
        if (parents[0] instanceof Json.ArrayValue
            && parents[1]?.isPropertyWithName(templateKeys.parameters)
            && parents[2] instanceof Json.ObjectValue
            && parents[3] instanceof Json.Property // This is the function name, don't care what that name is
            && parents[4] instanceof Json.ObjectValue
            && parents[5]?.isPropertyWithName(templateKeys.userFunctionMembers)
        ) {
            return true;
        }

        return false;
    }

    private isInsideResourceBody(parents: (Json.ObjectValue | Json.ArrayValue | Json.Property)[]): boolean {
        //     {
        //         "type": "Microsoft.Network/virtualNetworks",
        //         "apiVersion": "2019-11-01",
        //         << CURSOR
        if (parents[0] instanceof Json.ObjectValue
            && parents[0]?.hasProperty(templateKeys.resourceType)
            && parents[0]?.hasProperty(templateKeys.resourceApiVersion)
        ) {
            return true;
        }

        return false;
    }

    public getInsertionContext(options: { triggerCharacter?: string; allowInsideJsonString?: boolean }): InsertionContext {
        const insertionContext = super.getInsertionContext(options);
        const context = insertionContext.context;
        const parents = insertionContext.parents;

        // We need to make some contexts more specific to the template file.  For instance, a 'parameters' object might be
        //   parameter definitions or parameter values or user function parameters, all of which require different contexts.
        if (parents) {
            if (context === 'parameters') {
                if (this.isInsideParameterDefinitions(parents)) {
                    insertionContext.context = KnownContexts.parameterDefinitions;
                } else if (this.isInsideParameterValues(parents)) {
                    insertionContext.context = KnownContexts.parameterValues;
                } else if (this.isInsideUserFunctionParameterDefinitions(parents)) {
                    insertionContext.context = KnownContexts.userFuncParameterDefinitions;
                }
            } else if (
                (options.triggerCharacter === undefined || options.triggerCharacter === '"')
                && this.isInsideResourceBody(parents)
            ) {
                insertionContext.context = KnownContexts.resourceBody;
            }
        }

        return insertionContext;
    }

    public async getCompletionItems(triggerCharacter: string | undefined): Promise<ICompletionItemsResult> {
        const tleInfo = this.tleInfo;
        const completions: Completion.Item[] = [];

        for (let uniqueScope of this.document.uniqueScopes) {
            if (uniqueScope.parameterValuesSource) {
                completions.push(...getPropertyValueCompletionItems(
                    uniqueScope,
                    uniqueScope.parameterValuesSource,
                    this.documentCharacterIndex,
                    triggerCharacter));
            }
        }

        if (!tleInfo) {
            // No JSON string at this location, consider snippet completions
            const snippets = await this.getSnippetCompletionItems(triggerCharacter);
            if (snippets.triggerSuggest) {
                return snippets;
            } else {
                completions.push(...snippets.items);
            }
        } else {
            // The function/string/number/etc at the current position inside the string expression,
            // or else the JSON string itself even it's not an expression
            const tleValue: TLE.Value | undefined = tleInfo.tleValue;
            const scope: TemplateScope = tleInfo.scope;

            if (!tleValue || !tleValue.contains(tleInfo.tleCharacterIndex)) {
                // No TLE value here. For instance, expression is empty, or before/after/on the square brackets
                if (TemplatePositionContext.isInsideSquareBrackets(tleInfo.tleParseResult, tleInfo.tleCharacterIndex)) {
                    // Inside brackets, so complete with all valid functions and namespaces
                    const replaceSpan = this.emptySpanAtDocumentCharacterIndex;
                    const functionCompletions = TemplatePositionContext.getFunctionCompletions(scope, undefined, replaceSpan);
                    const namespaceCompletions = TemplatePositionContext.getNamespaceCompletions(scope, replaceSpan);
                    completions.push(...functionCompletions);
                    completions.push(...namespaceCompletions);
                }
            } else if (tleValue instanceof TLE.FunctionCallValue) {
                assert(this.jsonToken);
                // tslint:disable-next-line:no-non-null-assertion
                completions.push(... this.getFunctionCallCompletions(tleValue, this.jsonToken!, tleInfo.tleCharacterIndex, scope));
            } else if (tleValue instanceof TLE.StringValue) {
                completions.push(...this.getStringLiteralCompletions(tleValue, tleInfo.tleCharacterIndex, scope));
            } else if (tleValue instanceof TLE.PropertyAccess) {
                completions.push(... this.getPropertyAccessCompletions(tleValue, tleInfo.tleCharacterIndex, scope));
            }
        }

        completions.push(...this.getDependsOnCompletionItems(triggerCharacter));

        return { items: completions };
    }

    /**
     * Gets the scope at the current position
     */
    public getScope(): TemplateScope {
        if (this.jsonValue && this.document.topLevelValue) {
            const objectLineage = <(Json.ObjectValue | Json.ArrayValue)[]>this.document.topLevelValue
                ?.findLineage(this.jsonValue)
                ?.filter(v => v instanceof Json.ObjectValue);
            const scopes = this.document.allScopes; // Note: not unique because resources are unique even when scope is not (see CONSIDER in TemplateScope.ts)
            for (const parent of objectLineage.reverse()) {
                const innermostMachingScope = scopes.find(s => s.rootObject === parent);
                if (innermostMachingScope) {
                    return innermostMachingScope;
                }
            }
        }

        return this.document.topLevelScope;
    }

    private getDependsOnCompletionItems(triggerCharacter: string | undefined): Completion.Item[] {
        const insertionContext = this.getInsertionContext({ triggerCharacter, allowInsideJsonString: true });
        if (insertionContext.context === 'dependson') {
            return getDependsOnCompletions(this);
        }

        return [];
    }

    private async getSnippetCompletionItems(triggerCharacter: string | undefined): Promise<ICompletionItemsResult> {
        const insertionContext = this.getInsertionContext({ triggerCharacter });
        if (insertionContext.triggerSuggest) {
            return { items: [], triggerSuggest: true };
        } else if (insertionContext.context) {
            // Show snippets that match the snippet context at this location
            let replacementInfo = this.getCompletionReplacementSpanInfo();
            const snippets = await ext.snippetManager.value.getSnippetsAsCompletionItems(insertionContext, replacementInfo.span ?? this.emptySpanAtDocumentCharacterIndex);
            return { items: snippets };
        }

        return { items: [] };
    }

    /**
     * Given position in expression is past the left square bracket and before the right square bracket,
     * *or* there is no square bracket yet
     */
    private static isInsideSquareBrackets(parseResult: TLE.TleParseResult, characterIndex: number): boolean {
        const leftSquareBracketToken: TLE.Token | undefined = parseResult.leftSquareBracketToken;
        const rightSquareBracketToken: TLE.Token | undefined = parseResult.rightSquareBracketToken;

        if (leftSquareBracketToken && leftSquareBracketToken.span.afterEndIndex <= characterIndex &&
            (!rightSquareBracketToken || characterIndex <= rightSquareBracketToken.span.startIndex)) {
            return true;
        }

        return false;
    }

    /**
     * Get completions when we're anywhere inside a string literal
     */
    private getStringLiteralCompletions(tleStringValue: TLE.StringValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        if (tleStringValue.isParametersArgument()) {
            // The string is a parameter name inside a parameters('xxx') function
            return this.getParameterCompletions(tleStringValue, tleCharacterIndex, scope);
        } else if (tleStringValue.isVariablesArgument()) {
            // The string is a variable name inside a variables('xxx') function
            return this.getVariableCompletions(tleStringValue, tleCharacterIndex, scope);
        }

        const funcCall = tleStringValue.getFunctionCallParentOfArgument();
        if (funcCall) {
            assert(this.jsonToken && this.jsonToken.type === Json.TokenType.QuotedString);
            // tslint:disable-next-line: no-non-null-assertion
            const jsonParentStringToken = this.jsonToken!;
            // It might be a resourceId/etc completion
            return getResourceIdCompletions(
                this,
                funcCall,
                jsonParentStringToken
            );
        }

        return [];
    }

    /**
     * Get completions when we're anywhere inside a property access, e.g. "resourceGroup().prop1.prop2"
     */
    private getPropertyAccessCompletions(tleValue: TLE.PropertyAccess, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        const functionSource: TLE.FunctionCallValue | undefined = tleValue.functionSource;

        // Property accesses always start with a function call (might be 'variables'/'parameters')
        if (functionSource) {
            let propertyPrefix: string = "";
            let replaceSpan: Span = this.emptySpanAtDocumentCharacterIndex;
            const propertyNameToken: TLE.Token | undefined = tleValue.nameToken;
            if (propertyNameToken) {
                replaceSpan = propertyNameToken.span.translate(this.jsonTokenStartIndex);
                propertyPrefix = propertyNameToken.stringValue.substring(0, tleCharacterIndex - propertyNameToken.span.startIndex).toLowerCase();
            }

            const variableProperty: IVariableDefinition | undefined = scope.getVariableDefinitionFromFunctionCall(functionSource);
            const parameterProperty: IParameterDefinition | undefined = scope.getParameterDefinitionFromFunctionCall(functionSource);
            const sourcesNameStack: string[] = tleValue.sourcesNameStack;
            if (variableProperty) {
                // [variables('xxx').prop]

                // Is the variable's value is an object?
                const sourceVariableDefinition: Json.ObjectValue | undefined = Json.asObjectValue(variableProperty.value);
                if (sourceVariableDefinition) {
                    return this.getDeepPropertyAccessCompletions(
                        propertyPrefix,
                        sourceVariableDefinition,
                        sourcesNameStack,
                        replaceSpan);
                }
            } else if (parameterProperty) {
                // [parameters('xxx').prop]

                // Is the parameters's default valuean object?
                const parameterDefValue: Json.ObjectValue | undefined = parameterProperty.defaultValue ? Json.asObjectValue(parameterProperty.defaultValue) : undefined;
                if (parameterDefValue) {
                    const sourcePropertyDefinition: Json.ObjectValue | undefined = Json.asObjectValue(parameterDefValue.getPropertyValueFromStack(sourcesNameStack));
                    if (sourcePropertyDefinition) {
                        return this.getDeepPropertyAccessCompletions(
                            propertyPrefix,
                            sourcePropertyDefinition,
                            sourcesNameStack,
                            replaceSpan);
                    }
                }
            } else if (sourcesNameStack.length === 0) {
                // [function(...).prop]

                // We don't allow multiple levels of property access
                // (resourceGroup().prop1.prop2) on functions other than variables/parameters,
                // therefore checking that sourcesNameStack.length === 0
                const functionName: string | undefined = functionSource.name;

                // Don't currently support completions from a user function returning an object,
                // so there must be no function namespace
                if (functionName && !functionSource.namespaceToken) {
                    let functionMetadata: BuiltinFunctionMetadata | undefined = AzureRMAssets.getFunctionMetadataFromName(functionName);
                    if (functionMetadata) {
                        // Property completion off of a built-in function. Completions will consist of the
                        //   returnValueMembers of the function, if any.
                        const result: Completion.Item[] = [];
                        for (const returnValueMember of functionMetadata.returnValueMembers) {
                            if (propertyPrefix === "" || returnValueMember.toLowerCase().startsWith(propertyPrefix)) {
                                result.push(TemplatePositionContext.createPropertyCompletionItem(returnValueMember, replaceSpan));
                            }
                        }

                        return result;
                    }
                }
            }
        }

        return [];
    }

    /**
     * Return completions when we're anywhere inside a function call expression
     */
    // tslint:disable-next-line: max-func-body-length cyclomatic-complexity // Pretty straightforward, don't think further refactoring is important
    private getFunctionCallCompletions(tleValue: TLE.FunctionCallValue, parentStringToken: Json.Token, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        assert(tleValue.getSpan().contains(tleCharacterIndex, ContainsBehavior.extended), "Position should be inside the function call, or right after it");

        const completions: Completion.Item[] = [];

        const namespaceName: string | undefined = tleValue.namespaceToken ? tleValue.namespaceToken.stringValue : undefined;
        // tslint:disable-next-line: strict-boolean-expressions
        const namespace: UserFunctionNamespaceDefinition | undefined = (namespaceName && scope.getFunctionNamespaceDefinition(namespaceName)) || undefined;

        // The token (namespace or name) that the user is completing and will be replaced with the user's selection
        // If undefined, we're just inserting at the current position, not replacing anything
        let tleTokenToComplete: TLE.Token | undefined;

        let completeNamespaces: boolean;
        let completeBuiltinFunctions: boolean;
        let completeUserFunctions: boolean;

        if (tleValue.nameToken && tleValue.nameToken.span.contains(tleCharacterIndex, ContainsBehavior.extended)) {
            // The caret is inside the function's name (or a namespace before the period has been typed), so one of
            // three possibilities.
            tleTokenToComplete = tleValue.nameToken;

            if (namespace) {
                // 1) "namespace.func<CURSOR>tion"
                //   Complete only UDF functions
                completeUserFunctions = true;
                completeNamespaces = false;
                completeBuiltinFunctions = false;
            } else {
                // 2) "name<CURSOR>space"
                // 3) "func<CURSOR>tion"
                //   Complete built-ins and namespaces
                completeNamespaces = true;
                completeBuiltinFunctions = true;
                completeUserFunctions = false;
            }
        } else if (namespaceName && tleValue.periodToken && tleValue.periodToken.span.afterEndIndex === tleCharacterIndex) {
            // "namespace.<CURSOR>function"
            //   The caret is right after the period between a namespace and a function name, so we will be looking for UDF function completions

            if (!namespace) {
                // The given namespace is not defined, so no completions
                return [];
            }

            tleTokenToComplete = tleValue.nameToken;
            completeNamespaces = false;
            completeBuiltinFunctions = false;
            completeUserFunctions = true;
        } else if (tleValue.namespaceToken && tleValue.periodToken && tleValue.namespaceToken.span.contains(tleCharacterIndex, ContainsBehavior.extended)) {
            // "name<CURSOR>space.function"
            //   The caret is inside the UDF's namespace (e.g., the namespace and at least a period already exist in the call).
            //
            // So we want built-in functions or namespaces only

            tleTokenToComplete = tleValue.namespaceToken;
            completeNamespaces = true;
            completeBuiltinFunctions = true;
            completeUserFunctions = false;

        } else if (tleValue.isCallToBuiltinWithName(templateKeys.parameters) && tleValue.argumentExpressions.length === 0) {
            // "parameters<CURSOR>" or "parameters(<CURSOR>)" or similar
            // Don't bother bringing up any other completions
            return this.getParameterCompletions(tleValue, tleCharacterIndex, scope);
        } else if (tleValue.isCallToBuiltinWithName(templateKeys.variables) && tleValue.argumentExpressions.length === 0) {
            // "variables<CURSOR>" or "variables(<CURSOR>)" or similar
            // Don't bother bringing up any other completions
            return this.getVariableCompletions(tleValue, tleCharacterIndex, scope);
        } else {
            // Anywhere else (e.g. whitespace after function name, or inside the arguments list).
            //
            //   "function <CURSOR>()"
            //   "function(<CURSOR>)"
            //   etc.
            //
            // Assume the user is starting a new function call and provide all completions at that location;

            tleTokenToComplete = undefined;
            completeNamespaces = true;
            completeBuiltinFunctions = true;
            completeUserFunctions = false;
        }

        let replaceSpan: Span;

        // Figure out the span which will be replaced by the completion
        if (tleTokenToComplete) {
            const tokenToCompleteStartIndex: number = tleTokenToComplete.span.startIndex;
            const completionLength = tleCharacterIndex - tokenToCompleteStartIndex;
            assert(completionLength >= 0);
            replaceSpan = new Span(this.jsonTokenStartIndex, completionLength).translate(tleTokenToComplete.span.startIndex);
        } else {
            // Nothing getting completed, completion selection will be inserted at current location
            replaceSpan = this.emptySpanAtDocumentCharacterIndex;
        }

        assert(completeBuiltinFunctions || completeUserFunctions || completeNamespaces, "Should be completing something");
        if (completeBuiltinFunctions || completeUserFunctions) {
            if (completeUserFunctions && namespace) {
                const userFunctionCompletions = TemplatePositionContext.getFunctionCompletions(scope, namespace, replaceSpan);
                completions.push(...userFunctionCompletions);
            }
            if (completeBuiltinFunctions) {
                const builtinCompletions = TemplatePositionContext.getFunctionCompletions(scope, undefined, replaceSpan);
                completions.push(...builtinCompletions);
            }
        }
        if (completeNamespaces) {
            const namespaceCompletions = TemplatePositionContext.getNamespaceCompletions(scope, replaceSpan);
            completions.push(...namespaceCompletions);
        }

        // If the completion is for 'resourceId' or related function, then in addition
        // to the regular completions, also add special completions for resourceId
        completions.push(...getResourceIdCompletions(this, tleValue, parentStringToken));

        return completions;
    }

    private getDeepPropertyAccessCompletions(propertyPrefix: string, variableOrParameterDefinition: Json.ObjectValue, sourcesNameStack: string[], replaceSpan: Span): Completion.Item[] {
        const result: Completion.Item[] = [];

        const sourcePropertyDefinitionObject: Json.ObjectValue | undefined = Json.asObjectValue(variableOrParameterDefinition.getPropertyValueFromStack(sourcesNameStack));
        if (sourcePropertyDefinitionObject) {
            let matchingPropertyNames: string[];
            if (!propertyPrefix) {
                matchingPropertyNames = sourcePropertyDefinitionObject.propertyNames;
            } else {
                // We need to ignore casing when creating completions
                const propertyPrefixLC = propertyPrefix.toLowerCase();

                matchingPropertyNames = [];
                for (const propertyName of sourcePropertyDefinitionObject.propertyNames) {
                    if (propertyName.toLowerCase().startsWith(propertyPrefixLC)) {
                        matchingPropertyNames.push(propertyName);
                    }
                }
            }

            for (const matchingPropertyName of matchingPropertyNames) {
                result.push(TemplatePositionContext.createPropertyCompletionItem(matchingPropertyName, replaceSpan));
            }
        }

        return result;
    }

    private static createPropertyCompletionItem(propertyName: string, replaceSpan: Span): Completion.Item {
        return Completion.Item.fromPropertyName(propertyName, replaceSpan);
    }

    /**
     * Return all references to the given reference site info in this document
     * @returns undefined if references are not supported at this location, or empty list if supported but none found
     */
    protected getReferencesCore(): ReferenceList | undefined {
        const tleInfo = this.tleInfo;
        if (tleInfo) { // If we're inside a string (whether an expression or not)
            const refInfo = this.getReferenceSiteInfo(true);
            if (refInfo) {
                return this.document.findReferencesToDefinition(refInfo.definition);
            }
        }

        return undefined;
    }

    /**
     * Returns the definition at the current position, if the current position represents
     * a definition.
     */
    private getDefinitionAtSite(): INamedDefinition | undefined {
        const tleInfo = this.tleInfo;
        if (tleInfo) {
            const jsonStringValue: Json.StringValue | undefined = Json.asStringValue(this.jsonValue);
            if (jsonStringValue) {
                const unquotedString = jsonStringValue.unquotedValue;
                const scope = tleInfo.scope;

                // Is it a parameter definition?
                const parameterDefinition: IParameterDefinition | undefined = scope.getParameterDefinition(unquotedString);
                if (parameterDefinition && parameterDefinition.nameValue === jsonStringValue) {
                    return parameterDefinition;
                }

                // Is it a variable definition?
                const variableDefinition: IVariableDefinition | undefined = scope.getVariableDefinition(unquotedString);
                if (variableDefinition && variableDefinition.nameValue === jsonStringValue) {
                    return variableDefinition;
                }

                // Is it a user namespace definition?
                const namespaceDefinition: UserFunctionNamespaceDefinition | undefined = scope.getFunctionNamespaceDefinition(unquotedString);
                if (namespaceDefinition && namespaceDefinition.nameValue === jsonStringValue) {
                    return namespaceDefinition;
                }

                // Is it a user function definition inside any namespace?
                for (let ns of scope.namespaceDefinitions) {
                    const userFunctionDefinition: UserFunctionDefinition | undefined = scope.getUserFunctionDefinition(ns.nameValue.unquotedValue, unquotedString);
                    if (userFunctionDefinition && userFunctionDefinition.nameValue === jsonStringValue) {
                        return userFunctionDefinition;
                    }
                }
            }
        }
    }

    public getSignatureHelp(): TLE.FunctionSignatureHelp | undefined {
        const tleValue: TLE.Value | undefined = this.tleInfo && this.tleInfo.tleValue;
        if (this.tleInfo && tleValue) {
            let functionToHelpWith: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(tleValue);
            if (!functionToHelpWith) {
                functionToHelpWith = TLE.asFunctionCallValue(tleValue.parent);
            }

            if (functionToHelpWith && functionToHelpWith.name) {
                let functionMetadata: IFunctionMetadata | undefined;

                if (functionToHelpWith.namespaceToken) {
                    // Call to user-defined function
                    const namespace: string = functionToHelpWith.namespaceToken.stringValue;
                    const name: string | undefined = functionToHelpWith.name;
                    const udfDefinition: UserFunctionDefinition | undefined = this.tleInfo.scope.getUserFunctionDefinition(namespace, name);
                    functionMetadata = udfDefinition ? UserFunctionMetadata.fromDefinition(udfDefinition) : undefined;
                } else {
                    // Call to built-in function
                    functionMetadata = AzureRMAssets.getFunctionMetadataFromName(functionToHelpWith.name);
                }
                if (functionMetadata) {
                    let currentArgumentIndex = this.getFunctionCallArgumentIndex();
                    if (typeof currentArgumentIndex === 'number') {
                        const functionMetadataParameters: IFunctionParameterMetadata[] = functionMetadata.parameters;
                        if (functionMetadataParameters.length > 0 &&
                            functionMetadataParameters.length <= currentArgumentIndex &&
                            functionMetadataParameters[functionMetadataParameters.length - 1].name.endsWith("...")) {

                            currentArgumentIndex = functionMetadataParameters.length - 1;
                        }

                        return new TLE.FunctionSignatureHelp(currentArgumentIndex, functionMetadata);
                    }
                }
            }
        }

        return undefined;
    }

    /**
     * Get the index (0-based) of the argument in the given function call, at the current position.
     * Returns -1 if the position is inside the function call, but not inside any of the parameters
     */
    public getFunctionCallArgumentIndex(functionCall?: TLE.FunctionCallValue): number | undefined {
        const tleInfo = this.tleInfo;
        const tleValue: TLE.Value | undefined = tleInfo?.tleValue;
        if (tleInfo && tleValue) {
            if (!functionCall) {
                functionCall = TLE.asFunctionCallValue(tleValue);
                if (!functionCall) {
                    functionCall = TLE.asFunctionCallValue(tleValue.parent);
                }
            }

            if (functionCall) {
                if (!functionCall.leftParenthesisToken || tleInfo.tleCharacterIndex <= functionCall.leftParenthesisToken?.span.endIndex) {
                    return -1;
                }

                let currentArgumentIndex: number = 0;

                for (const commaToken of functionCall.commaTokens) {
                    if (commaToken.span.startIndex < tleInfo.tleCharacterIndex) {
                        ++currentArgumentIndex;
                    }
                }

                return currentArgumentIndex;
            }
        }

        return undefined;
    }

    /**
     * Return a list of completions for all functions for a given namespace (return built-in function completions if namespace
     * is undefined).
     */
    private static getFunctionCompletions(scope: TemplateScope, namespace: UserFunctionNamespaceDefinition | undefined, replaceSpan: Span): Completion.Item[] {
        let matches: IFunctionMetadata[];
        if (namespace) {
            // User-defined functions
            matches = namespace.members.map(fd => UserFunctionMetadata.fromDefinition(fd));
        } else {
            // Built-in functions
            matches = AzureRMAssets.getFunctionsMetadata().functionMetadata;
        }

        return matches.map(m => Completion.Item.fromFunctionMetadata(m, replaceSpan));
    }

    /**
     * Return a list of completions for all user-defined namespaces
     */
    private static getNamespaceCompletions(scope: TemplateScope, replaceSpan: Span): Completion.Item[] {
        return scope.namespaceDefinitions.map(m => Completion.Item.fromNamespaceDefinition(m, replaceSpan));
    }

    // Gets "parameters" argument completions for all parameters available for the given scope
    //
    // tleValue is StringValue:        parameters('xx<CURSOR>yy')  - tleValue is the string literal
    // tleValue is FunctionCallValue:  parameters(<CURSOR>)        - tleValue is the parameters call
    //
    private getParameterCompletions(tleValue: TLE.StringValue | TLE.FunctionCallValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        const replaceSpanInfo: ITleReplaceSpanInfo | undefined = this.getParameterOrVariableNameReplaceInfo(tleValue, tleCharacterIndex);

        const parameterCompletions: Completion.Item[] = [];
        if (replaceSpanInfo) {
            for (const parameterDefinition of scope.parameterDefinitions) {
                parameterCompletions.push(Completion.Item.fromParameterDefinition(parameterDefinition, replaceSpanInfo.replaceSpan, replaceSpanInfo.includeRightParenthesisInCompletion, replaceSpanInfo.includeSingleQuotesInCompletion));
            }
        }

        return parameterCompletions;
    }

    // Gets "variables" argument completions for all variables available for the given scope
    //
    // tleValue is StringValue:        variables('xx<CURSOR>yy')  - tleValue is the string literal
    // tleValue is FunctionCallValue:  variables(<CURSOR>)        - tleValue is the variables call
    //
    private getVariableCompletions(tleValue: TLE.StringValue | TLE.FunctionCallValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        const replaceSpanInfo: ITleReplaceSpanInfo | undefined = this.getParameterOrVariableNameReplaceInfo(tleValue, tleCharacterIndex);

        const variableCompletions: Completion.Item[] = [];
        if (replaceSpanInfo) {
            for (const variableDefinition of scope.variableDefinitions) {
                variableCompletions.push(Completion.Item.fromVariableDefinition(variableDefinition, replaceSpanInfo.replaceSpan, replaceSpanInfo.includeRightParenthesisInCompletion, replaceSpanInfo.includeSingleQuotesInCompletion));
            }
        }

        return variableCompletions;
    }

    // tslint:disable-next-line: max-func-body-length // lots of comments
    private getParameterOrVariableNameReplaceInfo(tleValue: TLE.StringValue | TLE.FunctionCallValue, tleCharacterIndex: number): ITleReplaceSpanInfo | undefined {
        // Note: We icnclude closing parenthesis and single quote in the replacement span and the insertion text,
        // so that the cursor ends up after them once the replacement happens. This way the user can immediately start
        // typing the rest of the expression after the parameters call.

        // Also note that, unlike with function name replacements, we replace the entire string argument if the cursor is anywhere inside
        // the existing string, not just the part of it before the cursor.

        let includeSingleQuotesInCompletion: boolean;
        let includeRightParenthesisInCompletion: boolean;
        let replaceSpan: Span;

        if (tleValue instanceof TLE.StringValue) {
            // parameters(<CURSOR> 'xxyy') or parameters('xx<CURSOR>yy')  - tleValue is the string literal

            const stringSpan: Span = tleValue.getSpan();
            const functionValue: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(tleValue.parent);
            const stringStartIndex = stringSpan.startIndex;
            let tleReplaceSpan: Span;

            if (tleCharacterIndex <= stringStartIndex) {
                // The cursor is before the beginning of the string (or right at the open quote, which means it's not yet
                //   inside the string) - just insert the completion text, don't replace anything existing (the user may be
                //   trying to add to the expression before the cursor if this is an existing expression or string)
                //
                // Example:  "['Microsoft.web/sites']" -> "[concat(parameters(<CURSOR>'Microsoft.web/sites']"
                // Desired replacement should *not* be to replace 'Microsoft.web/sites' with the parameter name, but rather to
                //   insert it: "[concat(parameters('parameter1''Microsoft.web/sites']"
                ///  ... because the user intends to keep typing to finish the expression
                //   this way: "[concat(parameters('parameter1'), 'Microsoft.web/sites')]"

                tleReplaceSpan = new Span(tleCharacterIndex, 0);
                includeSingleQuotesInCompletion = true;
                includeRightParenthesisInCompletion = false;
            } else if (tleCharacterIndex > tleValue.getSpan().endIndex) {
                // Cursor is after the string - no replacements
                return undefined;
            } else if (tleCharacterIndex - stringStartIndex === 1 && tleValue.unquotedValue.startsWith(`''`)) {
                // Special case - image user has
                //
                //   "[resourceId(<CURSOR>'Microsoft.Network/virtualNetworks', parameters('subnet2Name'))]"
                //
                // At the cursor they want to add "parameters('sku')" as a new first argument to resourceId, without
                // deleting the existing 'Microsoft.Network/virtualNetworks' string, which will become the second argument
                // after inserting.
                //
                // They type "parameters('" (note the initial single quote).  VS Code immediately adds the closing single
                // quote, so they have:
                //
                //   "[resourceId('<CURSOR>''Microsoft.Network/virtualNetworks', parameters('subnet2Name'))]"
                //
                // when the completion request comes through here.  Since two single quotes inside a string are an escape
                // for a single quote, the entire "'''Microsoft.Network/virtualNetworks'" string is tokenized as a single
                // string literal, which means we would normally replace the entire string.  Instead, special case this as
                // if it were two strings and only replace the first two single quotes, leaving the existing string alone.

                tleReplaceSpan = new Span(stringStartIndex, 2);
                includeSingleQuotesInCompletion = true;
                includeRightParenthesisInCompletion = false;
            } else {
                // The cursor is inside the string - replace the entire parameter, including the closing single
                //   quote and parenthesis, so that the cursor will end up after the parameters call

                includeSingleQuotesInCompletion = true;

                // If the string is not properly closed with an ending single quote, the parser may pick up the
                // closing parenthesis and bracket in the string.  It's very unlikely these were meant to be part of
                // a parameter/variable name, so cut off our replacement at this point, in order to prevent data in
                // the string that the user probably wants to keep around after making the completion.
                // This can happen for instance if they're turning an existing string into an expression or adding
                // to the front of an existing expression.
                //
                // Example:   "[concat(parameters('p1<CURSOR>)Microsoft.web/sites']"
                const rightParenthesisIndex: number = tleValue.toString().indexOf(")");
                const rightSquareBracketIndex: number = tleValue.toString().indexOf("]");
                if (rightParenthesisIndex >= 0) {
                    // Cut off before the ending parenthesis
                    tleReplaceSpan = new Span(stringStartIndex, rightParenthesisIndex + 1);
                    includeRightParenthesisInCompletion = true;
                } else if (rightSquareBracketIndex >= 0) {
                    // Cut off before the ending square bracket
                    tleReplaceSpan = new Span(stringStartIndex, rightSquareBracketIndex);
                    includeRightParenthesisInCompletion = true;
                } else if (functionValue && functionValue.rightParenthesisToken && functionValue.argumentExpressions.length === 1) {
                    // The parameters or variables function includes a right parenthesis already

                    tleReplaceSpan = new Span(stringStartIndex, functionValue.rightParenthesisToken.span.afterEndIndex - stringStartIndex);
                    includeRightParenthesisInCompletion = true;
                } else {
                    // The parameters or variables function call does not yet include a right parenthesis, just replace the string

                    includeRightParenthesisInCompletion = !!functionValue && functionValue.argumentExpressions.length <= 1;
                    tleReplaceSpan = stringSpan;
                }
            }

            replaceSpan = tleReplaceSpan.translate(this.jsonTokenStartIndex);
        } else {
            // parameters(<CURSOR>)        - tleValue is the parameters/variables call

            includeSingleQuotesInCompletion = true;

            if (tleValue.rightParenthesisToken) {
                replaceSpan = new Span(
                    this.documentCharacterIndex,
                    tleValue.rightParenthesisToken.span.startIndex - tleCharacterIndex + 1);
                includeRightParenthesisInCompletion = true;
            } else {
                replaceSpan = this.emptySpanAtDocumentCharacterIndex;
                includeRightParenthesisInCompletion = true;
            }
        }

        if (includeRightParenthesisInCompletion) {
            assert(includeSingleQuotesInCompletion, "includeSingleQuotesInCompletion required if includeRightParenthesisInCompletion");
        }

        return {
            includeRightParenthesisInCompletion,
            replaceSpan: replaceSpan,
            includeSingleQuotesInCompletion
        };
    }
}

interface ITleReplaceSpanInfo {
    /** If true, the completion should add single quotes around the completion (for a parameter or variable name). If single
     * quotes already exist, they should be included in the replace span.
     */
    includeSingleQuotesInCompletion: boolean;
    /** If true, the completion should add a closing parenthesis to the completion (if an existing closing
     * parenthesis exists, it should be included in the replacement span, which will have the effect of moving the
     * cursor to after the closing parenthesis upon completion)
     */
    includeRightParenthesisInCompletion: boolean;
    /**
     * Replacement span to use for completions
     */
    replaceSpan: Span;
}

interface ITleInfo {
    /**
     * The parse result of the enclosing string, if we're inside a string (it's with an expression or not)
     */
    tleParseResult: TLE.TleParseResult;

    /**
     * The index inside the enclosing string, if we're inside a string (whether it's an expression or not)
     */
    tleCharacterIndex: number;

    /**
     * The outermost TLE value enclosing the current position, if we're inside a string
     * (whether it's an expression or not). This can undefined if inside square brackets but before
     * an expression, etc.
     */
    tleValue: TLE.Value | undefined;
}
