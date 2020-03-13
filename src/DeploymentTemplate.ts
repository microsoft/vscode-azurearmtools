// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { AzureRMAssets, FunctionsMetadata } from "./AzureRMAssets";
import { CachedPromise } from "./CachedPromise";
import { CachedValue } from "./CachedValue";
import { templateKeys } from "./constants";
import { DeploymentFile } from "./DeploymentFile";
import { Histogram } from "./Histogram";
import { INamedDefinition } from "./INamedDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import { ParameterDefinition } from "./ParameterDefinition";
import { PositionContext } from "./PositionContext";
import { ReferenceList } from "./ReferenceList";
import { isArmSchema } from "./schemas";
import { ScopeContext, TemplateScope } from "./TemplateScope";
import * as TLE from "./TLE";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { nonNullOrEmptyValue } from "./util/nonNull";
import { IVariableDefinition, TopLevelCopyBlockVariableDefinition, TopLevelVariableDefinition } from "./VariableDefinition";
import { FindReferencesVisitor } from "./visitors/FindReferencesVisitor";
import { FunctionCountVisitor } from "./visitors/FunctionCountVisitor";
import { GenericStringVisitor } from "./visitors/GenericStringVisitor";
import * as IncorrectFunctionArgumentCountVisitor from "./visitors/IncorrectFunctionArgumentCountVisitor";
import { ReferenceInVariableDefinitionsVisitor } from "./visitors/ReferenceInVariableDefinitionsVisitor";
import { UndefinedParameterAndVariableVisitor } from "./visitors/UndefinedParameterAndVariableVisitor";
import * as UndefinedVariablePropertyVisitor from "./visitors/UndefinedVariablePropertyVisitor";
import * as UnrecognizedFunctionVisitor from "./visitors/UnrecognizedFunctionVisitor";

export class DeploymentTemplate extends DeploymentFile {
    // The top-level parameters and variables (as opposed to those in user functions and deployment resources)
    private _topLevelScope: TemplateScope;

    // A map from all JSON string value nodes to their cached TLE parse results
    private _jsonStringValueToTleParseResultMap: CachedValue<Map<Json.StringValue, TLE.ParseResult>> = new CachedValue<Map<Json.StringValue, TLE.ParseResult>>();

    // Cached errors and warnings in the template
    private _errors: CachedPromise<language.Issue[]> = new CachedPromise<language.Issue[]>();
    private _warnings: CachedValue<language.Issue[]> = new CachedValue<language.Issue[]>();

    private _topLevelNamespaceDefinitions: CachedValue<UserFunctionNamespaceDefinition[]> = new CachedValue<UserFunctionNamespaceDefinition[]>();
    private _topLevelVariableDefinitions: CachedValue<IVariableDefinition[]> = new CachedValue<IVariableDefinition[]>();
    private _topLevelParameterDefinitions: CachedValue<ParameterDefinition[]> = new CachedValue<ParameterDefinition[]>();

