// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { AzureRMAssets, FunctionsMetadata } from "./AzureRMAssets";
import { CachedPromise } from "./CachedPromise";
import { CachedValue } from "./CachedValue";
import { Histogram } from "./Histogram";
import * as Json from "./JSON";
import * as language from "./Language";
import { ParameterDefinition } from "./ParameterDefinition";
import { PositionContext } from "./PositionContext";
import * as Reference from "./Reference";
import { isArmSchema } from "./supported";
import * as TLE from "./TLE";
import * as Utilities from "./Utilities";

export class DeploymentTemplate {
    private _jsonParseResult: Json.ParseResult;
    private _jsonQuotedStringTokens: Json.Token[];
    private _quotedStringToTleParseResultMap: { [key: string]: TLE.ParseResult };
    private _tleParseResults: CachedValue<TLE.ParseResult[]> = new CachedValue<TLE.ParseResult[]>();
    private _parameterDefinitions: CachedValue<ParameterDefinition[]> = new CachedValue<ParameterDefinition[]>();
    private _variableDefinitions: CachedValue<Json.Property[]> = new CachedValue<Json.Property[]>();
    private _namespaceDefinitions: Json.Value[];
    private _errors: CachedPromise<language.Issue[]> = new CachedPromise<language.Issue[]>();
    private _warnings: language.Issue[];
    private _functionCounts: Histogram;
    private _schemaUri: CachedValue<string | null> = new CachedValue<string | null>();

    /**
     * Create a new DeploymentTemplate object.
     *
     * @param _documentText The string text of the document.
     * @param _documentId A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(private _documentText: string, private _documentId: string) {
        assert(_documentText !== null);
        assert(_documentText !== undefined);
        assert(_documentId);

        this._jsonParseResult = Json.parse(_documentText);
    }

    public hasArmSchemaUri(): boolean {
        return isArmSchema(this.schemaUri);
    }

    private get jsonQuotedStringTokens(): Json.Token[] {
        if (this._jsonQuotedStringTokens === undefined) {
            this._jsonQuotedStringTokens = [];

            for (const jsonToken of this._jsonParseResult.tokens) {
                if (jsonToken.type === Json.TokenType.QuotedString) {
                    this._jsonQuotedStringTokens.push(jsonToken);
                }
            }
        }
        return this._jsonQuotedStringTokens;
    }

    private get quotedStringToTleParseResultMap(): { [key: string]: TLE.ParseResult } {
        if (this._quotedStringToTleParseResultMap === undefined) {
            this._quotedStringToTleParseResultMap = {};

            for (let jsonQuotedStringToken of this.jsonQuotedStringTokens) {
                let tleParseResult: TLE.ParseResult = TLE.Parser.parse(jsonQuotedStringToken.toString());
                this._quotedStringToTleParseResultMap[jsonQuotedStringToken.toString()] = tleParseResult;
            }
        }
        return this._quotedStringToTleParseResultMap;
    }

    private get tleParseResults(): TLE.ParseResult[] {
        return this._tleParseResults.getOrCacheValue(() => {
            const results: TLE.ParseResult[] = [];

            // tslint:disable-next-line:forin no-for-in // Grandfathered in
            for (let quotedString in this.quotedStringToTleParseResultMap) {
                results.push(this.quotedStringToTleParseResultMap[quotedString]);
            }

            return results;
        });
    }

    /**
     * Get the document text as a string.
     */
    public get documentText(): string {
        return this._documentText;
    }

    /**
     * The unique identifier for this deployment template. Usually this will be a URI to the document.
     */
    public get documentId(): string {
        return this._documentId;
    }

    public get schemaUri(): string | null {
        return this._schemaUri.getOrCacheValue(() => {
            const value: Json.ObjectValue | null = Json.asObjectValue(this._jsonParseResult.value);
            if (value) {
                const schema: Json.Value | null = Json.asStringValue(value.getPropertyValue("$schema"));
                if (schema) {
                    return schema.toString();
                }
            }

            return null;
        });
    }

