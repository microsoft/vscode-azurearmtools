// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import * as Completion from "./Completion";
import * as Hover from "./Hover";
import * as Json from "./JSON";
import * as language from "./Language";
import * as Reference from "./Reference";
import * as TLE from "./TLE";
import * as Utilities from "./Utilities";

import { AzureRMAssets, FunctionMetadata } from "./AzureRMAssets";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ParameterDefinition } from "./ParameterDefinition";

export class PositionContext {
    private _deploymentTemplate: DeploymentTemplate;
    private _documentPosition: language.Position;
    private _documentCharacterIndex: number;
    private _tleCharacterIndex: number;
    private _jsonToken: Json.Token;
    private _jsonValue: Json.Value;
    private _tleParseResult: TLE.ParseResult;
    private _tleToken: TLE.Token;
    private _tleValue: TLE.Value;
    private _hoverInfo: Promise<Hover.Info>;
    private _completionItems: Promise<Completion.Item[]>;
    private _parameterDefinition: ParameterDefinition;
    private _variableDefinition: Json.Property;
    private _references: Reference.List;
    private _signatureHelp: Promise<TLE.FunctionSignatureHelp>;

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
        context._documentPosition = new language.Position(documentLineIndex, documentColumnIndex);
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
        context._documentCharacterIndex = documentCharacterIndex;
        return context;
    }

    public get documentPosition(): language.Position {
        if (this._documentPosition === undefined) {
            assert(this._documentCharacterIndex, "The documentPosition can only be generated if the documentCharacterIndex exists.");

            this._documentPosition = this._deploymentTemplate.getDocumentPosition(this.documentCharacterIndex);
        }
        return this._documentPosition;
    }

    public get documentLineIndex(): number {
        return this.documentPosition.line;
    }

    public get documentColumnIndex(): number {
        return this.documentPosition.column;
    }

    public get documentCharacterIndex(): number {
        if (this._documentCharacterIndex === undefined) {
            this._documentCharacterIndex = this._deploymentTemplate.getDocumentCharacterIndex(this.documentLineIndex, this.documentColumnIndex);
        }
        return this._documentCharacterIndex;
    }

    public get jsonToken(): Json.Token {
        if (this._jsonToken === undefined) {
            this._jsonToken = this._deploymentTemplate.getJSONTokenAtDocumentCharacterIndex(this.documentCharacterIndex);
        }
        return this._jsonToken;
    }

    public get jsonValue(): Json.Value {
        if (this._jsonValue === undefined) {
            this._jsonValue = this._deploymentTemplate.getJSONValueAtDocumentCharacterIndex(this.documentCharacterIndex);
        }
        return this._jsonValue;
    }

    public get jsonTokenStartIndex(): number {
        assert(this.jsonToken !== null, "The jsonTokenStartIndex can only be requested when the PositionContext is inside a JSONToken.");

        return this.jsonToken.span.startIndex;
    }

    public get tleParseResult(): TLE.ParseResult {
        if (this._tleParseResult === undefined) {
            this._tleParseResult = this._deploymentTemplate.getTLEParseResultFromJSONToken(this.jsonToken);
        }
        return this._tleParseResult;
    }

    public get tleCharacterIndex(): number {
        if (this._tleCharacterIndex === undefined) {
            this._tleCharacterIndex = this.tleParseResult ? this.documentCharacterIndex - this.jsonTokenStartIndex : null;
        }
        return this._tleCharacterIndex;
    }

    public get emptySpanAtDocumentCharacterIndex(): language.Span {
        return new language.Span(this.documentCharacterIndex, 0);
    }

    public get tleValue(): TLE.Value {
        if (this._tleValue === undefined) {
            this._tleValue = this.tleParseResult ? this.tleParseResult.getValueAtCharacterIndex(this.tleCharacterIndex) : null;
        }
        return this._tleValue;
    }

    public get hoverInfo(): Promise<Hover.Info> {
        if (this._hoverInfo === undefined) {
            this._hoverInfo = Promise.resolve(null);

            if (this.tleParseResult !== null) {
                const tleValue: TLE.Value = this.tleValue;
                if (tleValue instanceof TLE.FunctionValue) {
                    if (tleValue.nameToken.span.contains(this.tleCharacterIndex)) {
                        this._hoverInfo = AzureRMAssets.getFunctionMetadataFromName(tleValue.nameToken.stringValue)
                            .then((functionMetadata: FunctionMetadata) => {
                                let result: Hover.FunctionInfo = null;
                                if (functionMetadata) {
                                    const hoverSpan: language.Span = tleValue.nameToken.span.translate(this.jsonTokenStartIndex);
                                    result = new Hover.FunctionInfo(functionMetadata.name, functionMetadata.usage, functionMetadata.description, hoverSpan);
                                }
                                return result;
                            });
                    }
                }
                else if (tleValue instanceof TLE.StringValue) {
                    if (tleValue.isParametersArgument()) {
                        const parameterDefinition: ParameterDefinition = this._deploymentTemplate.getParameterDefinition(this.tleValue.toString());
                        if (parameterDefinition) {
                            const hoverSpan: language.Span = tleValue.getSpan().translate(this.jsonTokenStartIndex);
                            this._hoverInfo = Promise.resolve(new Hover.ParameterReferenceInfo(parameterDefinition.name.toString(), parameterDefinition.description, hoverSpan));
                        }
                    }
                    else if (tleValue.isVariablesArgument()) {
                        const variableDefinition: Json.Property = this._deploymentTemplate.getVariableDefinition(this.tleValue.toString());
                        if (variableDefinition) {
                            const hoverSpan: language.Span = tleValue.getSpan().translate(this.jsonTokenStartIndex);
                            this._hoverInfo = Promise.resolve(new Hover.VariableReferenceInfo(variableDefinition.name.toString(), hoverSpan));
                        }
                    }
                }
            }
        }
        return this._hoverInfo;
    }

    public get completionItems(): Promise<Completion.Item[]> {
        if (this._completionItems === undefined) {
            this._completionItems = Promise.resolve([]);

            if (this.tleParseResult) {
                const tleValue: TLE.Value = this.tleValue;

                if (!tleValue || !tleValue.contains(this.tleCharacterIndex)) {
                    const leftSquareBracketToken: TLE.Token = this.tleParseResult.leftSquareBracketToken;
                    const rightSquareBracketToken: TLE.Token = this.tleParseResult.rightSquareBracketToken;

                    if (leftSquareBracketToken && leftSquareBracketToken.span.afterEndIndex <= this.tleCharacterIndex &&
                        (!rightSquareBracketToken || this.tleCharacterIndex <= rightSquareBracketToken.span.startIndex)) {

                        this._completionItems = PositionContext.getFunctionCompletions("", this.emptySpanAtDocumentCharacterIndex);
                    }
                }
                else if (tleValue instanceof TLE.FunctionValue) {
                    if (tleValue.nameToken.span.contains(this.tleCharacterIndex, true)) {
                        // If the caret is inside the TLE function's name
                        const functionNameStartIndex: number = tleValue.nameToken.span.startIndex;
                        const functionNamePrefix: string = tleValue.nameToken.stringValue.substring(0, this.tleCharacterIndex - functionNameStartIndex);

                        let replaceSpan: language.Span;
                        if (functionNamePrefix.length === 0) {
                            replaceSpan = this.emptySpanAtDocumentCharacterIndex;
                        }
                        else {
                            replaceSpan = tleValue.nameToken.span.translate(this.jsonTokenStartIndex);
                        }

                        this._completionItems = PositionContext.getFunctionCompletions(functionNamePrefix, replaceSpan);
                    }
                    // If the caret is between the function name and the left parenthesis
                    else if (tleValue.leftParenthesisToken && this.tleCharacterIndex <= tleValue.leftParenthesisToken.span.startIndex) {
                        this._completionItems = PositionContext.getFunctionCompletions("", this.emptySpanAtDocumentCharacterIndex);
                    }
                    else {
                        if (tleValue.nameToken.stringValue === "parameters" && tleValue.argumentExpressions.length === 0) {
                            this._completionItems = Promise.resolve(this.getParameterCompletions("", tleValue));
                        }
                        else if (tleValue.nameToken.stringValue === "variables" && tleValue.argumentExpressions.length === 0) {
                            this._completionItems = Promise.resolve(this.getVariableCompletions("", tleValue));
                        }
                        else {
                            this._completionItems = PositionContext.getFunctionCompletions("", this.emptySpanAtDocumentCharacterIndex);
                        }
                    }
                }
                else if (tleValue instanceof TLE.StringValue) {
                    // Start at index 1 to skip past the opening single-quote.
                    const prefix: string = tleValue.toString().substring(1, this.tleCharacterIndex - tleValue.getSpan().startIndex);

                    if (tleValue.isParametersArgument()) {
                        this._completionItems = Promise.resolve(this.getParameterCompletions(prefix, tleValue));
                    }
                    else if (tleValue.isVariablesArgument()) {
                        this._completionItems = Promise.resolve(this.getVariableCompletions(prefix, tleValue));
                    }
                }
                else if (tleValue instanceof TLE.PropertyAccess) {
                    const functionSource: TLE.FunctionValue = tleValue.functionSource;
                    if (functionSource) {

                        let propertyPrefix: string = "";
                        let replaceSpan: language.Span = this.emptySpanAtDocumentCharacterIndex;
                        const propertyNameToken: TLE.Token = tleValue.nameToken;
                        if (propertyNameToken) {
                            replaceSpan = propertyNameToken.span.translate(this.jsonTokenStartIndex);
                            propertyPrefix = propertyNameToken.stringValue.substring(0, this.tleCharacterIndex - propertyNameToken.span.startIndex).toLowerCase();
                        }

                        const variableProperty: Json.Property = this._deploymentTemplate.getVariableDefinitionFromFunction(functionSource);
                        const sourcesNameStack: string[] = tleValue.sourcesNameStack;
                        if (variableProperty) {

                            const variableDefinition: Json.ObjectValue = Json.asObjectValue(variableProperty.value);
                            if (variableDefinition) {

                                const sourcePropertyDefinition: Json.ObjectValue = Json.asObjectValue(variableDefinition.getPropertyValueFromStack(sourcesNameStack));
                                if (sourcePropertyDefinition) {

                                    let matchingPropertyNames: string[];
                                    if (!propertyPrefix) {
                                        matchingPropertyNames = sourcePropertyDefinition.propertyNames;
                                    }
                                    else {
                                        matchingPropertyNames = [];
                                        for (const propertyName of sourcePropertyDefinition.propertyNames) {
                                            if (propertyName.startsWith(propertyPrefix)) {
                                                matchingPropertyNames.push(propertyName);
                                            }
                                        }
                                    }

                                    const result: Completion.Item[] = [];
                                    for (const matchingPropertyName of matchingPropertyNames) {
                                        result.push(PositionContext.createPropertyCompletionItem(matchingPropertyName, replaceSpan));
                                    }

                                    this._completionItems = Promise.resolve(result);
                                }
                            }
                        }
                        else if (sourcesNameStack.length === 0) {
                            // We don't allow multiple levels of property access
                            // (resourceGroup().prop1.prop2) on functions other than variables.
                            const functionName: string = functionSource.nameToken.stringValue;
                            this._completionItems = AzureRMAssets.getFunctionMetadataFromPrefix(functionName)
                                .then((functionMetadataMatches: FunctionMetadata[]) => {
                                    const result: Completion.Item[] = [];

                                    if (functionMetadataMatches && functionMetadataMatches.length === 1) {
                                        const functionMetadata: FunctionMetadata = functionMetadataMatches[0];
                                        for (const returnValueMember of functionMetadata.returnValueMembers) {
                                            if (propertyPrefix === "" || returnValueMember.toLowerCase().startsWith(propertyPrefix)) {
                                                result.push(PositionContext.createPropertyCompletionItem(returnValueMember, replaceSpan));
                                            }
                                        }
                                    }

                                    return result;
                                });
                        }
                    }
                }
            }
        }

        return this._completionItems;
    }

    private static createPropertyCompletionItem(propertyName: string, replaceSpan: language.Span): Completion.Item {
        return new Completion.Item(propertyName, `${propertyName}$0`, replaceSpan, "(property)", "", Completion.CompletionKind.Property);
    }

    public get references(): Reference.List {
        if (this._references === undefined) {
            this._references = null;

            let referenceName: string = null;
            let referenceType: Reference.ReferenceKind = null;

            const tleStringValue: TLE.StringValue = TLE.asStringValue(this.tleValue);
            if (tleStringValue) {
                referenceName = tleStringValue.toString();

                if (tleStringValue.isParametersArgument()) {
                    referenceType = Reference.ReferenceKind.Parameter;
                }
                else if (tleStringValue.isVariablesArgument()) {
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
                    }
                    else {
                        const variableDefinition: Json.Property = this._deploymentTemplate.getVariableDefinition(referenceName);
                        if (variableDefinition && variableDefinition.name === jsonStringValue) {
                            referenceType = Reference.ReferenceKind.Variable;
                        }
                    }
                }
            }

            if (referenceName && referenceType !== null) {
                this._references = this._deploymentTemplate.findReferences(referenceType, referenceName);
            }
        }
        return this._references;
    }

    public get signatureHelp(): Promise<TLE.FunctionSignatureHelp> {
        if (this._signatureHelp === undefined) {
            this._signatureHelp = Promise.resolve(null);

            const value: TLE.Value = this.tleValue;
            if (value) {
                let functionToHelpWith: TLE.FunctionValue = TLE.asFunctionValue(value);
                if (!functionToHelpWith) {
                    functionToHelpWith = TLE.asFunctionValue(value.parent);
                }

                if (functionToHelpWith) {
                    this._signatureHelp = AzureRMAssets.getFunctionMetadataFromName(functionToHelpWith.nameToken.stringValue)
                        .then((functionMetadata: FunctionMetadata) => {
                            let result: TLE.FunctionSignatureHelp = null;
                            if (functionMetadata) {
                                let currentArgumentIndex: number = 0;

                                for (const commaToken of functionToHelpWith.commaTokens) {
                                    if (commaToken.span.startIndex < this.tleCharacterIndex) {
                                        ++currentArgumentIndex;
                                    }
                                }

                                const functionMetadataParameters: string[] = functionMetadata.parameters;
                                if (functionMetadataParameters.length > 0 &&
                                    functionMetadataParameters.length <= currentArgumentIndex &&
                                    functionMetadataParameters[functionMetadataParameters.length - 1].endsWith("...")) {

                                    currentArgumentIndex = functionMetadataParameters.length - 1;
                                }

                                result = new TLE.FunctionSignatureHelp(currentArgumentIndex, functionMetadata);
                            }
                            return result;
                        });
                }
            }
        }
        return this._signatureHelp;
    }

    private getParametersOrVariablesReplaceSpanInEmptyArgumentList(tleValue: TLE.FunctionValue): language.Span {
        let replaceSpan: language.Span;
        if (tleValue.rightParenthesisToken) {
            replaceSpan = new language.Span(this.documentCharacterIndex, tleValue.rightParenthesisToken.span.startIndex - this.tleCharacterIndex + 1);
        }
        else {
            replaceSpan = this.emptySpanAtDocumentCharacterIndex;
        }
        return replaceSpan;
    }

    /**
     * If this PositionContext is currently at a parameter reference (inside 'parameterName' in
     * [parameters('parameterName')]), get the definition of the parameter that is being referenced.
     */
    public get parameterDefinition(): ParameterDefinition {
        if (this._parameterDefinition === undefined) {
            this._parameterDefinition = null;

            const tleValue: TLE.Value = this.tleValue;
            if (tleValue && tleValue instanceof TLE.StringValue && tleValue.isParametersArgument()) {
                this._parameterDefinition = this._deploymentTemplate.getParameterDefinition(tleValue.toString());
            }
        }
        return this._parameterDefinition;
    }

    /**
     * If this PositionContext is currently at a variable reference (inside 'variableName' in
     * [variables('variableName')]), get the definition of the variable that is being referenced.
     */
    public get variableDefinition(): Json.Property {
        if (this._variableDefinition === undefined) {
            this._variableDefinition = null;

            const tleValue: TLE.Value = this.tleValue;
            if (tleValue && tleValue instanceof TLE.StringValue && tleValue.isVariablesArgument()) {
                this._variableDefinition = this._deploymentTemplate.getVariableDefinition(tleValue.toString());
            }
        }
        return this._variableDefinition;
    }

    private static async getFunctionCompletions(prefix: string, replaceSpan: language.Span): Promise<Completion.Item[]> {
        let functionMetadataMatches: FunctionMetadata[];
        if (prefix === "") {
            functionMetadataMatches = (await AzureRMAssets.getFunctionsMetadata()).functionMetadata;
        }
        else {
            functionMetadataMatches = (await AzureRMAssets.getFunctionMetadataFromPrefix(prefix));
        }

        const completionItems: Completion.Item[] = [];
        for (const functionMetadata of functionMetadataMatches) {
            const name: string = functionMetadata.name;

            let insertText: string = name;
            if (functionMetadata.maximumArguments === 0) {
                insertText += "()$0";
            }
            else {
                insertText += "($0)";
            }

            completionItems.push(new Completion.Item(name, insertText, replaceSpan, `(function) ${functionMetadata.usage}`, functionMetadata.description, Completion.CompletionKind.Function));
        }
        return completionItems;
    }

    private getParameterCompletions(prefix: string, tleValue: TLE.StringValue | TLE.FunctionValue): Completion.Item[] {
        const replaceSpanInfo: ReplaceSpanInfo = this.getReplaceSpanInfo(tleValue);

        const parameterCompletions: Completion.Item[] = [];
        const parameterDefinitionMatches: ParameterDefinition[] = this._deploymentTemplate.findParameterDefinitionsWithPrefix(prefix);
        for (const parameterDefinition of parameterDefinitionMatches) {
            const name: string = `'${parameterDefinition.name}'`;
            parameterCompletions.push(new Completion.Item(name, `${name}${replaceSpanInfo.includeRightParenthesisInCompletion ? ")" : ""}$0`, replaceSpanInfo.replaceSpan, `(parameter)`, parameterDefinition.description, Completion.CompletionKind.Parameter));
        }
        return parameterCompletions;
    }

    private getVariableCompletions(prefix: string, tleValue: TLE.StringValue | TLE.FunctionValue): Completion.Item[] {
        const replaceSpanInfo: ReplaceSpanInfo = this.getReplaceSpanInfo(tleValue);

        const variableCompletions: Completion.Item[] = [];
        const variableDefinitionMatches: Json.Property[] = this._deploymentTemplate.findVariableDefinitionsWithPrefix(prefix);
        for (const variableDefinition of variableDefinitionMatches) {
            const variableName: string = `'${variableDefinition.name.toString()}'`;
            variableCompletions.push(new Completion.Item(variableName, `${variableName}${replaceSpanInfo.includeRightParenthesisInCompletion ? ")" : ""}$0`, replaceSpanInfo.replaceSpan, `(variable)`, "", Completion.CompletionKind.Variable));
        }
        return variableCompletions;
    }

    private getReplaceSpanInfo(tleValue: TLE.StringValue | TLE.FunctionValue): ReplaceSpanInfo {
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
            }
            else if (rightSquareBracketIndex >= 0) {
                replaceSpan = new language.Span(stringStartIndex, rightSquareBracketIndex);
            }
            else if (functionValue.rightParenthesisToken && functionValue.argumentExpressions.length === 1) {
                replaceSpan = new language.Span(stringStartIndex, functionValue.rightParenthesisToken.span.afterEndIndex - stringStartIndex);
            }
            else {
                includeRightParenthesisInCompletion = functionValue.argumentExpressions.length <= 1;
                replaceSpan = stringSpan;
            }

            replaceSpan = replaceSpan.translate(this.jsonTokenStartIndex);
        }
        else {
            if (tleValue.rightParenthesisToken) {
                replaceSpan = new language.Span(this.documentCharacterIndex, tleValue.rightParenthesisToken.span.startIndex - this.tleCharacterIndex + 1);
            }
            else {
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
