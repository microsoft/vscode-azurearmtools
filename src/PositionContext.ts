// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-line-length

import { Language } from "../extension.bundle";
import { AzureRMAssets, FunctionMetadata } from "./AzureRMAssets";
import { CachedPromise } from "./CachedPromise";
import { CachedValue } from "./CachedValue";
import * as Completion from "./Completion";
import { __debugMarkPositionInString } from "./debugMarkStrings";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { assert } from './fixed_assert';
import * as Hover from "./Hover";
import { IParameterDefinition } from "./IParameterDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import * as Reference from "./Reference";
import { TemplateScope } from "./TemplateScope";
import * as TLE from "./TLE";
import { UserFunctionDefinition } from "./UserFunctionDefinition";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { assertNever } from "./util/assertNever";

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
export type IReferenceSite = {
    kind: "userNamespace";
    userNamespace: UserFunctionNamespaceDefinition;
    referenceSpan: Language.Span;
    definitionSpan: Language.Span;
} | {
    kind: "userFunction";
    userNamespace: UserFunctionNamespaceDefinition;
    userFunction: UserFunctionDefinition;
    referenceSpan: Language.Span;
    definitionSpan: Language.Span;
} | {
    kind: "builtinFunction";
    functionMetadata: FunctionMetadata;
    referenceSpan: Language.Span;
    definitionSpan: undefined;
} | {
    kind: "parameter";
    parameter: IParameterDefinition;
    referenceSpan: Language.Span;
    definitionSpan: Language.Span;
} | {
    kind: "variable";
    variable: Json.Property;
    referenceSpan: Language.Span;
    definitionSpan: Language.Span;
};

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
    private _completionItems: CachedPromise<Completion.Item[]> = new CachedPromise<Completion.Item[]>();
    private _signatureHelp: CachedPromise<TLE.FunctionSignatureHelp | null> = new CachedPromise<TLE.FunctionSignatureHelp | null>();

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
        return __debugMarkPositionInString(docText, this.documentCharacterIndex, "<<POSITION>>");
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugFullDisplay(): string {
        let docText: string = this._deploymentTemplate.documentText;
        return __debugMarkPositionInString(docText, this.documentCharacterIndex, "<<POSITION>>", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
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
    public async getReferenceSiteInfo(): Promise<null | IReferenceSite> {
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
                        const definitionSpan: language.Span = nsDefinition.namespaceName.span;
                        return { kind: "userNamespace", userNamespace: nsDefinition, referenceSpan: referenceSpan, definitionSpan };
                    }
                } else if (tleFuncCall.nameToken.span.contains(tleCharacterIndex)) {
                    if (tleFuncCall.namespaceToken) {
                        // Inside the name of a user-function reference
                        const ns = tleFuncCall.namespaceToken.stringValue;
                        const name = tleFuncCall.nameToken.stringValue;
                        const nsDefinition = scope.getFunctionNamespaceDefinition(ns);
                        const definition = scope.getFunctionDefinition(ns, name);
                        if (nsDefinition && definition) {
                            const referenceSpan: language.Span = tleFuncCall.nameToken.span.translate(this.jsonTokenStartIndex);
                            const definitionSpan: language.Span = definition.name.span;
                            return { kind: "userFunction", userNamespace: nsDefinition, userFunction: definition, referenceSpan, definitionSpan };
                        }
                    } else {
                        // Inside a reference to a built-in function
                        const functionMetadata: FunctionMetadata | undefined = await AzureRMAssets.getFunctionMetadataFromName(tleFuncCall.nameToken.stringValue);
                        if (functionMetadata) {
                            const referenceSpan: language.Span = tleFuncCall.nameToken.span.translate(this.jsonTokenStartIndex);
                            return { kind: "builtinFunction", functionMetadata: functionMetadata, referenceSpan, definitionSpan: undefined };
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
                        const definitionSpan: language.Span = parameterDefinition.name.span;
                        return { kind: 'parameter', parameter: parameterDefinition, referenceSpan, definitionSpan };
                    }
                } else if (tleStringValue.isVariablesArgument()) {
                    const variableDefinition: Json.Property | null = scope.getVariableDefinition(tleStringValue.toString());
                    if (variableDefinition) {
                        // Inside the 'xxx' of a variables('xxx') reference
                        const referenceSpan: language.Span = tleStringValue.getSpan().translate(this.jsonTokenStartIndex);
                        const definitionSpan: language.Span = variableDefinition.name.span;
                        return { kind: 'variable', variable: variableDefinition, referenceSpan, definitionSpan };
                    }
                }
            }
        }

        return null;
    }

    public async getHoverInfo(): Promise<Hover.Info | null> {
        const refSiteInfo: IReferenceSite | null = await this.getReferenceSiteInfo();
        if (refSiteInfo) {
            const span = refSiteInfo.referenceSpan;

            // tslint:disable-next-line:switch-default
            switch (refSiteInfo.kind) {
                case "userNamespace":
                    return new Hover.UserNamespaceInfo(refSiteInfo.userNamespace, span);
                case "userFunction":
                    return new Hover.UserFunctionInfo(refSiteInfo.userNamespace, refSiteInfo.userFunction, span);
                case "builtinFunction":
                    const functionMetadata = refSiteInfo.functionMetadata;
                    return new Hover.FunctionInfo(functionMetadata.name, functionMetadata.usage, functionMetadata.description, span);
                case "parameter":
                    return Hover.ParameterReferenceInfo.fromDefinition(refSiteInfo.parameter, span);
                case "variable":
                    return Hover.VariableReferenceInfo.fromDefinition(refSiteInfo.variable, span);
                default:
                    return assertNever(refSiteInfo); // Gives compile-time error if a case is missed
            }
        }

        return null;
    }

    /**
     * Get completion items for our position in the document
     */
    public async getCompletionItems(): Promise<Completion.Item[]> {
        return this._completionItems.getOrCachePromise(async () => {
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
                    // Inside brackets, so complete with all valid functions
                    return await PositionContext.getMatchingFunctionCompletions("", this.emptySpanAtDocumentCharacterIndex);
                } else {
                    return [];
                }

            } else if (tleValue instanceof TLE.FunctionCallValue) {
                return this.getFunctionCallCompletions(tleValue, tleInfo.tleCharacterIndex, scope);
            } else if (tleValue instanceof TLE.StringValue) {
                return this.getStringLiteralCompletions(tleValue, tleInfo.tleCharacterIndex, scope);
            } else if (tleValue instanceof TLE.PropertyAccess) {
                return await this.getPropertyAccessCompletions(tleValue, tleInfo.tleCharacterIndex, scope);
            }

            return [];
        });
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
     * Get completions when we're anywhere inside a property accesses, e.g. "resourceGroup().prop1.prop2"
     */
    private async getPropertyAccessCompletions(tleValue: TLE.PropertyAccess, tleCharacterIndex: number, scope: TemplateScope): Promise<Completion.Item[]> {
        const functionSource: TLE.FunctionCallValue | null = tleValue.functionSource;
        if (functionSource) {
            let propertyPrefix: string = "";
            let replaceSpan: language.Span = this.emptySpanAtDocumentCharacterIndex;
            const propertyNameToken: TLE.Token | null = tleValue.nameToken;
            if (propertyNameToken) {
                replaceSpan = propertyNameToken.span.translate(this.jsonTokenStartIndex);
                propertyPrefix = propertyNameToken.stringValue.substring(0, tleCharacterIndex - propertyNameToken.span.startIndex).toLowerCase();
            }

            const variableProperty: Json.Property | null = scope.getVariableDefinitionFromFunctionCall(functionSource);
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
                const functionName: string = functionSource.nameToken.stringValue;
                let functionMetadataMatches: FunctionMetadata[] = await AzureRMAssets.getFunctionMetadataFromPrefix(functionName);
                assert(functionMetadataMatches);

                const result: Completion.Item[] = [];
                if (functionMetadataMatches.length === 1) {
                    const functionMetadata: FunctionMetadata = functionMetadataMatches[0];
                    for (const returnValueMember of functionMetadata.returnValueMembers) {
                        if (propertyPrefix === "" || returnValueMember.toLowerCase().startsWith(propertyPrefix)) {
                            result.push(PositionContext.createPropertyCompletionItem(returnValueMember, replaceSpan));
                        }
                    }

                    return result;
                }
            }
        }

        return [];
    }

    /**
     * Return completions when we're anywhere inside a function call expression
     */
    private async getFunctionCallCompletions(tleValue: TLE.FunctionCallValue, tleCharacterIndex: number, scope: TemplateScope): Promise<Completion.Item[]> {
        if (tleValue.nameToken.span.contains(tleCharacterIndex, true)) {
            // The caret is inside the TLE function's name
            const functionNameStartIndex: number = tleValue.nameToken.span.startIndex;
            const functionNamePrefix: string = tleValue.nameToken.stringValue.substring(0, tleCharacterIndex - functionNameStartIndex);

            let replaceSpan: language.Span;
            if (functionNamePrefix.length === 0) {
                replaceSpan = this.emptySpanAtDocumentCharacterIndex;
            } else {
                replaceSpan = tleValue.nameToken.span.translate(this.jsonTokenStartIndex);
            }

            return await PositionContext.getMatchingFunctionCompletions(functionNamePrefix, replaceSpan);
        } else if (tleValue.leftParenthesisToken && tleCharacterIndex <= tleValue.leftParenthesisToken.span.startIndex) {
            // The caret is between the function name and the left parenthesis (with whitespace between them)
            return await PositionContext.getMatchingFunctionCompletions("", this.emptySpanAtDocumentCharacterIndex);
        } else {
            if (tleValue.isCallToBuiltinWithName("parameters") && tleValue.argumentExpressions.length === 0) {
                return this.getMatchingParameterCompletions("", tleValue, tleCharacterIndex, scope);
            } else if (tleValue.isCallToBuiltinWithName("variables") && tleValue.argumentExpressions.length === 0) {
                return this.getMatchingVariableCompletions("", tleValue, tleCharacterIndex, scope);
            } else {
                return await PositionContext.getMatchingFunctionCompletions("", this.emptySpanAtDocumentCharacterIndex);
            }
        }
    }

    private getDeepPropertyAccessCompletions(propertyPrefix: string, variableOrParameterDefinition: Json.ObjectValue, sourcesNameStack: string[], replaceSpan: language.Span): Completion.Item[] {
        const result: Completion.Item[] = [];

        const sourcePropertyDefinition: Json.ObjectValue | null = Json.asObjectValue(variableOrParameterDefinition.getPropertyValueFromStack(sourcesNameStack));
        if (sourcePropertyDefinition) {
            let matchingPropertyNames: string[];
            if (!propertyPrefix) {
                matchingPropertyNames = sourcePropertyDefinition.propertyNames;
            } else {
                matchingPropertyNames = [];
                for (const propertyName of sourcePropertyDefinition.propertyNames) {
                    if (propertyName.startsWith(propertyPrefix)) {
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
        return new Completion.Item(propertyName, `${propertyName}$0`, replaceSpan, "(property)", "", Completion.CompletionKind.Property);
    }

    // Returns null if references are not supported at this location.
    // Returns empty list if supported but none found
    public async getReferences(): Promise<Reference.List | null> {
        let referenceName: string | null = null;
        let referenceType: Reference.ReferenceKind | null = null;

        const tleInfo = this.tleInfo;
        if (tleInfo) { // If we're inside a string (whether an expression or not)
            const scope = tleInfo.scope;

            const refInfo = await this.getReferenceSiteInfo();
            if (refInfo) {
                switch (refInfo.kind) {
                    case "parameter":
                        // We're inside a parameters('xxx') call
                        referenceType = Reference.ReferenceKind.Parameter;
                        referenceName = refInfo.parameter.name.unquotedValue;
                        break;
                    case "variable":
                        // We're inside a vriables('xxx') call
                        referenceType = Reference.ReferenceKind.Variable;
                        referenceName = refInfo.variable.name.unquotedValue;
                        break;
                    case "builtinFunction":
                    case "userNamespace":
                    case "userFunction":
                        return null; // Not currently supported
                    default:
                        return assertNever(refInfo);
                }

                if (referenceName && referenceType !== null) {
                    return this._deploymentTemplate.findReferences(referenceType, referenceName, tleInfo.scope);
                }
            }

            // Handle when we're directly on the name in a parameter or variable definition (as opposed to a reference)
            if (referenceType === null) {
                const jsonStringValue: Json.StringValue | null = Json.asStringValue(this.jsonValue);
                if (jsonStringValue) {
                    const unquotedString = jsonStringValue.unquotedValue;

                    const parameterDefinition: IParameterDefinition | null = scope.getParameterDefinition(unquotedString);
                    if (parameterDefinition && parameterDefinition.name.unquotedValue === unquotedString) {
                        referenceName = unquotedString;
                        referenceType = Reference.ReferenceKind.Parameter;
                    } else {
                        const variableDefinition: Json.Property | null = scope.getVariableDefinition(unquotedString);
                        if (variableDefinition && variableDefinition.name === jsonStringValue) {
                            referenceName = unquotedString;
                            referenceType = Reference.ReferenceKind.Variable;
                        }
                    }
                }
            }

            if (referenceName && referenceType !== null) {
                return this._deploymentTemplate.findReferences(referenceType, referenceName, scope);
            }
        }

        return null;
    }

    public get signatureHelp(): Promise<TLE.FunctionSignatureHelp | null> {
        return this._signatureHelp.getOrCachePromise(async () => {
            const tleValue: TLE.Value | null = this.tleInfo && this.tleInfo.tleValue;
            if (this.tleInfo && tleValue) {
                let functionToHelpWith: TLE.FunctionCallValue | null = TLE.asFunctionCallValue(tleValue);
                if (!functionToHelpWith) {
                    functionToHelpWith = TLE.asFunctionCallValue(tleValue.parent);
                }

                if (functionToHelpWith) {
                    const functionMetadata: FunctionMetadata | undefined = await AzureRMAssets.getFunctionMetadataFromName(functionToHelpWith.nameToken.stringValue);
                    if (functionMetadata) {
                        let currentArgumentIndex: number = 0;

                        for (const commaToken of functionToHelpWith.commaTokens) {
                            if (commaToken.span.startIndex < this.tleInfo.tleCharacterIndex) {
                                ++currentArgumentIndex;
                            }
                        }

                        const functionMetadataParameters: string[] = functionMetadata.parameters;
                        if (functionMetadataParameters.length > 0 &&
                            functionMetadataParameters.length <= currentArgumentIndex &&
                            functionMetadataParameters[functionMetadataParameters.length - 1].endsWith("...")) {

                            currentArgumentIndex = functionMetadataParameters.length - 1;
                        }

                        return new TLE.FunctionSignatureHelp(currentArgumentIndex, functionMetadata);
                    }
                }
            }

            return null;
        });
    }

    /**
     * Given a function name prefix and replacement span, return a list of completions for functions
     * starting with that prefix
     */
    private static async getMatchingFunctionCompletions(prefix: string, replaceSpan: language.Span): Promise<Completion.Item[]> {
        let functionMetadataMatches: FunctionMetadata[];
        if (prefix === "") {
            functionMetadataMatches = (await AzureRMAssets.getFunctionsMetadata()).functionMetadata;
        } else {
            functionMetadataMatches = (await AzureRMAssets.getFunctionMetadataFromPrefix(prefix));
        }

        const completionItems: Completion.Item[] = [];
        for (const functionMetadata of functionMetadataMatches) {
            const name: string = functionMetadata.name;

            let insertText: string = name;
            if (functionMetadata.maximumArguments === 0) {
                insertText += "()$0";
            } else {
                insertText += "($0)";
            }

            completionItems.push(new Completion.Item(name, insertText, replaceSpan, `(function) ${functionMetadata.usage}`, functionMetadata.description, Completion.CompletionKind.Function));
        }
        return completionItems;
    }

    private getMatchingParameterCompletions(prefix: string, tleValue: TLE.StringValue | TLE.FunctionCallValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        const replaceSpanInfo: ReplaceSpanInfo = this.getReplaceSpanInfo(tleValue, tleCharacterIndex);

        const parameterCompletions: Completion.Item[] = [];
        const parameterDefinitionMatches: IParameterDefinition[] = scope.findParameterDefinitionsWithPrefix(prefix);
        for (const parameterDefinition of parameterDefinitionMatches) {
            const name: string = `'${parameterDefinition.name}'`;
            parameterCompletions.push(
                new Completion.Item(
                    name,
                    `${name}${replaceSpanInfo.includeRightParenthesisInCompletion ? ")" : ""}$0`,
                    replaceSpanInfo.replaceSpan,
                    `(parameter)`,
                    // tslint:disable-next-line: strict-boolean-expressions
                    parameterDefinition.description,
                    Completion.CompletionKind.Parameter));
        }
        return parameterCompletions;
    }

    private getMatchingVariableCompletions(prefix: string, tleValue: TLE.StringValue | TLE.FunctionCallValue, tleCharacterIndex: number, scope: TemplateScope): Completion.Item[] {
        const replaceSpanInfo: ReplaceSpanInfo = this.getReplaceSpanInfo(tleValue, tleCharacterIndex);

        const variableCompletions: Completion.Item[] = [];
        const variableDefinitionMatches: Json.Property[] = scope.findVariableDefinitionsWithPrefix(prefix);
        for (const variableDefinition of variableDefinitionMatches) {
            const variableName: string = `'${variableDefinition.name.toString()}'`;
            variableCompletions.push(new Completion.Item(variableName, `${variableName}${replaceSpanInfo.includeRightParenthesisInCompletion ? ")" : ""}$0`, replaceSpanInfo.replaceSpan, `(variable)`, "", Completion.CompletionKind.Variable));
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
