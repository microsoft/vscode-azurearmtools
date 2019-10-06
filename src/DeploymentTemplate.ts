// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { AzureRMAssets, FunctionsMetadata } from "./AzureRMAssets";
import { CachedPromise } from "./CachedPromise";
import { CachedValue } from "./CachedValue";
import { assert } from "./fixed_assert";
import { Histogram } from "./Histogram";
import { IParameterDefinition } from "./IParameterDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import { ParameterDefinition } from "./ParameterDefinition";
import { PositionContext } from "./PositionContext";
import * as Reference from "./Reference";
import { isArmSchema } from "./supported";
import { ScopeContext, TemplateScope } from "./TemplateScope";
import * as TLE from "./TLE";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import * as FindReferencesVisitor from "./visitors/FindReferencesVisitor";
import * as FunctionCountVisitor from "./visitors/FunctionCountVisitor";
import { GenericStringVisitor } from "./visitors/GenericStringVisitor";
import * as IncorrectFunctionArgumentCountVisitor from "./visitors/IncorrectFunctionArgumentCountVisitor";
import { ReferenceInVariableDefinitionsVisitor } from "./visitors/ReferenceInVariableDefinitionsVisitor";
import { UndefinedParameterAndVariableVisitor } from "./visitors/UndefinedParameterAndVariableVisitor";
import * as UndefinedVariablePropertyVisitor from "./visitors/UndefinedVariablePropertyVisitor";
import * as UnrecognizedFunctionVisitor from "./visitors/UnrecognizedFunctionVisitor";

export class DeploymentTemplate {
    // Parse result for the template JSON document as a whole
    private _jsonParseResult: Json.ParseResult;

    // The top-level parameters and variables (as opposed to those in user functions and deployment resources)
    private _topLevelScope: TemplateScope;

    // The JSON node for the top-level JSON object (if the JSON is not empty or malformed)
    private _topLevelValue: Json.ObjectValue | null;

    // A map from all JSON string value nodes to their cached TLE parse results
    private _jsonStringValueToTleParseResultMap: CachedValue<Map<Json.StringValue, TLE.ParseResult>> = new CachedValue<Map<Json.StringValue, TLE.ParseResult>>();

    // Cached errors and warnings in the template
    private _errors: CachedPromise<language.Issue[]> = new CachedPromise<language.Issue[]>();
    private _warnings: CachedValue<language.Issue[]> = new CachedValue<language.Issue[]>();

    private _topLevelNamespaceDefinitions: CachedValue<UserFunctionNamespaceDefinition[]> = new CachedValue<UserFunctionNamespaceDefinition[]>();
    private _topLevelVariableDefinitions: CachedValue<Json.Property[]> = new CachedValue<Json.Property[]>();
    private _topLevelParameterDefinitions: CachedValue<ParameterDefinition[]> = new CachedValue<ParameterDefinition[]>();

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
        this._topLevelValue = Json.asObjectValue(this._jsonParseResult.value);