    public get errors(): Promise<language.Issue[]> {
        return this._errors.getOrCachePromise(async () => {
            // tslint:disable-next-line:typedef
            return new Promise<language.Issue[]>(async (resolve, reject) => {
                try {
                    let functions: FunctionsMetadata = await AzureRMAssets.getFunctionsMetadata();
                    const parseErrors: language.Issue[] = [];
                    for (const jsonQuotedStringToken of this.jsonQuotedStringTokens) {
                        const jsonTokenStartIndex: number = jsonQuotedStringToken.span.startIndex;

                        const tleParseResult: TLE.ParseResult | null = this.getTLEParseResultFromJSONToken(jsonQuotedStringToken);
                        assert(tleParseResult);
                        if (tleParseResult) {
                            for (const error of tleParseResult.errors) {
                                parseErrors.push(error.translate(jsonTokenStartIndex));
                            }

                            const tleExpression: TLE.Value | null = tleParseResult.expression;
                            const tleUndefinedParameterAndVariableVisitor = TLE.UndefinedParameterAndVariableVisitor.visit(tleExpression, this);
                            for (const error of tleUndefinedParameterAndVariableVisitor.errors) {
                                parseErrors.push(error.translate(jsonTokenStartIndex));
                            }

                            const tleUnrecognizedFunctionVisitor = TLE.UnrecognizedFunctionVisitor.visit(tleExpression, functions);
                            for (const error of tleUnrecognizedFunctionVisitor.errors) {
                                parseErrors.push(error.translate(jsonTokenStartIndex));
                            }

                            const tleIncorrectArgumentCountVisitor = TLE.IncorrectFunctionArgumentCountVisitor.visit(tleExpression, functions);
                            for (const error of tleIncorrectArgumentCountVisitor.errors) {
                                parseErrors.push(error.translate(jsonTokenStartIndex));
                            }

                            const tleUndefinedVariablePropertyVisitor = TLE.UndefinedVariablePropertyVisitor.visit(tleExpression, this);
                            for (const error of tleUndefinedVariablePropertyVisitor.errors) {
                                parseErrors.push(error.translate(jsonTokenStartIndex));
                            }
                        }
                    }

                    const deploymentTemplateObject: Json.ObjectValue | null = Json.asObjectValue(this.jsonParseResult.value);
                    if (deploymentTemplateObject) {
                        const variablesObject: Json.ObjectValue | null = Json.asObjectValue(deploymentTemplateObject.getPropertyValue("variables"));
                        if (variablesObject) {
                            const referenceInVariablesFinder = new ReferenceInVariableDefinitionJSONVisitor(this);
                            variablesObject.accept(referenceInVariablesFinder);

                            for (const referenceSpan of referenceInVariablesFinder.referenceSpans) {
                                parseErrors.push(
                                    new language.Issue(referenceSpan, "reference() cannot be invoked inside of a variable definition."));
                            }
                        }
                    }

                    resolve(parseErrors);
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    public get warnings(): language.Issue[] {
        if (this._warnings === undefined) {
            this._warnings = [];

            for (const parameterDefinition of this.parameterDefinitions) {
                const parameterReferences: Reference.List =
                    this.findReferences(Reference.ReferenceKind.Parameter, parameterDefinition.name.toString());
                if (parameterReferences.length === 1) {
                    this._warnings.push(
                        new language.Issue(parameterDefinition.name.span, `The parameter '${parameterDefinition.name.toString()}' is never used.`));
                }
            }

            for (const variableDefinition of this.variableDefinitions) {
                const variableReferences: Reference.List = this.findReferences(Reference.ReferenceKind.Variable, variableDefinition.name.toString());
                if (variableReferences.length === 1) {
                    this._warnings.push(
                        new language.Issue(variableDefinition.name.span, `The variable '${variableDefinition.name.toString()}' is never used.`));
                }
            }
        }
        return this._warnings;
    }

    public get functionCounts(): Histogram {
        if (this._functionCounts === undefined) {
            this._functionCounts = new Histogram();

            for (let tleParseResult of this.tleParseResults) {
                let tleFunctionCountVisitor = TLE.FunctionCountVisitor.visit(tleParseResult.expression);
                this._functionCounts.add(tleFunctionCountVisitor.functionCounts);
            }
        }
        return this._functionCounts;
    }

    public get jsonParseResult(): Json.ParseResult {
        return this._jsonParseResult;
    }

    /**
     * Get the number of lines that are in the file.
     */
    public get lineCount(): number {
        return this._jsonParseResult.lineLengths.length;
    }

    /**
     * Get the maximum column index for the provided line. For the last line in the file,
     * the maximum column index is equal to the line length. For every other line in the file,
     * the maximum column index is less than the line length.
     */
    public getMaxColumnIndex(lineIndex: number): number {
        return this._jsonParseResult.getMaxColumnIndex(lineIndex);
    }

    /**
     * Get the maximum document character index for this deployment template.
     */
    public get maxCharacterIndex(): number {
        return this._jsonParseResult.maxCharacterIndex;
    }

    public get parameterDefinitions(): ParameterDefinition[] {
        return this._parameterDefinitions.getOrCacheValue(() => {
            const result: ParameterDefinition[] = [];
            const value: Json.ObjectValue | null = Json.asObjectValue(this._jsonParseResult.value);
            if (value) {
                const parameters: Json.ObjectValue | null = Json.asObjectValue(value.getPropertyValue("parameters"));
                if (parameters) {
                    for (const parameter of parameters.properties) {
                        result.push(new ParameterDefinition(parameter));
                    }
                }
            }

            return result;
        });
    }

    public get variableDefinitions(): Json.Property[] {
        return this._variableDefinitions.getOrCacheValue(() => {
            const value: Json.ObjectValue | null = Json.asObjectValue(this._jsonParseResult.value);
            if (value) {
                const variables: Json.ObjectValue | null = Json.asObjectValue(value.getPropertyValue("variables"));
                if (variables) {
                    return variables.properties;
                }
            }

            return [];
        });
    }

    // Example user-defined namespaces/functions:
    //
    // "functions": [
    //     {
    //       "namespace": "contoso",
    //       "members": {
    //         "uniqueName": {
    //           "parameters": [
    //             {
    //               "name": "namePrefix",
    //               "type": "string"
    //             }
    //           ],
    //           "output": {
    //             "type": "string",
    //             "value": "[concat(toLower(parameters('namePrefix')), uniqueString(resourceGroup().id))]"
    //           }
    //         }
    //       }
    //     }
    //   ],
    public get namespaceDefinitions(): Json.Value[] {
        if (this._namespaceDefinitions === undefined) {
            this._namespaceDefinitions = [];

            const value: Json.ObjectValue | null = Json.asObjectValue(this._jsonParseResult.value);
            if (value) {
                const namespaces: Json.ArrayValue | null = Json.asArrayValue(value.getPropertyValue("functions"));
                if (namespaces) {
                    this._namespaceDefinitions = namespaces.elements;
                }
            }
        }
        return this._namespaceDefinitions;
    }

    public getParameterDefinition(parameterName: string): ParameterDefinition | null {
        assert(parameterName, "parameterName cannot be null, undefined, or empty");

        const unquotedParameterName = Utilities.unquote(parameterName);
        let result: ParameterDefinition | null = null;

        for (const pd of this.parameterDefinitions) {
            if (pd.name.toString() === unquotedParameterName) {
                result = pd;
                break;
            }
        }

        if (!result) {
            for (const pd of this.parameterDefinitions) {
                if (pd.name.toString().toLowerCase() === unquotedParameterName.toLowerCase()) {
                    result = pd;
                    break;
                }
            }
        }

        return result;
    }

    public getVariableDefinition(variableName: string): Json.Property | null {
        assert(variableName, "variableName cannot be null, undefined, or empty");

        const unquotedVariableName = Utilities.unquote(variableName);
        let result: Json.Property | null = null;

        for (const vd of this.variableDefinitions) {
            if (vd.name.toString() === unquotedVariableName) {
                result = vd;
                break;
            }
        }

        if (!result) {
            for (const vd of this.variableDefinitions) {
                if (vd.name.toString().toLowerCase() === unquotedVariableName.toLowerCase()) {
                    result = vd;
                    break;
                }
            }
        }

        return result;
    }

    public getVariableDefinitionFromFunction(tleFunction: TLE.FunctionValue): Json.Property | null {
        assert(tleFunction);

        let result: Json.Property | null = null;

        if (tleFunction.nameToken.stringValue === "variables") {
            const variableName: TLE.StringValue | null = TLE.asStringValue(tleFunction.argumentExpressions[0]);
            if (variableName) {
                result = this.getVariableDefinition(variableName.toString());
            }
        }

        return result;
    }

    public getParameterDefinitionFromFunction(tleFunction: TLE.FunctionValue): ParameterDefinition | null {
        assert(tleFunction);

        let result: ParameterDefinition | null = null;

        if (tleFunction.nameToken.stringValue === "parameters") {
            const propertyName: TLE.StringValue | null = TLE.asStringValue(tleFunction.argumentExpressions[0]);
            if (propertyName) {
                result = this.getParameterDefinition(propertyName.toString());
            }
        }

        return result;
    }

    public findParameterDefinitionsWithPrefix(parameterNamePrefix: string): ParameterDefinition[] {
        assert(parameterNamePrefix !== null, "parameterNamePrefix cannot be null");
        assert(parameterNamePrefix !== undefined, "parameterNamePrefix cannot be undefined");

        let result: ParameterDefinition[] = [];

        if (parameterNamePrefix !== "") {
            let lowerCasedPrefix = parameterNamePrefix.toLowerCase();
            for (let parameterDefinition of this.parameterDefinitions) {
                if (parameterDefinition.name.toString().toLowerCase().startsWith(lowerCasedPrefix)) {
                    result.push(parameterDefinition);
                }
            }
        } else {
            result = this.parameterDefinitions;
        }

        return result;
    }

    public findVariableDefinitionsWithPrefix(variableNamePrefix: string): Json.Property[] {
        assert(variableNamePrefix !== null, "variableNamePrefix cannot be null");
        assert(variableNamePrefix !== undefined, "variableNamePrefix cannot be undefined");

        let result: Json.Property[];
        if (variableNamePrefix) {
            result = [];

            const lowerCasedPrefix = variableNamePrefix.toLowerCase();
            for (const variableDefinition of this.variableDefinitions) {
                if (variableDefinition.name.toString().toLowerCase().startsWith(lowerCasedPrefix)) {
                    result.push(variableDefinition);
                }
            }
        } else {
            result = this.variableDefinitions;
        }

        return result;
    }

    public getDocumentCharacterIndex(documentLineIndex: number, documentColumnIndex: number): number {
        return this._jsonParseResult.getCharacterIndex(documentLineIndex, documentColumnIndex);
    }

    public getDocumentPosition(documentCharacterIndex: number): language.Position {
        return this._jsonParseResult.getPositionFromCharacterIndex(documentCharacterIndex);
    }

    public getJSONTokenAtDocumentCharacterIndex(documentCharacterIndex: number): Json.Token | null {
        return this._jsonParseResult.getTokenAtCharacterIndex(documentCharacterIndex);
    }

    public getJSONValueAtDocumentCharacterIndex(documentCharacterIndex: number): Json.Value | null {
        return this._jsonParseResult.getValueAtCharacterIndex(documentCharacterIndex);
    }

    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number): PositionContext {
        return PositionContext.fromDocumentLineAndColumnIndexes(this, documentLineIndex, documentColumnIndex);
    }

    public getContextFromDocumentCharacterIndex(documentCharacterIndex: number): PositionContext {
        return PositionContext.fromDocumentCharacterIndex(this, documentCharacterIndex);
    }

    public getTLEParseResultFromJSONToken(jsonToken: Json.Token | null): TLE.ParseResult | null {
        return jsonToken ? this.getTLEParseResultFromString(jsonToken.toString()) : null;
    }

    public getTLEParseResultFromJSONStringValue(jsonStringValue: Json.StringValue | null): TLE.ParseResult | null {
        return jsonStringValue ? this.getTLEParseResultFromString(`"${jsonStringValue.toString()}"`) : null;
    }

    private getTLEParseResultFromString(value: string): TLE.ParseResult | null {
        let result: TLE.ParseResult | null = null;
        if (value) {
            result = this.quotedStringToTleParseResultMap[value];
            if (result === undefined) {
                result = null;
            }
        }
        return result;
    }

    public findReferences(referenceType: Reference.ReferenceKind, referenceName: string): Reference.List {
        const result: Reference.List = new Reference.List(referenceType);

        if (referenceName) {
            switch (referenceType) {
                case Reference.ReferenceKind.Parameter:
                    const parameterDefinition: ParameterDefinition | null = this.getParameterDefinition(referenceName);
                    if (parameterDefinition) {
                        result.add(parameterDefinition.name.unquotedSpan);
                    }
                    break;

                case Reference.ReferenceKind.Variable:
                    const variableDefinition: Json.Property | null = this.getVariableDefinition(referenceName);
                    if (variableDefinition) {
                        result.add(variableDefinition.name.unquotedSpan);
                    }
                    break;

                default:
                    assert.fail(`Unrecognized Reference.Kind: ${referenceType}`);
                    break;
            }

            for (const jsonStringToken of this.jsonQuotedStringTokens) {
                const tleParseResult: TLE.ParseResult | null = this.getTLEParseResultFromJSONToken(jsonStringToken);
                if (tleParseResult && tleParseResult.expression) {
                    const visitor = TLE.FindReferencesVisitor.visit(tleParseResult.expression, referenceType, referenceName);
                    result.addAll(visitor.references.translate(jsonStringToken.span.startIndex));
                }
            }
        }

        return result;
    }
}

export class ReferenceInVariableDefinitionJSONVisitor extends Json.Visitor {
    private _referenceSpans: language.Span[] = [];

    constructor(private _deploymentTemplate: DeploymentTemplate) {
        super();

        assert(_deploymentTemplate);
    }

    public get referenceSpans(): language.Span[] {
        return this._referenceSpans;
    }

    public visitStringValue(value: Json.StringValue): void {
        assert(value, "Cannot visit a null or undefined Json.StringValue.");

        const tleParseResult: TLE.ParseResult | null = this._deploymentTemplate.getTLEParseResultFromJSONStringValue(value);
        if (tleParseResult && tleParseResult.expression) {
            const tleVisitor = new ReferenceInVariableDefinitionTLEVisitor();
            tleParseResult.expression.accept(tleVisitor);

            const jsonValueStartIndex: number = value.startIndex;
            for (const tleReferenceSpan of tleVisitor.referenceSpans) {
                this._referenceSpans.push(tleReferenceSpan.translate(jsonValueStartIndex));
            }
        }
    }
}

class ReferenceInVariableDefinitionTLEVisitor extends TLE.Visitor {
    private _referenceSpans: language.Span[] = [];

    public get referenceSpans(): language.Span[] {
        return this._referenceSpans;
    }

    public visitFunction(functionValue: TLE.FunctionValue | null): void {
        if (functionValue && functionValue.nameToken.stringValue === "reference") {
            this._referenceSpans.push(functionValue.nameToken.span);
        }

        super.visitFunction(functionValue);
    }
}
