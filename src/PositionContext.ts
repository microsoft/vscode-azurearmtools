// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-line-length

import { Language } from "../extension.bundle";
import { AzureRMAssets, BuiltinFunctionMetadata } from "./AzureRMAssets";
import { CachedValue } from "./CachedValue";
import * as Completion from "./Completion";
import { templateKeys } from "./constants";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { assert } from './fixed_assert';
import { IFunctionMetadata, IFunctionParameterMetadata } from "./IFunctionMetadata";
import { INamedDefinition } from "./INamedDefinition";
import { IParameterDefinition } from "./IParameterDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import { DocumentPositionContext } from "./parameterFiles/DocumentPositionContext";
import * as Reference from "./ReferenceList";
import { TemplateScope } from "./TemplateScope";
import * as TLE from "./TLE";
import { UserFunctionDefinition } from "./UserFunctionDefinition";
import { UserFunctionMetadata } from "./UserFunctionMetadata";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { IVariableDefinition } from "./VariableDefinition";

/**
 * Information about the TLE expression (if position is at an expression string)
 */
class TleInfo implements ITleInfo {
    public constructor(
        public readonly tleParseResult: TLE.ParseResult,
        public readonly tleCharacterIndex: number,
        public readonly tleValue: TLE.Value | undefined,
        public readonly scope: TemplateScope
    ) {
    }
}

/**
 * Information about a reference site (function call, parameter reference, etc.)
 */
export interface IReferenceSite {
    /**
     * Where the reference occurs in the template
     */
    referenceSpan: Language.Span;

    /**
     * The definition that the reference refers to
     */
    definition: INamedDefinition;
}

// tslint:disable-next-line:no-suspicious-comment
// TODO: Rename to DeploymentTemplatePositionContext
/**
 * Represents a position inside the snapshot of a deployment template, plus all related information
 * that can be parsed and analyzed about it
 */
export class PositionContext extends DocumentPositionContext {
    private _tleInfo: CachedValue<TleInfo | undefined> = new CachedValue<TleInfo | undefined>();

    public static fromDocumentLineAndColumnIndexes(deploymentTemplate: DeploymentTemplate, documentLineIndex: number, documentColumnIndex: number): PositionContext {
        let context = new PositionContext(deploymentTemplate);
        context.initFromDocumentLineAndColumnIndices(documentLineIndex, documentColumnIndex);
        return context;
    }

    public static fromDocumentCharacterIndex(deploymentTemplate: DeploymentTemplate, documentCharacterIndex: number): PositionContext {
        let context = new PositionContext(deploymentTemplate);
        context.initFromDocumentCharacterIndex(documentCharacterIndex);
        return context;
    }