    /**
     * Create a new DeploymentTemplate object.
     *
     * @param _documentText The string text of the document.
     * @param _documentId A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(documentText: string, documentId: string) {
        super(documentText, documentId);
        nonNullOrEmptyValue(documentId, "documentId");

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
            function parseSubstrings(value: Json.Value | undefined, scope: TemplateScope): void {
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

    public get errorsPromise(): Promise<language.Issue[]> {
        return this._errors.getOrCachePromise(async () => {
            // tslint:disable-next-line:typedef
            return new Promise<language.Issue[]>(async (resolve, reject) => {
                try {
                    let functions: FunctionsMetadata = AzureRMAssets.getFunctionsMetadata();
                    const parseErrors: language.Issue[] = [];

                    // Loop through each reachable string in the template
                    this.visitAllReachableStringValues(jsonStringValue => {
                        //const jsonTokenStartIndex: number = jsonQuotedStringToken.span.startIndex;
                        const jsonTokenStartIndex = jsonStringValue.span.startIndex;

                        const tleParseResult: TLE.ParseResult | undefined = this.getTLEParseResultFromJsonStringValue(jsonStringValue);
                        const expressionScope: TemplateScope = tleParseResult.scope;

                        for (const error of tleParseResult.errors) {
                            parseErrors.push(error.translate(jsonTokenStartIndex));
                        }

                        const tleExpression: TLE.Value | undefined = tleParseResult.expression;

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
                        const tleIncorrectArgumentCountVisitor = IncorrectFunctionArgumentCountVisitor.IncorrectFunctionArgumentCountVisitor.visit(tleExpression, functions);
                        for (const error of tleIncorrectArgumentCountVisitor.errors) {
                            parseErrors.push(error.translate(jsonTokenStartIndex));
                        }

                        // Undefined variable properties
                        const tleUndefinedVariablePropertyVisitor = UndefinedVariablePropertyVisitor.UndefinedVariablePropertyVisitor.visit(tleExpression, expressionScope);
                        for (const error of tleUndefinedVariablePropertyVisitor.errors) {
                            parseErrors.push(error.translate(jsonTokenStartIndex));
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
                                parseErrors.push(
                                    new language.Issue(referenceSpan, "reference() cannot be invoked inside of a variable definition.", language.IssueKind.referenceInVar));
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
            const unusedParams = this.findUnusedParameters();
            const unusedVars = this.findUnusedVariables();
            const unusedUserFuncs = this.findUnusedUserFunctions();
            return unusedParams.concat(unusedVars).concat(unusedUserFuncs);
        });
    }

    // CONSIDER: PERF: findUnused{Variables,Parameters,findUnusedNamespacesAndUserFunctions} are very inefficient}

    private findUnusedVariables(): language.Issue[] {
        const warnings: language.Issue[] = [];

        for (const variableDefinition of this.getTopLevelVariableDefinitions()) {
            // Variables are only supported at the top level
            const variableReferences: ReferenceList = this.findReferences(variableDefinition);
            if (variableReferences.length === 1) {
                warnings.push(
                    new language.Issue(variableDefinition.nameValue.span, `The variable '${variableDefinition.nameValue.toString()}' is never used.`, language.IssueKind.unusedVar));
            }
        }

        return warnings;
    }

    private findUnusedParameters(): language.Issue[] {
        const warnings: language.Issue[] = [];

        // Top-level parameters
        for (const parameterDefinition of this.topLevelScope.parameterDefinitions) {
            const parameterReferences: ReferenceList =
                this.findReferences(parameterDefinition);
            if (parameterReferences.length === 1) {
                warnings.push(
                    new language.Issue(
                        parameterDefinition.nameValue.span,
                        `The parameter '${parameterDefinition.nameValue.toString()}' is never used.`,
                        language.IssueKind.unusedParam));
            }
        }

        // User function parameters
        for (const ns of this.topLevelScope.namespaceDefinitions) {
            for (const member of ns.members) {
                for (const parameterDefinition of member.parameterDefinitions) {
                    const parameterReferences: ReferenceList =
                        this.findReferences(parameterDefinition);
                    if (parameterReferences.length === 1) {
                        warnings.push(
                            new language.Issue(
                                parameterDefinition.nameValue.span,
                                `The parameter '${parameterDefinition.nameValue.toString()}' of function '${member.fullName}' is never used.`,
                                language.IssueKind.unusedUdfParam));
                    }
                }
            }
        }

        return warnings;
    }

    private findUnusedUserFunctions(): language.Issue[] {
        const warnings: language.Issue[] = [];

        // User function parameters
        for (const ns of this.topLevelScope.namespaceDefinitions) {
            for (const member of ns.members) {
                const userFuncReferences: ReferenceList =
                    this.findReferences(member);
                if (userFuncReferences.length === 1) {
                    warnings.push(
                        new language.Issue(
                            member.nameValue.span,
                            `The user-defined function '${member.fullName}' is never used.`,
                            language.IssueKind.unusedUdf));
                }
            }
        }

        return warnings;
    }

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
                    let tleFunctionCountVisitor = FunctionCountVisitor.visit(tleParseResult.expression);
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

    private getTopLevelParameterDefinitions(): ParameterDefinition[] {
        return this._topLevelParameterDefinitions.getOrCacheValue(() => {
            const parameterDefinitions: ParameterDefinition[] = [];

            if (this.topLevelValue) {
                const parameters: Json.ObjectValue | undefined = Json.asObjectValue(this.topLevelValue.getPropertyValue(templateKeys.parameters));
                if (parameters) {
                    for (const parameter of parameters.properties) {
                        parameterDefinitions.push(new ParameterDefinition(parameter));
                    }
                }
            }

            return parameterDefinitions;
        });
    }

    private getTopLevelVariableDefinitions(): IVariableDefinition[] {
        return this._topLevelVariableDefinitions.getOrCacheValue(() => {
            if (this.topLevelValue) {
                const variables: Json.ObjectValue | undefined = Json.asObjectValue(this.topLevelValue.getPropertyValue(templateKeys.variables));
                if (variables) {
                    const varDefs: IVariableDefinition[] = [];
                    for (let prop of variables.properties) {
                        if (prop.nameValue.unquotedValue.toLowerCase() === templateKeys.loopVarCopy) {
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
                            // tslint:disable-next-line: strict-boolean-expressions
                            for (let varElement of (varsArray && varsArray.elements) || []) {
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

            if (this.topLevelValue) {
                const functionNamespacesArray: Json.ArrayValue | undefined = Json.asArrayValue(this.topLevelValue.getPropertyValue("functions"));
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

    // CONSIDER: Move this to PositionContext since PositionContext depends on DeploymentTemplate
    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number): PositionContext {
        return PositionContext.fromDocumentLineAndColumnIndexes(this, documentLineIndex, documentColumnIndex);
    }

    // CONSIDER: Move this to PositionContext since PositionContext depends on DeploymentTemplate
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

    public findReferences(definition: INamedDefinition): ReferenceList {
        const result: ReferenceList = new ReferenceList(definition.definitionKind);
        const functions: FunctionsMetadata = AzureRMAssets.getFunctionsMetadata();

        // Add the definition of whatever's being referenced to the list
        if (definition.nameValue) {
            result.add(definition.nameValue.unquotedSpan);
        }

        // Find and add references that match the definition we're looking for
        this.visitAllReachableStringValues(jsonStringValue => {
            const tleParseResult: TLE.ParseResult | undefined = this.getTLEParseResultFromJsonStringValue(jsonStringValue);
            if (tleParseResult.expression) {
                // tslint:disable-next-line:no-non-null-assertion // Guaranteed by if
                const visitor = FindReferencesVisitor.visit(tleParseResult.expression, definition, functions);
                result.addAll(visitor.references.translate(jsonStringValue.span.startIndex));
            }
        });

        return result;
    }

    private visitAllReachableStringValues(onStringValue: (stringValue: Json.StringValue) => void): void {
        let value = this.topLevelValue;
        if (value) {
            GenericStringVisitor.visit(value, onStringValue);
        }
    }
}
