// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file // Private classes are related to DeploymentTemplate implementation

import * as assert from 'assert';
import { CodeAction, CodeActionContext, CodeActionKind, Command, Range, Selection, Uri } from "vscode";
import { AzureRMAssets, FunctionsMetadata } from "./AzureRMAssets";
import { CachedValue } from "./CachedValue";
import { templateKeys } from "./constants";
import { DeploymentDocument, ResolvableCodeLens } from "./DeploymentDocument";
import { NestedTemplateCodeLen, ParameterDefinitionCodeLens, SelectParameterFileCodeLens, ShowCurrentParameterFileCodeLens } from './deploymentTemplateCodeLenses';
import { Histogram } from "./Histogram";
import { INamedDefinition } from "./INamedDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import { DeploymentParameters } from "./parameterFiles/DeploymentParameters";
import { ReferenceList } from "./ReferenceList";
import { isArmSchema } from "./schemas";
import { TemplatePositionContext } from "./TemplatePositionContext";
import { TemplateScope } from "./TemplateScope";
import { TopLevelTemplateScope } from './templateScopes';
import * as TLE from "./TLE";
import { nonNullValue } from './util/nonNull';
import { FindReferencesVisitor } from "./visitors/FindReferencesVisitor";
import { FunctionCountVisitor } from "./visitors/FunctionCountVisitor";
import { GenericStringVisitor } from "./visitors/GenericStringVisitor";
import * as IncorrectFunctionArgumentCountVisitor from "./visitors/IncorrectFunctionArgumentCountVisitor";
import { ReferenceInVariableDefinitionsVisitor } from "./visitors/ReferenceInVariableDefinitionsVisitor";
import { UndefinedParameterAndVariableVisitor } from "./visitors/UndefinedParameterAndVariableVisitor";
import * as UndefinedVariablePropertyVisitor from "./visitors/UndefinedVariablePropertyVisitor";
import * as UnrecognizedFunctionVisitor from "./visitors/UnrecognizedFunctionVisitor";

export class DeploymentTemplate extends DeploymentDocument {
    // The top-level parameters and variables (as opposed to those in user functions and deployment resources)
    private _topLevelScope: CachedValue<TemplateScope> = new CachedValue<TemplateScope>();

    // A map from all JSON string value nodes to their cached TLE parse results
    private _jsonStringValueToTleParseResultMap: CachedValue<Map<Json.StringValue, TLE.ParseResult>> = new CachedValue<Map<Json.StringValue, TLE.ParseResult>>();