    public get document(): DeploymentTemplate {
        return <DeploymentTemplate>this._document;
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
                const tleValue = tleParseResult.getValueAtCharacterIndex(tleCharacterIndex);
                return new TleInfo(tleParseResult, tleCharacterIndex, tleValue, tleParseResult.scope);
            }
            return undefined;
        });
    }

    /**
     * If this position is inside an expression, inside a reference to an interesting function/parameter/etc, then
     * return an object with information about this reference and the corresponding definition
     */
    public getReferenceSiteInfo(): IReferenceSite | undefined {
        const tleInfo = this.tleInfo;
        if (tleInfo) {
            const scope = tleInfo.scope;
            const tleCharacterIndex = tleInfo.tleCharacterIndex;

            const tleFuncCall: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(tleInfo.tleValue);
            if (tleFuncCall) {
                if (tleFuncCall.namespaceToken && tleFuncCall.namespaceToken.span.contains(tleCharacterIndex, language.Contains.strict)) {
                    // Inside the namespace of a user-function reference
                    const ns = tleFuncCall.namespaceToken.stringValue;
                    const nsDefinition = scope.getFunctionNamespaceDefinition(ns);
                    if (nsDefinition) {
                        const referenceSpan: language.Span = tleFuncCall.namespaceToken.span.translate(this.jsonTokenStartIndex);
                        return { definition: nsDefinition, referenceSpan };
                    }
                } else if (tleFuncCall.nameToken && tleFuncCall.nameToken.span.contains(tleCharacterIndex, language.Contains.strict)) {
                    if (tleFuncCall.namespaceToken) {
                        // Inside the name of a user-function reference
                        const ns = tleFuncCall.namespaceToken.stringValue;
                        const name = tleFuncCall.nameToken.stringValue;
                        const nsDefinition = scope.getFunctionNamespaceDefinition(ns);
                        const userFunctiondefinition = scope.getUserFunctionDefinition(ns, name);
                        if (nsDefinition && userFunctiondefinition) {
                            const referenceSpan: language.Span = tleFuncCall.nameToken.span.translate(this.jsonTokenStartIndex);
                            return { definition: userFunctiondefinition, referenceSpan };
                        }
                    } else {
                        // Inside a reference to a built-in function
                        const functionMetadata: BuiltinFunctionMetadata | undefined = AzureRMAssets.getFunctionMetadataFromName(tleFuncCall.nameToken.stringValue);
                        if (functionMetadata) {
                            const referenceSpan: language.Span = tleFuncCall.nameToken.span.translate(this.jsonTokenStartIndex);
                            return { definition: functionMetadata, referenceSpan };
                        }
                    }
                }
            }

            const tleStringValue: TLE.StringValue | undefined = TLE.asStringValue(tleInfo.tleValue);
            if (tleStringValue instanceof TLE.StringValue) {
                if (tleStringValue.isParametersArgument()) {
                    // Inside the 'xxx' of a parameters('xxx') reference
                    const parameterDefinition: IParameterDefinition | undefined = scope.getParameterDefinition(tleStringValue.toString());
                    if (parameterDefinition) {
                        const referenceSpan: language.Span = tleStringValue.getSpan().translate(this.jsonTokenStartIndex);
                        return { definition: parameterDefinition, referenceSpan };
                    }
                } else if (tleStringValue.isVariablesArgument()) {
                    const variableDefinition: IVariableDefinition | undefined = scope.getVariableDefinition(tleStringValue.toString());
                    if (variableDefinition) {
                        // Inside the 'xxx' of a variables('xxx') reference
                        const referenceSpan: language.Span = tleStringValue.getSpan().translate(this.jsonTokenStartIndex);
                        return { definition: variableDefinition, referenceSpan };
                    }
                }
            }
        }

        return undefined;
    }

    /**
     * Get completion items for our position in the document
     */
    public getCompletionItems(): Completion.Item[] {
        const tleInfo = this.tleInfo;
        if (!tleInfo) {
            // No string at this position
            return [];
        }

        // We're inside a JSON string. It may or may not contain square brackets.

        // The function/string/number/etc at the current position inside the string expression,
        // or else the JSON string itself even it's not an expression
        const tleValue: TLE.Value | undefined = tleInfo.tleValue;
        const scope: TemplateScope = tleInfo.scope;

        if (!tleValue || !tleValue.contains(tleInfo.tleCharacterIndex)) {
            // No TLE value here. For instance, expression is empty, or before/after/on the square brackets
            if (PositionContext.isInsideSquareBrackets(tleInfo.tleParseResult, tleInfo.tleCharacterIndex)) {
                // Inside brackets, so complete with all valid functions and namespaces
                const replaceSpan = this.emptySpanAtDocumentCharacterIndex;
                const functionCompletions = PositionContext.getMatchingFunctionCompletions(scope, undefined, "", replaceSpan);
                const namespaceCompletions = PositionContext.getMatchingNamespaceCompletions(scope, "", replaceSpan);
                return functionCompletions.concat(namespaceCompletions);
            } else {
                return [];
            }

        } else if (tleValue instanceof TLE.FunctionCallValue) {
            return this.getFunctionCallCompletions(tleValue, tleInfo.tleCharacterIndex, scope);
        } else if (tleValue instanceof TLE.StringValue) {
            return this.getStringLiteralCompletions(tleValue, tleInfo.tleCharacterIndex, scope);
        } else if (tleValue instanceof TLE.PropertyAccess) {
            return this.getPropertyAccessCompletions(tleValue, tleInfo.tleCharacterIndex, scope);
        }

        return [];
    }

    /**
     * Given position in expression is past the left square bracket and before the right square bracket,
     * *or* there is no square bracket yet
     */
    private static isInsideSquareBrackets(parseResult: TLE.ParseResult, characterIndex: number): boolean {
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
    private getStringLiteralCompletions(tleValue: TLE.StringValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        // Start at index 1 to skip past the opening single-quote.
        const prefix: string = tleValue.toString().substring(1, tleCharacterIndex - tleValue.getSpan().startIndex);

        if (tleValue.isParametersArgument()) {
            // The string is a parameter name inside a parameters('xxx') function
            return this.getMatchingParameterCompletions(prefix, tleValue, tleCharacterIndex, scope);
        } else if (tleValue.isVariablesArgument()) {
            // The string is a variable name inside a variables('xxx') function
            return this.getMatchingVariableCompletions(prefix, tleValue, tleCharacterIndex, scope);
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
            let replaceSpan: language.Span = this.emptySpanAtDocumentCharacterIndex;
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
                                result.push(PositionContext.createPropertyCompletionItem(returnValueMember, replaceSpan));
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
    private getFunctionCallCompletions(tleValue: TLE.FunctionCallValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        assert(tleValue.getSpan().contains(tleCharacterIndex, language.Contains.extended), "Position should be inside the function call, or right after it");

        const namespaceName: string | undefined = tleValue.namespaceToken ? tleValue.namespaceToken.stringValue : undefined;
        // tslint:disable-next-line: strict-boolean-expressions
        const namespace: UserFunctionNamespaceDefinition | undefined = (namespaceName && scope.getFunctionNamespaceDefinition(namespaceName)) || undefined;

        // The token (namespace or name) that the user is completing and will be replaced with the user's selection
        // If undefined, we're just inserting at the current position, not replacing anything
        let tleTokenToComplete: TLE.Token | undefined;

        let completeNamespaces: boolean;
        let completeBuiltinFunctions: boolean;
        let completeUserFunctions: boolean;

        if (tleValue.nameToken && tleValue.nameToken.span.contains(tleCharacterIndex, language.Contains.extended)) {
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
        } else if (tleValue.namespaceToken && tleValue.periodToken && tleValue.namespaceToken.span.contains(tleCharacterIndex, language.Contains.extended)) {
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
            return this.getMatchingParameterCompletions("", tleValue, tleCharacterIndex, scope);
        } else if (tleValue.isCallToBuiltinWithName(templateKeys.variables) && tleValue.argumentExpressions.length === 0) {
            // "variables<CURSOR>" or "variables(<CURSOR>)" or similar
            return this.getMatchingVariableCompletions("", tleValue, tleCharacterIndex, scope);
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

        let replaceSpan: language.Span;
        let completionPrefix: string;

        // Figure out the span which will be replaced by the completion
        if (tleTokenToComplete) {
            const tokenToCompleteStartIndex: number = tleTokenToComplete.span.startIndex;
            completionPrefix = tleTokenToComplete.stringValue.substring(0, tleCharacterIndex - tokenToCompleteStartIndex);
            if (completionPrefix.length === 0) {
                replaceSpan = this.emptySpanAtDocumentCharacterIndex;
            } else {
                replaceSpan = tleTokenToComplete.span.translate(this.jsonTokenStartIndex);
            }
        } else {
            // Nothing getting completed, completion selection will be inserted at current location
            replaceSpan = this.emptySpanAtDocumentCharacterIndex;
            completionPrefix = "";
        }

        assert(completeBuiltinFunctions || completeUserFunctions || completeNamespaces, "Should be completing something");
        let builtinCompletions: Completion.Item[] = [];
        let userFunctionCompletions: Completion.Item[] = [];
        let namespaceCompletions: Completion.Item[] = [];

        if (completeBuiltinFunctions || completeUserFunctions) {
            if (completeUserFunctions && namespace) {
                userFunctionCompletions = PositionContext.getMatchingFunctionCompletions(scope, namespace, completionPrefix, replaceSpan);
            }
            if (completeBuiltinFunctions) {
                builtinCompletions = PositionContext.getMatchingFunctionCompletions(scope, undefined, completionPrefix, replaceSpan);
            }
        }
        if (completeNamespaces) {
            namespaceCompletions = PositionContext.getMatchingNamespaceCompletions(scope, completionPrefix, replaceSpan);
        }

        return builtinCompletions.concat(namespaceCompletions).concat(userFunctionCompletions);
    }

    private getDeepPropertyAccessCompletions(propertyPrefix: string, variableOrParameterDefinition: Json.ObjectValue, sourcesNameStack: string[], replaceSpan: language.Span): Completion.Item[] {
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
                result.push(PositionContext.createPropertyCompletionItem(matchingPropertyName, replaceSpan));
            }
        }

        return result;
    }

    private static createPropertyCompletionItem(propertyName: string, replaceSpan: language.Span): Completion.Item {
        return Completion.Item.fromPropertyName(propertyName, replaceSpan);
    }

    // Returns undefined if references are not supported at this location.
    // Returns empty list if supported but none found
    public getReferences(): Reference.ReferenceList | undefined {
        const tleInfo = this.tleInfo;
        if (tleInfo) { // If we're inside a string (whether an expression or not)
            const refInfo = this.getReferenceSiteInfo();
            if (refInfo) {
                return this.document.findReferences(refInfo.definition);
            }

            // Handle when we're directly on the name of a parameter/variable/etc definition (as opposed to a reference)
            const jsonStringValue: Json.StringValue | undefined = Json.asStringValue(this.jsonValue);
            if (jsonStringValue) {
                const unquotedString = jsonStringValue.unquotedValue;
                const scope = tleInfo.scope;

                // Is it a parameter definition?
                const parameterDefinition: IParameterDefinition | undefined = scope.getParameterDefinition(unquotedString);
                if (parameterDefinition && parameterDefinition.nameValue === jsonStringValue) {
                    return this.document.findReferences(parameterDefinition);
                }

                // Is it a variable definition?
                const variableDefinition: IVariableDefinition | undefined = scope.getVariableDefinition(unquotedString);
                if (variableDefinition && variableDefinition.nameValue === jsonStringValue) {
                    return this.document.findReferences(variableDefinition);
                }

                // Is it a user namespace definition?
                const namespaceDefinition: UserFunctionNamespaceDefinition | undefined = scope.getFunctionNamespaceDefinition(unquotedString);
                if (namespaceDefinition && namespaceDefinition.nameValue === jsonStringValue) {
                    return this.document.findReferences(namespaceDefinition);
                }

                // Is it a user function definition inside any namespace?
                for (let ns of scope.namespaceDefinitions) {
                    const userFunctionDefinition: UserFunctionDefinition | undefined = scope.getUserFunctionDefinition(ns.nameValue.unquotedValue, unquotedString);
                    if (userFunctionDefinition && userFunctionDefinition.nameValue === jsonStringValue) {
                        return this.document.findReferences(userFunctionDefinition);
                    }
                }
            }
        }

        return undefined;
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
                    let currentArgumentIndex: number = 0;

                    for (const commaToken of functionToHelpWith.commaTokens) {
                        if (commaToken.span.startIndex < this.tleInfo.tleCharacterIndex) {
                            ++currentArgumentIndex;
                        }
                    }

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

        return undefined;
    }

    /**
     * Given a possible namespace name plus a function name prefix and replacement span, return a list
     * of completions for functions or namespaces starting with that prefix
     */
    private static getMatchingFunctionCompletions(scope: TemplateScope, namespace: UserFunctionNamespaceDefinition | undefined, functionNamePrefix: string, replaceSpan: language.Span): Completion.Item[] {
        let matches: IFunctionMetadata[];

        if (namespace) {
            // User-defined function
            matches = scope.findFunctionDefinitionsWithPrefix(namespace, functionNamePrefix).map(fd => UserFunctionMetadata.fromDefinition(fd));
        } else {
            // Built-in function
            matches = functionNamePrefix === "" ?
                AzureRMAssets.getFunctionsMetadata().functionMetadata :
                AzureRMAssets.getFunctionMetadataFromPrefix(functionNamePrefix);
        }

        return matches.map(m => Completion.Item.fromFunctionMetadata(m, replaceSpan));
    }

    /**
     * Given a possible namespace name plus a function name prefix and replacement span, return a list
     * of completions for functions or namespaces starting with that prefix
     */
    private static getMatchingNamespaceCompletions(scope: TemplateScope, namespacePrefix: string, replaceSpan: language.Span): Completion.Item[] {
        const matches: UserFunctionNamespaceDefinition[] = scope.findNamespaceDefinitionsWithPrefix(namespacePrefix);
        return matches.map(m => Completion.Item.fromNamespaceDefinition(m, replaceSpan));
    }

    private getMatchingParameterCompletions(prefix: string, tleValue: TLE.StringValue | TLE.FunctionCallValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        const replaceSpanInfo: ReplaceSpanInfo = this.getReplaceSpanInfo(tleValue, tleCharacterIndex);

        const parameterCompletions: Completion.Item[] = [];
        const parameterDefinitionMatches: IParameterDefinition[] = scope.findParameterDefinitionsWithPrefix(prefix);
        for (const parameterDefinition of parameterDefinitionMatches) {
            parameterCompletions.push(Completion.Item.fromParameterDefinition(parameterDefinition, replaceSpanInfo.replaceSpan, replaceSpanInfo.includeRightParenthesisInCompletion));
        }
        return parameterCompletions;
    }

    private getMatchingVariableCompletions(prefix: string, tleValue: TLE.StringValue | TLE.FunctionCallValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        const replaceSpanInfo: ReplaceSpanInfo = this.getReplaceSpanInfo(tleValue, tleCharacterIndex);

        const variableCompletions: Completion.Item[] = [];
        const variableDefinitionMatches: IVariableDefinition[] = scope.findVariableDefinitionsWithPrefix(prefix);
        for (const variableDefinition of variableDefinitionMatches) {
            variableCompletions.push(Completion.Item.fromVariableDefinition(variableDefinition, replaceSpanInfo.replaceSpan, replaceSpanInfo.includeRightParenthesisInCompletion));
        }
        return variableCompletions;
    }

    private getReplaceSpanInfo(tleValue: TLE.StringValue | TLE.FunctionCallValue, tleCharacterIndex: number): ReplaceSpanInfo {
        let includeRightParenthesisInCompletion: boolean = true;
        let replaceSpan: language.Span;
        if (tleValue instanceof TLE.StringValue) {
            const stringSpan: language.Span = tleValue.getSpan();
            const stringStartIndex: number = stringSpan.startIndex;
            const functionValue: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(tleValue.parent);

            const rightParenthesisIndex: number = tleValue.toString().indexOf(")");
            const rightSquareBracketIndex: number = tleValue.toString().indexOf("]");
            if (rightParenthesisIndex >= 0) {
                replaceSpan = new language.Span(stringStartIndex, rightParenthesisIndex + 1);
            } else if (rightSquareBracketIndex >= 0) {
                replaceSpan = new language.Span(stringStartIndex, rightSquareBracketIndex);
            } else if (functionValue && functionValue.rightParenthesisToken && functionValue.argumentExpressions.length === 1) {
                replaceSpan = new language.Span(stringStartIndex, functionValue.rightParenthesisToken.span.afterEndIndex - stringStartIndex);
            } else {
                includeRightParenthesisInCompletion = !!functionValue && functionValue.argumentExpressions.length <= 1;
                replaceSpan = stringSpan;
            }

            replaceSpan = replaceSpan.translate(this.jsonTokenStartIndex);
        } else {
            if (tleValue.rightParenthesisToken) {
                replaceSpan = new language.Span(
                    this.documentCharacterIndex,
                    tleValue.rightParenthesisToken.span.startIndex - tleCharacterIndex + 1);
            } else {
                replaceSpan = this.emptySpanAtDocumentCharacterIndex;
            }
        }

        return {
            includeRightParenthesisInCompletion: includeRightParenthesisInCompletion,
            replaceSpan: replaceSpan
        };
    }
}

interface ReplaceSpanInfo {
    includeRightParenthesisInCompletion: boolean;
    replaceSpan: language.Span;
}

interface ITleInfo {
    /**
     * The parse result of the enclosing string, if we're inside a string (it's with an expression or not)
     */
    tleParseResult: TLE.ParseResult;

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
