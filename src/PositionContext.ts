// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-line-length

import { Language } from "../extension.bundle";
import { AzureRMAssets, BuiltinFunctionMetadata } from "./AzureRMAssets";
import { CachedValue } from "./CachedValue";
import * as Completion from "./Completion";
import { templateKeys } from "./constants";
import { __debugMarkPositionInString } from "./debugMarkStrings";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { assert } from './fixed_assert';
import * as Hover from "./Hover";
import { IFunctionMetadata, IFunctionParameterMetadata } from "./IFunctionMetadata";
import { DefinitionKind, INamedDefinition } from "./INamedDefinition";
import { IParameterDefinition } from "./IParameterDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import { ParameterDefinition } from "./ParameterDefinition";
import * as Reference from "./ReferenceList";
import { TemplateScope } from "./TemplateScope";
import * as TLE from "./TLE";
import { UserFunctionDefinition } from "./UserFunctionDefinition";
import { UserFunctionMetadata } from "./UserFunctionMetadata";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { UserFunctionParameterDefinition } from "./UserFunctionParameterDefinition";
import { assertNever } from "./util/assertNever";
import { VariableDefinition } from "./VariableDefinition";

/**
 * Information about the TLE expression (if position is at an expression string)
 */
class TleInfo implements ITleInfo {
    public constructor(
        public readonly tleParseResult: TLE.ParseResult,
        public readonly tleCharacterIndex: number,
        public readonly tleValue: TLE.Value | null,
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

/**
 * Represents a position inside the snapshot of a deployment template, plus all related information
 * that can be parsed and analyzed about it
 */
export class PositionContext {
    private _deploymentTemplate: DeploymentTemplate;
    private _givenDocumentPosition?: language.Position;
    private _documentPosition: CachedValue<language.Position> = new CachedValue<language.Position>();
    private _givenDocumentCharacterIndex?: number;
    private _documentCharacterIndex: CachedValue<number> = new CachedValue<number>();
    private _jsonToken: CachedValue<Json.Token | null> = new CachedValue<Json.Token>();
    private _jsonValue: CachedValue<Json.Value | null> = new CachedValue<Json.Value | null>();
    private _tleInfo: CachedValue<TleInfo | null> = new CachedValue<TleInfo | null>();

    public static fromDocumentLineAndColumnIndexes(deploymentTemplate: DeploymentTemplate, documentLineIndex: number, documentColumnIndex: number): PositionContext {
        assert(deploymentTemplate !== null, "deploymentTemplate cannot be null");
        assert(deploymentTemplate !== undefined, "deploymentTemplate cannot be undefined");
        assert(documentLineIndex !== null, "documentLineIndex cannot be null");
        assert(documentLineIndex !== undefined, "documentLineIndex cannot be undefined");
        assert(documentLineIndex >= 0, "documentLineIndex cannot be negative");
        assert(documentLineIndex < deploymentTemplate.lineCount, `documentLineIndex (${documentLineIndex}) cannot be greater than or equal to the deployment template's line count (${deploymentTemplate.lineCount})`);
        assert(documentColumnIndex !== null, "documentColumnIndex cannot be null");
        assert(documentColumnIndex !== undefined, "documentColumnIndex cannot be undefined");
        assert(documentColumnIndex >= 0, "documentColumnIndex cannot be negative");
        assert(documentColumnIndex <= deploymentTemplate.getMaxColumnIndex(documentLineIndex), `documentColumnIndex (${documentColumnIndex}) cannot be greater than the line's maximum index (${deploymentTemplate.getMaxColumnIndex(documentLineIndex)})`);

        let context = new PositionContext();
        context._deploymentTemplate = deploymentTemplate;
        context._givenDocumentPosition = new language.Position(documentLineIndex, documentColumnIndex);
        return context;

    }
    public static fromDocumentCharacterIndex(deploymentTemplate: DeploymentTemplate, documentCharacterIndex: number): PositionContext {
        assert(deploymentTemplate !== null, "deploymentTemplate cannot be null");
        assert(deploymentTemplate !== undefined, "deploymentTemplate cannot be undefined");
        assert(documentCharacterIndex !== null, "documentCharacterIndex cannot be null");
        assert(documentCharacterIndex !== undefined, "documentCharacterIndex cannot be undefined");
        assert(documentCharacterIndex >= 0, "documentCharacterIndex cannot be negative");
        assert(documentCharacterIndex <= deploymentTemplate.maxCharacterIndex, `documentCharacterIndex (${documentCharacterIndex}) cannot be greater than the maximum character index (${deploymentTemplate.maxCharacterIndex})`);

        let context = new PositionContext();
        context._deploymentTemplate = deploymentTemplate;
        context._givenDocumentCharacterIndex = documentCharacterIndex;
        return context;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        let docText: string = this._deploymentTemplate.documentText;
        return __debugMarkPositionInString(docText, this.documentCharacterIndex, "<CURSOR>");
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugFullDisplay(): string {
        let docText: string = this._deploymentTemplate.documentText;
        return __debugMarkPositionInString(docText, this.documentCharacterIndex, "<CURSOR>", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }

    public get documentPosition(): language.Position {
        return this._documentPosition.getOrCacheValue(() => {
            if (this._givenDocumentPosition) {
                return this._givenDocumentPosition;
            } else {
                return this._deploymentTemplate.getDocumentPosition(this.documentCharacterIndex);
            }
        });
    }

    public get documentLineIndex(): number {
        return this.documentPosition.line;
    }

    public get documentColumnIndex(): number {
        return this.documentPosition.column;
    }

    public get documentCharacterIndex(): number {
        return this._documentCharacterIndex.getOrCacheValue(() => {
            if (typeof this._givenDocumentCharacterIndex === "number") {
                return this._givenDocumentCharacterIndex;
            } else {
                return this._deploymentTemplate.getDocumentCharacterIndex(this.documentLineIndex, this.documentColumnIndex);
            }
        });
    }

    public get jsonToken(): Json.Token | null {
        return this._jsonToken.getOrCacheValue(() => {
            return this._deploymentTemplate.getJSONTokenAtDocumentCharacterIndex(this.documentCharacterIndex);
        });
    }

    public get jsonValue(): Json.Value | null {
        return this._jsonValue.getOrCacheValue(() => {
            return this._deploymentTemplate.getJSONValueAtDocumentCharacterIndex(this.documentCharacterIndex);
        });
    }

    public get jsonTokenStartIndex(): number {
        assert(!!this.jsonToken, "The jsonTokenStartIndex can only be requested when the PositionContext is inside a JSONToken.");
        // tslint:disable-next-line:no-non-null-assertion no-unnecessary-type-assertion // Asserted
        return this.jsonToken!.span.startIndex;
    }

    /**
     * Retrieves TleInfo for the current position if it's inside a string
     */
    public get tleInfo(): TleInfo | null {
        return this._tleInfo.getOrCacheValue(() => {
            //const tleParseResult = this._deploymentTemplate.getTLEParseResultFromJSONToken(this.jsonToken);
            const jsonToken = this.jsonToken;
            if (
                jsonToken
                && jsonToken.type === Json.TokenType.QuotedString
                && this.jsonValue
                && this.jsonValue instanceof Json.StringValue
            ) {
                const tleParseResult = this._deploymentTemplate.getTLEParseResultFromJsonStringValue(this.jsonValue);
                const tleCharacterIndex = this.documentCharacterIndex - this.jsonTokenStartIndex;
                const tleValue = tleParseResult.getValueAtCharacterIndex(tleCharacterIndex);
                return new TleInfo(tleParseResult, tleCharacterIndex, tleValue, tleParseResult.scope);
            }
            return null;
        });
    }

    public get emptySpanAtDocumentCharacterIndex(): language.Span {
        return new language.Span(this.documentCharacterIndex, 0);
    }

    /**
     * If this position is inside an expression, inside a reference to an interesting function/parameter/etc, then
     * return an object with information about this reference and the corresponding definition
     */
    public getReferenceSiteInfo(): null | IReferenceSite {
        const tleInfo = this.tleInfo;
        if (tleInfo) {
            const scope = tleInfo.scope;
            const tleCharacterIndex = tleInfo.tleCharacterIndex;

            const tleFuncCall: TLE.FunctionCallValue | null = TLE.asFunctionCallValue(tleInfo.tleValue);
            if (tleFuncCall) {
                if (tleFuncCall.namespaceToken && tleFuncCall.namespaceToken.span.contains(tleCharacterIndex)) {
                    // Inside the namespace of a user-function reference
                    const ns = tleFuncCall.namespaceToken.stringValue;
                    const nsDefinition = scope.getFunctionNamespaceDefinition(ns);
                    if (nsDefinition) {
                        const referenceSpan: language.Span = tleFuncCall.namespaceToken.span.translate(this.jsonTokenStartIndex);
                        return { definition: nsDefinition, referenceSpan };
                    }
                } else if (tleFuncCall.nameToken && tleFuncCall.nameToken.span.contains(tleCharacterIndex)) {
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

            const tleStringValue: TLE.StringValue | null = TLE.asStringValue(tleInfo.tleValue);
            if (tleStringValue instanceof TLE.StringValue) {
                if (tleStringValue.isParametersArgument()) {
                    // Inside the 'xxx' of a parameters('xxx') reference
                    const parameterDefinition: IParameterDefinition | null = scope.getParameterDefinition(tleStringValue.toString());
                    if (parameterDefinition) {
                        const referenceSpan: language.Span = tleStringValue.getSpan().translate(this.jsonTokenStartIndex);
                        return { definition: parameterDefinition, referenceSpan };
                    }
                } else if (tleStringValue.isVariablesArgument()) {
                    const variableDefinition: VariableDefinition | null = scope.getVariableDefinition(tleStringValue.toString());
                    if (variableDefinition) {
                        // Inside the 'xxx' of a variables('xxx') reference
                        const referenceSpan: language.Span = tleStringValue.getSpan().translate(this.jsonTokenStartIndex);
                        return { definition: variableDefinition, referenceSpan };
                    }
                }
            }
        }

        return null;
    }

    public getHoverInfo(): Hover.Info | null {
        const reference: IReferenceSite | null = this.getReferenceSiteInfo();
        if (reference) {
            const span = reference.referenceSpan;
            const definition = reference.definition;

            // tslint:disable-next-line:switch-default
            switch (definition.definitionKind) {
                case DefinitionKind.Namespace:
                    if (definition instanceof UserFunctionNamespaceDefinition) {
                        return new Hover.UserNamespaceInfo(definition, span);
                    }
                    break;
                case DefinitionKind.UserFunction:
                    if (definition instanceof UserFunctionDefinition) {
                        return new Hover.UserFunctionInfo(definition, span);
                    }
                    break;
                case DefinitionKind.BuiltinFunction:
                    if (definition instanceof BuiltinFunctionMetadata) {
                        const functionMetadata = definition;
                        return new Hover.FunctionInfo(functionMetadata.fullName, functionMetadata.usage, functionMetadata.description, span);
                    }
                    break;
                case DefinitionKind.Parameter:
                    if (definition instanceof ParameterDefinition || definition instanceof UserFunctionParameterDefinition) {
                        return Hover.ParameterReferenceInfo.fromDefinition(definition, span);
                    }
                    break;
                case DefinitionKind.Variable:
                    if (definition instanceof VariableDefinition) {
                        return Hover.VariableReferenceInfo.fromDefinition(definition, span);
                    }
                    break;
                default:
                    return assertNever(definition.definitionKind); // Gives compile-time error if a case is missed
            }

            assert(false, `Unexpected definition type for definition kind ${definition.definitionKind}`);
        }

        return null;
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
        const tleValue: TLE.Value | null = tleInfo.tleValue;
        const scope: TemplateScope = tleInfo.scope;

        if (!tleValue || !tleValue.contains(tleInfo.tleCharacterIndex)) {
            // No TLE value here. For instance, expression is empty, or before/after/on the square brackets
            if (PositionContext.isInsideSquareBrackets(tleInfo.tleParseResult, tleInfo.tleCharacterIndex)) {
                // Inside brackets, so complete with all valid functions and namespaces
                const replaceSpan = this.emptySpanAtDocumentCharacterIndex;
                const functionCompletions = PositionContext.getMatchingFunctionCompletions(scope, null, "", replaceSpan);
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
        const leftSquareBracketToken: TLE.Token | null = parseResult.leftSquareBracketToken;
        const rightSquareBracketToken: TLE.Token | null = parseResult.rightSquareBracketToken;

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
        const functionSource: TLE.FunctionCallValue | null = tleValue.functionSource;
        if (functionSource) {
            let propertyPrefix: string = "";
            let replaceSpan: language.Span = this.emptySpanAtDocumentCharacterIndex;
            const propertyNameToken: TLE.Token | null = tleValue.nameToken;
            if (propertyNameToken) {
                replaceSpan = propertyNameToken.span.translate(this.jsonTokenStartIndex);
                propertyPrefix = propertyNameToken.stringValue.substring(0, tleCharacterIndex - propertyNameToken.span.startIndex).toLowerCase();
            }

            const variableProperty: VariableDefinition | null = scope.getVariableDefinitionFromFunctionCall(functionSource);
            const parameterProperty: IParameterDefinition | null = scope.getParameterDefinitionFromFunctionCall(functionSource);
            const sourcesNameStack: string[] = tleValue.sourcesNameStack;
            if (variableProperty) {
                // If the variable's value is an object...
                const sourceVariableDefinition: Json.ObjectValue | null = Json.asObjectValue(variableProperty.value);
                if (sourceVariableDefinition) {
                    return this.getDeepPropertyAccessCompletions(
                        propertyPrefix,
                        sourceVariableDefinition,
                        sourcesNameStack,
                        replaceSpan);
                }
            } else if (parameterProperty) {
                // If the parameters's default value is an object...
                const parameterDefValue: Json.ObjectValue | null = parameterProperty.defaultValue ? Json.asObjectValue(parameterProperty.defaultValue) : null;
                if (parameterDefValue) {
                    const sourcePropertyDefinition: Json.ObjectValue | null = Json.asObjectValue(parameterDefValue.getPropertyValueFromStack(sourcesNameStack));
                    if (sourcePropertyDefinition) {
                        return this.getDeepPropertyAccessCompletions(
                            propertyPrefix,
                            sourcePropertyDefinition,
                            sourcesNameStack,
                            replaceSpan);
                    }
                }
            } else if (sourcesNameStack.length === 0) {
                // We don't allow multiple levels of property access
                // (resourceGroup().prop1.prop2) on functions other than variables/parameters,
                // therefore checking that sourcesNameStack.length === 0
                const functionName: string | null = functionSource.name;
                if (functionName && !functionSource.namespaceToken) { // Don't currently support completions from a user function returning an object
                    let functionMetadataMatches: BuiltinFunctionMetadata[] = AzureRMAssets.getFunctionMetadataFromPrefix(functionName);
                    assert(functionMetadataMatches);

                    const result: Completion.Item[] = [];
                    if (functionMetadataMatches.length === 1) {
                        const functionMetadata: BuiltinFunctionMetadata = functionMetadataMatches[0];
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
        assert(tleValue.getSpan().contains(tleCharacterIndex, true), "Position should be inside the function call, or right after it");

        const namespaceName: string | null = tleValue.namespaceToken ? tleValue.namespaceToken.stringValue : null;
        // tslint:disable-next-line: strict-boolean-expressions
        const namespace: UserFunctionNamespaceDefinition | null = (namespaceName && scope.getFunctionNamespaceDefinition(namespaceName)) || null;

        // The token (namespace or name) that the user is completing and will be replaced with the user's selection
        // If null, we're just inserting at the current position, not replacing anything
        let tleTokenToComplete: TLE.Token | null;

        let completeNamespaces: boolean;
        let completeBuiltinFunctions: boolean;
        let completeUserFunctions: boolean;

        if (tleValue.nameToken && tleValue.nameToken.span.contains(tleCharacterIndex, true)) {
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
        } else if (tleValue.namespaceToken && tleValue.periodToken && tleValue.namespaceToken.span.contains(tleCharacterIndex, true)) {
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

            tleTokenToComplete = null;
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
                builtinCompletions = PositionContext.getMatchingFunctionCompletions(scope, null, completionPrefix, replaceSpan);
            }
        }
        if (completeNamespaces) {
            namespaceCompletions = PositionContext.getMatchingNamespaceCompletions(scope, completionPrefix, replaceSpan);
        }

        return builtinCompletions.concat(namespaceCompletions).concat(userFunctionCompletions);
    }

    private getDeepPropertyAccessCompletions(propertyPrefix: string, variableOrParameterDefinition: Json.ObjectValue, sourcesNameStack: string[], replaceSpan: language.Span): Completion.Item[] {
        const result: Completion.Item[] = [];

        const sourcePropertyDefinition: Json.ObjectValue | null = Json.asObjectValue(variableOrParameterDefinition.getPropertyValueFromStack(sourcesNameStack));
        if (sourcePropertyDefinition) {
            let matchingPropertyNames: string[];
            if (!propertyPrefix) {
                matchingPropertyNames = sourcePropertyDefinition.propertyNames;
            } else {
                // We need to ignore casing when creating completions
                const propertyPrefixLC = propertyPrefix.toLowerCase();

                matchingPropertyNames = [];
                for (const propertyName of sourcePropertyDefinition.propertyNames) {
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

    // Returns null if references are not supported at this location.
    // Returns empty list if supported but none found
    public getReferences(): Reference.ReferenceList | null {
        const tleInfo = this.tleInfo;
        if (tleInfo) { // If we're inside a string (whether an expression or not)
            const refInfo = this.getReferenceSiteInfo();
            if (refInfo) {
                return this._deploymentTemplate.findReferences(refInfo.definition);
            }

            // Handle when we're directly on the name of a parameter/variable/etc definition (as opposed to a reference)
            const jsonStringValue: Json.StringValue | null = Json.asStringValue(this.jsonValue);
            if (jsonStringValue) {
                const unquotedString = jsonStringValue.unquotedValue;
                const scope = tleInfo.scope;

                // Is it a parameter definition?
                const parameterDefinition: IParameterDefinition | null = scope.getParameterDefinition(unquotedString);
                if (parameterDefinition && parameterDefinition.nameValue === jsonStringValue) {
                    return this._deploymentTemplate.findReferences(parameterDefinition);
                }

                // Is it a variable definition?
                const variableDefinition: VariableDefinition | null = scope.getVariableDefinition(unquotedString);
                if (variableDefinition && variableDefinition.nameValue === jsonStringValue) {
                    return this._deploymentTemplate.findReferences(variableDefinition);
                }

                // Is it a user namespace definition?
                const namespaceDefinition: UserFunctionNamespaceDefinition | undefined = scope.getFunctionNamespaceDefinition(unquotedString);
                if (namespaceDefinition && namespaceDefinition.nameValue === jsonStringValue) {
                    return this._deploymentTemplate.findReferences(namespaceDefinition);
                }

                // Is it a user function definition inside any namespace?
                for (let ns of scope.namespaceDefinitions) {
                    const userFunctionDefinition: UserFunctionDefinition | null = scope.getUserFunctionDefinition(ns.nameValue.unquotedValue, unquotedString);
                    if (userFunctionDefinition && userFunctionDefinition.nameValue === jsonStringValue) {
                        return this._deploymentTemplate.findReferences(userFunctionDefinition);
                    }
                }
            }
        }

        return null;
    }

    public getSignatureHelp(): TLE.FunctionSignatureHelp | null {
        const tleValue: TLE.Value | null = this.tleInfo && this.tleInfo.tleValue;
        if (this.tleInfo && tleValue) {
            let functionToHelpWith: TLE.FunctionCallValue | null = TLE.asFunctionCallValue(tleValue);
            if (!functionToHelpWith) {
                functionToHelpWith = TLE.asFunctionCallValue(tleValue.parent);
            }

            if (functionToHelpWith && functionToHelpWith.name) {
                let functionMetadata: IFunctionMetadata | undefined;

                if (functionToHelpWith.namespaceToken) {
                    // Call to user-defined function
                    const namespace: string = functionToHelpWith.namespaceToken.stringValue;
                    const name: string | null = functionToHelpWith.name;
                    const udfDefinition: UserFunctionDefinition | null = this.tleInfo.scope.getUserFunctionDefinition(namespace, name);
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

        return null;
    }

    /**
     * Given a possible namespace name plus a function name prefix and replacement span, return a list
     * of completions for functions or namespaces starting with that prefix
     */
    private static getMatchingFunctionCompletions(scope: TemplateScope, namespace: UserFunctionNamespaceDefinition | null, functionNamePrefix: string, replaceSpan: language.Span): Completion.Item[] {
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
        const variableDefinitionMatches: VariableDefinition[] = scope.findVariableDefinitionsWithPrefix(prefix);
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
            const functionValue: TLE.FunctionCallValue | null = TLE.asFunctionCallValue(tleValue.parent);

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
     * (whether it's an expression or not). This can null if inside square brackets but before
     * an expression, etc.
     */
    tleValue: TLE.Value | null;

}