        this._topLevelScope = new TemplateScope(
            ScopeContext.TopLevel,
            this.getTopLevelParameterDefinitions(),
            this.getTopLevelVariableDefinitions(),
            this.getTopLevelNamespaceDefinitions(),
            'Top-level scope');
    }

    public get topLevelScope(): TemplateScope {
        return this._topLevelScope;
    }

    public hasArmSchemaUri(): boolean {
        return isArmSchema(this.schemaUri);
    }

    /**
     * Parses all JSON strings in the template, assigns them a scope, and caches the results.
     * Returns a map that maps from the Json.StringValue object to the parse result (we can't cache
     * by the string value itself because those strings could have different scopes, and I don't
     * think the save in parsing of identical strings makes keying by scope and string value worth
     * the associated cost).
     */
    private get quotedStringToTleParseResultMap(): Map<Json.StringValue, TLE.ParseResult> {
        return this._jsonStringValueToTleParseResultMap.getOrCacheValue(() => {
            const jsonStringValueToTleParseResultMap = new Map<Json.StringValue, TLE.ParseResult>();

            // First assign all strings under user functions their own scope
            for (let ns of this.getTopLevelNamespaceDefinitions()) {
                for (let member of ns.members) {
                    parseSubstrings(member.objectValue, member.scope);
                }
            }

            // All strings which have not been parsed yet will be assigned top-level scope.
            // This does not include strings which are not in the reachable Json.Value tree due to syntax or other issues.
            this.visitAllReachableStringValues(jsonStringValue => {
                if (!jsonStringValueToTleParseResultMap.has(jsonStringValue)) {
                    // Not parsed yet, parse with top-level scope
                    let tleParseResult: TLE.ParseResult = TLE.Parser.parse(jsonStringValue.quotedValue, this.topLevelScope);
                    jsonStringValueToTleParseResultMap.set(jsonStringValue, tleParseResult);
                }
            });

            return jsonStringValueToTleParseResultMap;

            // (local function) Parse all substrings of the given JSON value node
            function parseSubstrings(value: Json.Value | null, scope: TemplateScope): void {
                if (value) {
                    GenericStringVisitor.visit(
                        value,
                        jsonStringValue => {
                            if (!jsonStringValueToTleParseResultMap.has(jsonStringValue)) {
                                // Parse the string as a possible TLE expression and cache
                                let tleParseResult: TLE.ParseResult = TLE.Parser.parse(jsonStringValue.quotedValue, scope);
                                jsonStringValueToTleParseResultMap.set(jsonStringValue, tleParseResult);
                            }
                        });
                }
            }
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

    public get errorsPromise(): Promise<language.Issue[]> {
        return this._errors.getOrCachePromise(async () => {
            // tslint:disable-next-line:typedef
            return new Promise<language.Issue[]>(async (resolve, reject) => {
                try {
                    let functions: FunctionsMetadata = await AzureRMAssets.getFunctionsMetadata();
                    const parseErrors: language.Issue[] = [];

                    // Loop through each reachable string in the template
                    this.visitAllReachableStringValues(jsonStringValue => {
                        //const jsonTokenStartIndex: number = jsonQuotedStringToken.span.startIndex;
                        const jsonTokenStartIndex = jsonStringValue.span.startIndex;

                        const tleParseResult: TLE.ParseResult | null = this.getTLEParseResultFromJsonStringValue(jsonStringValue);
                        const expressionScope: TemplateScope = tleParseResult.scope;

                        for (const error of tleParseResult.errors) {
                            parseErrors.push(error.translate(jsonTokenStartIndex));
                        }

                        const tleExpression: TLE.Value | null = tleParseResult.expression;

                        // Undefined parameter/variable references
                        const tleUndefinedParameterAndVariableVisitor =
                            UndefinedParameterAndVariableVisitor.visit(
                                tleExpression,
                                tleParseResult.scope);
                        for (const error of tleUndefinedParameterAndVariableVisitor.errors) {
                            parseErrors.push(error.translate(jsonTokenStartIndex));
                        }

                        // Unrecognized function calls
                        const tleUnrecognizedFunctionVisitor = UnrecognizedFunctionVisitor.UnrecognizedFunctionVisitor.visit(expressionScope, tleExpression, functions);
                        for (const error of tleUnrecognizedFunctionVisitor.errors) {
                            parseErrors.push(error.translate(jsonTokenStartIndex));
                        }

                        // Incorrect number of function arguments
                        const tleIncorrectArgumentCountVisitor = IncorrectFunctionArgumentCountVisitor.IncorrectFunctionArgumentCountVisitor.visit(tleExpression, functions, expressionScope);
                        for (const error of tleIncorrectArgumentCountVisitor.errors) {
                            parseErrors.push(error.translate(jsonTokenStartIndex));
                        }

                        // Undefined variable properties
                        const tleUndefinedVariablePropertyVisitor = UndefinedVariablePropertyVisitor.UndefinedVariablePropertyVisitor.visit(tleExpression, expressionScope);
                        for (const error of tleUndefinedVariablePropertyVisitor.errors) {
                            parseErrors.push(error.translate(jsonTokenStartIndex));
                        }
                    });

                    const deploymentTemplateObject: Json.ObjectValue | null = Json.asObjectValue(this.jsonParseResult.value);
                    if (deploymentTemplateObject) {
                        const variablesObject: Json.ObjectValue | null = Json.asObjectValue(deploymentTemplateObject.getPropertyValue("variables"));
                        if (variablesObject) {
                            const referenceInVariablesFinder = new ReferenceInVariableDefinitionsVisitor(this);
                            variablesObject.accept(referenceInVariablesFinder);

                            // Can't call reference() inside variable definitions
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
        return this._warnings.getOrCacheValue(() => {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: Find unused namespaces/functions
            return this.findUnusedParameters().concat(this.findUnusedVariables());
        });
    }

    private findUnusedVariables(): language.Issue[] {
        const warnings: language.Issue[] = [];

        for (const variableDefinition of this.getTopLevelVariableDefinitions()) {
            // Variables are only supported at the top level
            const variableReferences: Reference.List = this.findReferences(Reference.ReferenceKind.Variable, variableDefinition.name.toString(), this.topLevelScope);
            if (variableReferences.length === 1) {
                warnings.push(
                    new language.Issue(variableDefinition.name.span, `The variable '${variableDefinition.name.toString()}' is never used.`));
            }
        }

        return warnings;
    }

    private findUnusedParameters(): language.Issue[] {
        const warnings: language.Issue[] = [];

        // Top-level parameters
        for (const parameterDefinition of this.topLevelScope.parameterDefinitions) {
            const parameterReferences: Reference.List =
                this.findReferences(Reference.ReferenceKind.Parameter, parameterDefinition.name.toString(), this.topLevelScope);
            if (parameterReferences.length === 1) {
                warnings.push(
                    new language.Issue(parameterDefinition.name.span, `The parameter '${parameterDefinition.name.toString()}' is never used.`));
            }
        }

        // User function parameters
        for (const ns of this.topLevelScope.namespaceDefinitions) {
            for (const member of ns.members) {
                for (const parameterDefinition of member.parameterDefinitions) {
                    const parameterReferences: Reference.List =
                        this.findReferences(Reference.ReferenceKind.Parameter, parameterDefinition.name.toString(), member.scope);
                    if (parameterReferences.length === 1) {
                        warnings.push(
                            new language.Issue(parameterDefinition.name.span, `The parameter '${parameterDefinition.name.toString()}' of function '${member.fullName}' is never used.`));
                    }
                }
            }
        }

        return warnings;
    }

    /**
     * Gets a history of function usage, useful for telemetry
     */
    public getFunctionCounts(): Histogram {
        const functionCounts = new Histogram();

        if (this.jsonParseResult.value) {
            GenericStringVisitor.visit(
                this.jsonParseResult.value,
                (stringValue: Json.StringValue): void => {
                    const tleParseResult = this.getTLEParseResultFromJsonStringValue(stringValue);
                    let tleFunctionCountVisitor = FunctionCountVisitor.FunctionCountVisitor.visit(tleParseResult.expression);
                    functionCounts.add(tleFunctionCountVisitor.functionCounts);
                });
        }

        return functionCounts;
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

    private getTopLevelParameterDefinitions(): ParameterDefinition[] {
        return this._topLevelParameterDefinitions.getOrCacheValue(() => {
            const parameterDefinitions: ParameterDefinition[] = [];

            if (this._topLevelValue) {
                const parameters: Json.ObjectValue | null = Json.asObjectValue(this._topLevelValue.getPropertyValue("parameters"));
                if (parameters) {
                    for (const parameter of parameters.properties) {
                        parameterDefinitions.push(new ParameterDefinition(parameter));
                    }
                }
            }

            return parameterDefinitions;
        });
    }

    private getTopLevelVariableDefinitions(): Json.Property[] {
        return this._topLevelVariableDefinitions.getOrCacheValue(() => {
            if (this._topLevelValue) {
                const variables: Json.ObjectValue | null = Json.asObjectValue(this._topLevelValue.getPropertyValue("variables"));
                if (variables) {
                    return variables.properties;
                }
            }

            return [];
        });
    }

    private getTopLevelNamespaceDefinitions(): UserFunctionNamespaceDefinition[] {
        return this._topLevelNamespaceDefinitions.getOrCacheValue(() => {
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

            if (this._topLevelValue) {
                const functionNamespacesArray: Json.ArrayValue | null = Json.asArrayValue(this._topLevelValue.getPropertyValue("functions"));
                if (functionNamespacesArray) {
                    for (let namespaceElement of functionNamespacesArray.elements) {
                        const namespaceObject = Json.asObjectValue(namespaceElement);
                        if (namespaceObject) {
                            let namespace = UserFunctionNamespaceDefinition.createIfValid(namespaceObject);
                            if (namespace) {
                                namespaceDefinitions.push(namespace);
                            }
                        }
                    }
                }
            }

            return namespaceDefinitions;
        });
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

    /**
     * Get the TLE parse results from this JSON string.
     */
    public getTLEParseResultFromJsonStringValue(jsonStringValue: Json.StringValue): TLE.ParseResult {
        const result = this.quotedStringToTleParseResultMap.get(jsonStringValue);
        if (result) {
            return result;
        }

        // This string must not be in the reachable Json.Value tree due to syntax or other issues which
        //   the language server should show in our diagnostics.
        // Go ahead and parse it now, pretending it has top-level scope
        const tleParseResult = TLE.Parser.parse(jsonStringValue.quotedValue, this.topLevelScope);
        this.quotedStringToTleParseResultMap.set(jsonStringValue, tleParseResult);
        return tleParseResult;
    }

    public findReferences(referenceType: Reference.ReferenceKind, referenceName: string, scope: TemplateScope): Reference.List {
        const result: Reference.List = new Reference.List(referenceType);

        if (referenceName) {
            // Add the parameter/variable definition to the list
            switch (referenceType) {
                case Reference.ReferenceKind.Parameter:
                    const parameterDefinition: IParameterDefinition | null = scope.getParameterDefinition(referenceName);
                    if (parameterDefinition) {
                        result.add(parameterDefinition.name.unquotedSpan);
                    }
                    break;

                case Reference.ReferenceKind.Variable:
                    const variableDefinition: Json.Property | null = scope.getVariableDefinition(referenceName);
                    if (variableDefinition) {
                        result.add(variableDefinition.name.unquotedSpan);
                    }
                    break;

                default:
                    assert.fail(`Unrecognized Reference.Kind: ${referenceType}`);
                    break;
            }

            // Add references to the list that match the scope we're looking for
            this.visitAllReachableStringValues(jsonStringValue => {
                const tleParseResult: TLE.ParseResult | null = this.getTLEParseResultFromJsonStringValue(jsonStringValue);
                if (tleParseResult.expression && tleParseResult.scope === scope) {
                    const visitor = FindReferencesVisitor.FindReferencesVisitor.visit(tleParseResult.expression, referenceType, referenceName);
                    result.addAll(visitor.references.translate(jsonStringValue.span.startIndex));
                }
            });
        }

        return result;
    }

    private visitAllReachableStringValues(onStringValue: (stringValue: Json.StringValue) => void): void {
        let value = this._topLevelValue;
        if (value) {
            GenericStringVisitor.visit(value, onStringValue);
        }
    }
}