    /**
     * Create a new DeploymentTemplate object.
     *
     * @param _documentText The string text of the document.
     * @param _documentId A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(documentText: string, documentId: Uri) {
        super(documentText, documentId);
    }

    public get topLevelScope(): TemplateScope {
        return this._topLevelScope.getOrCacheValue(() =>
            new TopLevelTemplateScope(
                this.topLevelValue,
                `Top-level template scope for ${this.documentId}`
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

    // CONSIDER: Should we be using scope.resources instead?
    public get resourceObjects(): Json.ArrayValue | undefined {
        if (this.topLevelValue) {
            return this.topLevelValue?.getPropertyValue(templateKeys.resources)?.asArrayValue;
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
            return StringParseAndScopeAssignmentVisitor.createParsedStringMap(this);
        });
    }

    public async getErrorsCore(_associatedParameters: DeploymentParameters | undefined): Promise<language.Issue[]> {
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
    }

    public getWarnings(): language.Issue[] {
        const unusedParams = this.findUnusedParameters();
        const unusedVars = this.findUnusedVariables();
        const unusedUserFuncs = this.findUnusedUserFunctions();
        return unusedParams.concat(unusedVars).concat(unusedUserFuncs);
    }

    // CONSIDER: PERF: findUnused{Variables,Parameters,findUnusedNamespacesAndUserFunctions} are very inefficient}

    private findUnusedVariables(): language.Issue[] {
        const warnings: language.Issue[] = [];

        for (const variableDefinition of this.topLevelScope.variableDefinitions) {
            // Variables are only supported at the top level
            const variableReferences: ReferenceList = this.findReferencesToDefinition(variableDefinition);
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
                this.findReferencesToDefinition(parameterDefinition);
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
                        this.findReferencesToDefinition(parameterDefinition);
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
                    this.findReferencesToDefinition(member);
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

    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentParameters | undefined): TemplatePositionContext {
        return TemplatePositionContext.fromDocumentLineAndColumnIndexes(this, documentLineIndex, documentColumnIndex, associatedTemplate);
    }

    public getContextFromDocumentCharacterIndex(documentCharacterIndex: number, associatedTemplate: DeploymentParameters | undefined): TemplatePositionContext {
        return TemplatePositionContext.fromDocumentCharacterIndex(this, documentCharacterIndex, associatedTemplate);
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

    public findReferencesToDefinition(definition: INamedDefinition): ReferenceList {
        const result: ReferenceList = new ReferenceList(definition.definitionKind);
        const functions: FunctionsMetadata = AzureRMAssets.getFunctionsMetadata();

        // Add the definition of whatever's being referenced to the list
        if (definition.nameValue) {
            result.add({ document: this, span: definition.nameValue.unquotedSpan });
        }

        // Find and add references that match the definition we're looking for
        this.visitAllReachableStringValues(jsonStringValue => {
            const tleParseResult: TLE.ParseResult | undefined = this.getTLEParseResultFromJsonStringValue(jsonStringValue);
            if (tleParseResult.expression) {
                // tslint:disable-next-line:no-non-null-assertion // Guaranteed by if
                const visitor = FindReferencesVisitor.visit(this, tleParseResult.expression, definition, functions);
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

    public async getCodeActions(
        associatedDocument: DeploymentDocument | undefined,
        range: Range | Selection,
        context: CodeActionContext
    ): Promise<(Command | CodeAction)[]> {
        assert(!associatedDocument || associatedDocument instanceof DeploymentParameters, "Associated document is of the wrong type");
        const actions: (Command | CodeAction)[] = [];
        let pc = this.getContextFromDocumentLineAndColumnIndexes(range.start.line, range.start.character, undefined);
        if (range.start.line === range.end.line && range.start.character !== range.end.character) {
            let jsonToken = pc.document.getJSONValueAtDocumentCharacterIndex(pc.jsonTokenStartIndex - 1, language.Contains.extended);
            if (jsonToken instanceof Json.Property) {
                let startIndex = this.getDocumentCharacterIndex(range.start.line, range.start.character);
                let endIndex = this.getDocumentCharacterIndex(range.end.line, range.end.character);
                let span: language.Span = new language.Span(startIndex, endIndex - startIndex);
                const selectedText = this.getDocumentText(span);
                if (pc.jsonValue && jsonToken.value && jsonToken.value.span === pc.jsonValue.span && selectedText && this.equalsWithSqareBrackets(pc.jsonValue.asStringValue?.unquotedValue, selectedText)) {
                    actions.push(this.createExtractCommand('Extract Parameter...', 'extractParameter'));
                    actions.push(this.createExtractCommand('Extract Variable...', 'extractVariable'));
                }
            }
        }
        return actions;
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

    public getTextAtTleValue(tleValue: TLE.Value, parentStringToken: Json.Token): string {
        assert.equal(parentStringToken.type, Json.TokenType.QuotedString);
        const spanOfValueInsideString = tleValue.getSpan();
        return this.getDocumentText(spanOfValueInsideString, parentStringToken.span.startIndex);
    }

    public getCodeLenses(hasAssociatedParameters: boolean): ResolvableCodeLens[] {
        return this.getParameterCodeLenses(hasAssociatedParameters)
            .concat(this.getNestedTemplateCodeLenses());
    }

    private getParameterCodeLenses(hasAssociatedParameters: boolean): ResolvableCodeLens[] {
        const lenses: ResolvableCodeLens[] = [];

        // Code lens for the "parameters" section itself - indicates currently-selected parameter file and allows
        // user to chnage it
        const parametersCodeLensSpan = this.topLevelValue?.getProperty(templateKeys.parameters)?.span
            ?? new language.Span(0, 0);
        if (hasAssociatedParameters) {
            lenses.push(new ShowCurrentParameterFileCodeLens(this, parametersCodeLensSpan));
        }
        lenses.push(new SelectParameterFileCodeLens(this, parametersCodeLensSpan));

        if (hasAssociatedParameters) {
            // Code lens for each parameter definition
            lenses.push(...this.topLevelScope.parameterDefinitions.map(pd => new ParameterDefinitionCodeLens(this, pd)));
        }

        return lenses;
    }

    private createExtractCommand(title: string, command: string): CodeAction {
        const action = new CodeAction(title, CodeActionKind.RefactorExtract);
        action.command = { command: `azurerm-vscode-tools.${command}`, title: '' };
        return action;
    }

    private getNestedTemplateCodeLenses(): ResolvableCodeLens[] {
        const lenses: ResolvableCodeLens[] = [];
        const allScopes = this.findAllScopes();
        for (let scope of allScopes) {
            if (scope.rootObject) {
                const lens = NestedTemplateCodeLen.create(this, scope.rootObject.span, scope.scopeKind);
                if (lens) {
                    lenses.push(lens);
                }
            }
        }

        return lenses;
    }

    public findAllScopes(): TemplateScope[] {
        const allScopes: TemplateScope[] = [];
        traverse(this.topLevelScope);
        return allScopes;

        function traverse(scope: TemplateScope | undefined): void {
            for (let childScope of scope?.childScopes ?? []) {
                if (allScopes.indexOf(childScope) < 0) {
                    allScopes.push(childScope);
                }

                traverse(childScope);
            }
        }
    }
}

//#region StringParseAndScopeAssignmentVisitor

class StringParseAndScopeAssignmentVisitor extends Json.Visitor {
    private readonly _jsonStringValueToTleParseResultMap: Map<Json.StringValue, TLE.ParseResult> = new Map<Json.StringValue, TLE.ParseResult>();
    private readonly _scopeStack: TemplateScope[] = [];
    private _currentScope: TemplateScope;
    private readonly _allScopesInTemplate: TemplateScope[];

    public constructor(private readonly _dt: DeploymentTemplate) {
        super();
        this._currentScope = _dt.topLevelScope;
        this._allScopesInTemplate = _dt.findAllScopes();
    }

    public static createParsedStringMap(dt: DeploymentTemplate): Map<Json.StringValue, TLE.ParseResult> {
        const visitor = new StringParseAndScopeAssignmentVisitor(dt);
        return visitor.createMap();
    }

    private createMap(): Map<Json.StringValue, TLE.ParseResult> {
        this._dt.topLevelValue?.accept(this);
        return this._jsonStringValueToTleParseResultMap;
    }

    public visitStringValue(jsonStringValue: Json.StringValue): void {
        assert(!this._jsonStringValueToTleParseResultMap.has(jsonStringValue), "Already parsed this string");
        // Parse the string as a possible TLE expression and cache
        let tleParseResult: TLE.ParseResult = TLE.Parser.parse(jsonStringValue.quotedValue, this._currentScope);
        this._jsonStringValueToTleParseResultMap.set(jsonStringValue, tleParseResult);
    }

    public visitObjectValue(jsonObjectValue: Json.ObjectValue): void {
        const currentScope = this._currentScope;
        const newScope = this._allScopesInTemplate.find(scope => scope.rootObject === jsonObjectValue);
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
