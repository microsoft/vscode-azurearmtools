// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-line-length

import * as assert from "assert";
import { AzureRMAssets, FunctionMetadata } from "./AzureRMAssets";
import { CachedPromise } from "./CachedPromise";
import { CachedValue } from "./CachedValue";
import * as Completion from "./Completion";
import { DeploymentTemplate } from "./DeploymentTemplate";
import * as Hover from "./Hover";
import * as Json from "./JSON";
import * as language from "./Language";
import { ParameterDefinition } from "./ParameterDefinition";
import * as Reference from "./Reference";
import * as TLE from "./TLE";

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
    private _jsonValue: CachedValue<Json.Value> = new CachedValue<Json.Value>();
    private _tleInfo: CachedValue<TleInfo | null> = new CachedValue<TleInfo | null>();
    private _hoverInfo: CachedPromise<Hover.Info> = new CachedPromise<Hover.Info>();
    private _completionItems: CachedPromise<Completion.Item[] | null> = new CachedPromise<Completion.Item[] | null>();
    private _parameterDefinition: CachedValue<ParameterDefinition> = new CachedValue<ParameterDefinition>();
    private _variableDefinition: CachedValue<Json.Property> = new CachedValue<Json.Property>();
    private _references: CachedValue<Reference.List> = new CachedValue<Reference.List>();
    private _signatureHelp: CachedPromise<TLE.FunctionSignatureHelp> = new CachedPromise<TLE.FunctionSignatureHelp>();

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
     * To help visualize while debugging
     */
    public toString(): string {
        let docText: string = this._deploymentTemplate.documentText;
        let text = `${docText.slice(0, this.documentCharacterIndex)}<CURSOR>${docText.slice(this.documentCharacterIndex)}`;
        return text;
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

    public get jsonValue(): Json.Value {
        return this._jsonValue.getOrCacheValue(() => {
            return this._deploymentTemplate.getJSONValueAtDocumentCharacterIndex(this.documentCharacterIndex);
        });
    }

    public get jsonTokenStartIndex(): number {
        assert(!!this.jsonToken, "The jsonTokenStartIndex can only be requested when the PositionContext is inside a JSONToken.");

        // tslint:disable-next-line:no-non-null-assertion
        return this.jsonToken.span.startIndex;
    }

    public get tleInfo(): TleInfo {
        return this._tleInfo.getOrCacheValue(() => {
            const tleParseResult = this._deploymentTemplate.getTLEParseResultFromJSONToken(this.jsonToken);
            if (tleParseResult) {
                const tleCharacterIndex = this.documentCharacterIndex - this.jsonTokenStartIndex;
                const tleValue = tleParseResult.getValueAtCharacterIndex(tleCharacterIndex);
                return new TleInfo(tleParseResult, tleCharacterIndex, tleValue);
            } else {
                return null;
            }
        });
    }

    public get emptySpanAtDocumentCharacterIndex(): language.Span {
        return new language.Span(this.documentCharacterIndex, 0);
    }

    public get hoverInfo(): Promise<Hover.Info> {
        return this._hoverInfo.getOrCachePromise(async () => {
            const tleInfo = this.tleInfo;
            if (tleInfo) {
                const tleValue: TLE.Value = tleInfo.tleValue;
                if (tleValue instanceof TLE.FunctionValue) {
                    if (tleValue.nameToken.span.contains(tleInfo.tleCharacterIndex)) {
                        const functionMetadata: FunctionMetadata | undefined = await AzureRMAssets.getFunctionMetadataFromName(tleValue.nameToken.stringValue);
                        if (functionMetadata) {
                            const hoverSpan: language.Span = tleValue.nameToken.span.translate(this.jsonTokenStartIndex);
                            return new Hover.FunctionInfo(functionMetadata.name, functionMetadata.usage, functionMetadata.description, hoverSpan);
                        }
                        return null;
                    }
                } else if (tleValue instanceof TLE.StringValue) {
                    if (tleValue.isParametersArgument()) {
                        const parameterDefinition: ParameterDefinition | null = this._deploymentTemplate.getParameterDefinition(tleValue.toString());
                        if (parameterDefinition) {
                            const hoverSpan: language.Span = tleValue.getSpan().translate(this.jsonTokenStartIndex);
                            return new Hover.ParameterReferenceInfo(parameterDefinition.name.toString(), parameterDefinition.description, hoverSpan);
                        }
                    } else if (tleValue.isVariablesArgument()) {
                        const variableDefinition: Json.Property | null = this._deploymentTemplate.getVariableDefinition(tleValue.toString());
                        if (variableDefinition) {
                            const hoverSpan: language.Span = tleValue.getSpan().translate(this.jsonTokenStartIndex);
                            return new Hover.VariableReferenceInfo(variableDefinition.name.toString(), hoverSpan);
                        }
                    }
                }
            }

            return null;
        });
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
            const tleValue: TLE.Value = tleInfo.tleValue;

            if (!tleValue || !tleValue.contains(tleInfo.tleCharacterIndex)) {
                // No TLE value here. For instance, expression is empty, or before/after/on the square brackets
                if (PositionContext.isInsideSquareBrackets(tleInfo.tleParseResult, tleInfo.tleCharacterIndex)) {
                    // Inside brackets, so complete with all valid functions
                    return await PositionContext.getMatchingFunctionCompletions("", this.emptySpanAtDocumentCharacterIndex);
                } else {
                    return [];
                }

            } else if (tleValue instanceof TLE.FunctionValue) {
                return this.getFunctionValueCompletions(tleValue, tleInfo.tleCharacterIndex);
            } else if (tleValue instanceof TLE.StringValue) {
                return this.getStringLiteralCompletions(tleValue, tleInfo.tleCharacterIndex);
            } else if (tleValue instanceof TLE.PropertyAccess) {
                return await this.getPropertyAccessCompletions(tleValue, tleInfo.tleCharacterIndex);
            }

            return [];
        });
    }

    /**
     * Given position in expression is past the left square bracket and before the right square bracket,
     * *or* there is no square bracket yet
     */
    private static isInsideSquareBrackets(parseResult: TLE.ParseResult, characterIndex: number): boolean {
        const leftSquareBracketToken: TLE.Token = parseResult.leftSquareBracketToken;
        const rightSquareBracketToken: TLE.Token = parseResult.rightSquareBracketToken;

        if (leftSquareBracketToken && leftSquareBracketToken.span.afterEndIndex <= characterIndex &&
            (!rightSquareBracketToken || characterIndex <= rightSquareBracketToken.span.startIndex)) {
            return true;
        }

        return false;
    }

    /**
     * Get completions when we're anywhere inside a string literal
     */
    private getStringLiteralCompletions(tleValue: TLE.StringValue, tleCharacterIndex: number): Completion.Item[] {
        // Start at index 1 to skip past the opening single-quote.
        const prefix: string = tleValue.toString().substring(1, tleCharacterIndex - tleValue.getSpan().startIndex);

        if (tleValue.isParametersArgument()) {
            // The string is a parameter name inside a parameters('xxx') function
            return this.getMatchingParameterCompletions(prefix, tleValue, tleCharacterIndex);
        } else if (tleValue.isVariablesArgument()) {
            // The string is a variable name inside a variables('xxx') function
            return this.getMatchingVariableCompletions(prefix, tleValue, tleCharacterIndex);
        }

        return [];
    }

    /**
     * Get completions when we're anywhere inside a property accesses, e.g. "resourceGroup().prop1.prop2"
     */
    private async getPropertyAccessCompletions(tleValue: TLE.PropertyAccess, tleCharacterIndex: number): Promise<Completion.Item[]> {
        const functionSource: TLE.FunctionValue = tleValue.functionSource;
        if (functionSource) {
            let propertyPrefix: string = "";
            let replaceSpan: language.Span = this.emptySpanAtDocumentCharacterIndex;
            const propertyNameToken: TLE.Token = tleValue.nameToken;
            if (propertyNameToken) {
                replaceSpan = propertyNameToken.span.translate(this.jsonTokenStartIndex);
                propertyPrefix = propertyNameToken.stringValue.substring(0, tleCharacterIndex - propertyNameToken.span.startIndex).toLowerCase();
            }

            const variableProperty: Json.Property = this._deploymentTemplate.getVariableDefinitionFromFunction(functionSource);
            const parameterProperty: ParameterDefinition = this._deploymentTemplate.getParameterDefinitionFromFunction(functionSource);
            const sourcesNameStack: string[] = tleValue.sourcesNameStack;
            if (variableProperty) {
                // If the variable's value is an object...
                const sourceVariableDefinition: Json.ObjectValue = Json.asObjectValue(variableProperty.value);
                if (sourceVariableDefinition) {
                    return this.getDeepPropertyAccessCompletions(
                        propertyPrefix,
                        sourceVariableDefinition,
                        sourcesNameStack,
                        replaceSpan);
                }
            } else if (parameterProperty) {
                // If the parameters's default value is an object...
                const parameterDefValue: Json.ObjectValue = parameterProperty.defaultValue ? Json.asObjectValue(parameterProperty.defaultValue) : null;
                if (parameterDefValue) {
                    const sourcePropertyDefinition: Json.ObjectValue = Json.asObjectValue(parameterDefValue.getPropertyValueFromStack(sourcesNameStack));
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

                const result: Completion.Item[] = [];
                if (functionMetadataMatches && functionMetadataMatches.length === 1) {
                    const functionMetadata: FunctionMetadata = functionMetadataMatches[0];
                    for (const returnValueMember of functionMetadata.returnValueMembers) {
                        if (propertyPrefix === "" || returnValueMember.toLowerCase().startsWith(propertyPrefix)) {
                            result.push(PositionContext.createPropertyCompletionItem(returnValueMember, replaceSpan));
                        }
                    }

                    return result;
                }
            }

            return [];
        }
    }

    /**
     * Return completions when we're anywhere inside a function call expression
     */
    private async getFunctionValueCompletions(tleValue: TLE.FunctionValue, tleCharacterIndex: number): Promise<Completion.Item[]> {
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
            if (tleValue.nameToken.stringValue === "parameters" && tleValue.argumentExpressions.length === 0) {
                return this.getMatchingParameterCompletions("", tleValue, tleCharacterIndex);
            } else if (tleValue.nameToken.stringValue === "variables" && tleValue.argumentExpressions.length === 0) {
                return this.getMatchingVariableCompletions("", tleValue, tleCharacterIndex);
            } else {
                return await PositionContext.getMatchingFunctionCompletions("", this.emptySpanAtDocumentCharacterIndex);
            }
        }
    }

    private getDeepPropertyAccessCompletions(propertyPrefix: string, variableOrParameterDefinition: Json.ObjectValue, sourcesNameStack: string[], replaceSpan: language.Span): Completion.Item[] {
        const result: Completion.Item[] = [];

        const sourcePropertyDefinition: Json.ObjectValue = Json.asObjectValue(variableOrParameterDefinition.getPropertyValueFromStack(sourcesNameStack));
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

    public get references(): Reference.List | null {
        return this._references.getOrCacheValue(() => {
            let referenceName: string = null;
            let referenceType: Reference.ReferenceKind = null;

            const tleStringValue: TLE.StringValue = TLE.asStringValue(this.tleInfo && this.tleInfo.tleValue);
            if (tleStringValue) {
                referenceName = tleStringValue.toString();

                if (tleStringValue.isParametersArgument()) {
                    referenceType = Reference.ReferenceKind.Parameter;
                } else if (tleStringValue.isVariablesArgument()) {
                    referenceType = Reference.ReferenceKind.Variable;
                }
            }

            if (referenceType === null) {
                const jsonStringValue: Json.StringValue = Json.asStringValue(this.jsonValue);
                if (jsonStringValue) {
                    referenceName = jsonStringValue.toString();

                    const parameterDefinition: ParameterDefinition = this._deploymentTemplate.getParameterDefinition(referenceName);
                    if (parameterDefinition && parameterDefinition.name === jsonStringValue) {
                        referenceType = Reference.ReferenceKind.Parameter;
                    } else {
                        const variableDefinition: Json.Property = this._deploymentTemplate.getVariableDefinition(referenceName);
                        if (variableDefinition && variableDefinition.name === jsonStringValue) {
                            referenceType = Reference.ReferenceKind.Variable;
                        }
                    }
                }
            }

            if (referenceName && referenceType !== null) {
                return this._deploymentTemplate.findReferences(referenceType, referenceName);
            }

            return null;
        });
    }

    public get signatureHelp(): Promise<TLE.FunctionSignatureHelp> {
        return this._signatureHelp.getOrCachePromise(async () => {
            const tleValue: TLE.Value = this.tleInfo && this.tleInfo.tleValue;
            if (tleValue) {
                let functionToHelpWith: TLE.FunctionValue = TLE.asFunctionValue(tleValue);
                if (!functionToHelpWith) {
                    functionToHelpWith = TLE.asFunctionValue(tleValue.parent);
                }

                if (functionToHelpWith) {
                    const functionMetadata: FunctionMetadata = await AzureRMAssets.getFunctionMetadataFromName(functionToHelpWith.nameToken.stringValue);
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
     * If this PositionContext is currently at a parameter reference (inside 'parameterName' in
     * [parameters('parameterName')]), get the definition of the parameter that is being referenced.
     */
    public get parameterDefinition(): ParameterDefinition | null {
        return this._parameterDefinition.getOrCacheValue(() => {
            const tleValue: TLE.Value = this.tleInfo && this.tleInfo.tleValue;
            if (tleValue && tleValue instanceof TLE.StringValue && tleValue.isParametersArgument()) {
                return this._deploymentTemplate.getParameterDefinition(tleValue.toString());
            }

            return null;
        });
    }

    /**
     * If this PositionContext is currently at a variable reference (inside 'variableName' in
     * [variables('variableName')]), get the definition of the variable that is being referenced.
     */
    public get variableDefinition(): Json.Property | null {
        return this._variableDefinition.getOrCacheValue(() => {
            const tleValue: TLE.Value = this.tleInfo && this.tleInfo.tleValue;
            if (tleValue && tleValue instanceof TLE.StringValue && tleValue.isVariablesArgument()) {
                return this._deploymentTemplate.getVariableDefinition(tleValue.toString());
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

    private getMatchingParameterCompletions(prefix: string, tleValue: TLE.StringValue | TLE.FunctionValue, tleCharacterIndex: number): Completion.Item[] {
        const replaceSpanInfo: ReplaceSpanInfo = this.getReplaceSpanInfo(tleValue, tleCharacterIndex);

        const parameterCompletions: Completion.Item[] = [];
        const parameterDefinitionMatches: ParameterDefinition[] = this._deploymentTemplate.findParameterDefinitionsWithPrefix(prefix);
        for (const parameterDefinition of parameterDefinitionMatches) {
            const name: string = `'${parameterDefinition.name}'`;
            parameterCompletions.push(new Completion.Item(name, `${name}${replaceSpanInfo.includeRightParenthesisInCompletion ? ")" : ""}$0`, replaceSpanInfo.replaceSpan, `(parameter)`, parameterDefinition.description, Completion.CompletionKind.Parameter));
        }
        return parameterCompletions;
    }

    private getMatchingVariableCompletions(prefix: string, tleValue: TLE.StringValue | TLE.FunctionValue, tleCharacterIndex: number): Completion.Item[] {
        const replaceSpanInfo: ReplaceSpanInfo = this.getReplaceSpanInfo(tleValue, tleCharacterIndex);

        const variableCompletions: Completion.Item[] = [];
        const variableDefinitionMatches: Json.Property[] = this._deploymentTemplate.findVariableDefinitionsWithPrefix(prefix);
        for (const variableDefinition of variableDefinitionMatches) {
            const variableName: string = `'${variableDefinition.name.toString()}'`;
            variableCompletions.push(new Completion.Item(variableName, `${variableName}${replaceSpanInfo.includeRightParenthesisInCompletion ? ")" : ""}$0`, replaceSpanInfo.replaceSpan, `(variable)`, "", Completion.CompletionKind.Variable));
        }
        return variableCompletions;
    }

    private getReplaceSpanInfo(tleValue: TLE.StringValue | TLE.FunctionValue, tleCharacterIndex: number): ReplaceSpanInfo {
        let includeRightParenthesisInCompletion: boolean = true;
        let replaceSpan: language.Span;
        if (tleValue instanceof TLE.StringValue) {
            const stringSpan: language.Span = tleValue.getSpan();
            const stringStartIndex: number = stringSpan.startIndex;
            const functionValue: TLE.FunctionValue = TLE.asFunctionValue(tleValue.parent);

            const rightParenthesisIndex: number = tleValue.toString().indexOf(")");
            const rightSquareBracketIndex: number = tleValue.toString().indexOf("]");
            if (rightParenthesisIndex >= 0) {
                replaceSpan = new language.Span(stringStartIndex, rightParenthesisIndex + 1);
            } else if (rightSquareBracketIndex >= 0) {
                replaceSpan = new language.Span(stringStartIndex, rightSquareBracketIndex);
            } else if (functionValue.rightParenthesisToken && functionValue.argumentExpressions.length === 1) {
                replaceSpan = new language.Span(stringStartIndex, functionValue.rightParenthesisToken.span.afterEndIndex - stringStartIndex);
            } else {
                includeRightParenthesisInCompletion = functionValue.argumentExpressions.length <= 1;
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

class TleInfo implements ITleInfo {
    public constructor(
        public readonly tleParseResult: TLE.ParseResult,
        public readonly tleCharacterIndex: number,
        public readonly tleValue: TLE.Value | null
    ) {
    }
}
