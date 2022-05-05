/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// tslint:disable: no-consecutive-blank-lines // Format-on-save tends to add an extra line to the end of this file
/**
 * This is the external face of extension.bundle.js, the main webpack bundle for the extension.
 * Anything needing to be exposed outside of the extension sources must be exported from here, because
 * everything else will be in private modules in extension.bundle.js.
 *
 * EXPORTS FOR TESTS:
 *
 * The tests are not packaged with the webpack bundle and therefore only have access to code exported from this file.
 *
 * The tests should import '../extension.bundle.ts'. At design-time they live in tests/ and so will pick up this file (extension.bundle.ts).
 * At runtime the tests live in dist/tests and will therefore pick up the main webpack bundle at dist/extension.bundle.js.
 */
import * as TLE from "./src/language/expressions/TLE";
import * as Json from "./src/language/json/JSON";
import * as basic from "./src/language/json/Tokenizer";
import * as Completion from './src/vscodeIntegration/Completion';

export * from "./common";
export * from "./src/documents/DeploymentDocument";
export * from "./src/documents/parameters/DeploymentFileMapping";
export * from "./src/documents/parameters/DeploymentParametersDoc";
export * from "./src/documents/parameters/IParameterDefinition";
export * from "./src/documents/parameters/IParameterValuesSource";
export * from "./src/documents/parameters/IParameterValuesSourceProvider";
export * from "./src/documents/parameters/ParameterDefinition";
export * from './src/documents/parameters/parameterFileGeneration';
export * from "./src/documents/parameters/parameterFiles";
export * from "./src/documents/parameters/ParameterValueDefinition";
export * from "./src/documents/parameters/ParameterValues";
export * from "./src/documents/positionContexts/ParametersPositionContext";
export * from "./src/documents/positionContexts/PositionContext";
export * from "./src/documents/positionContexts/TemplatePositionContext";
export * from "./src/documents/templates/areDecoupledChildAndParent";
export * from "./src/documents/templates/deploymentTemplateCodeLenses";
export * from "./src/documents/templates/DeploymentTemplateDoc";
export * from "./src/documents/templates/ExpressionType";
export * from "./src/documents/templates/ExtractItem";
export * from "./src/documents/templates/getNormalizedDocumentKey";
export { looksLikeResourceTypeStringLiteral } from "./src/documents/templates/getResourceIdCompletions";
export * from "./src/documents/templates/getResourcesInfo";
export * from "./src/documents/templates/IJsonDocument";
export { InsertItem } from "./src/documents/templates/insertItem";
export * from "./src/documents/templates/ISchemaInfo";
export * from "./src/documents/templates/linkedTemplates/ILinkedTemplateReference";
export * from './src/documents/templates/linkedTemplates/LinkedFileLoadState';
export * from "./src/documents/templates/linkedTemplates/linkedTemplates";
export * from "./src/documents/templates/ParentAndChildCodeLenses";
export * from "./src/documents/templates/schemas";
export * from "./src/documents/templates/scopes/DeploymentScopeKind";
export * from "./src/documents/templates/scopes/getDeploymentScopeReference";
export * from "./src/documents/templates/scopes/IDeploymentSchemaReference";
export * from "./src/documents/templates/scopes/TemplateScope";
export * from "./src/documents/templates/scopes/templateScopes";
export * from "./src/documents/templates/TemplateSectionType";
export * from "./src/documents/templates/UserFunctionMetadata";
export * from "./src/documents/templates/UserFunctionNamespaceDefinition";
export * from "./src/documents/templates/UserFunctionParameterDefinition";
export * from "./src/documents/templates/VariableDefinition";
export { activateInternal, deactivateInternal } from './src/extension'; // Export activate/deactivate for main.js
export { ext } from './src/extensionVariables';
export * from './src/language/expressions/AzureRMAssets';
export * from "./src/language/expressions/friendlyExpressions";
export * from "./src/language/expressions/isTleExpression";
export * from "./src/language/expressions/TLE";
export * from "./src/language/INamedDefinition";
export * from "./src/language/Issue";
export * from "./src/language/IssueKind";
export * from "./src/language/LineColPos";
export * from "./src/language/ReferenceList";
export * from "./src/language/Span";
export * from "./src/languageclient/getAvailableResourceTypesAndVersionsNoThrow";
export * from "./src/languageclient/startArmLanguageServer";
export * from './src/snippets/ISnippet';
export * from './src/snippets/ISnippetManager';
export * from "./src/snippets/resourceSnippetsConversion";
export * from './src/snippets/SnippetManager';
export * from "./src/survey";
export * from "./src/util/assertNever";
export * from "./src/util/CachedPromise";
export * from "./src/util/CachedValue";
export * from "./src/util/CaseInsensitiveMap";
export * from "./src/util/CompletionsSpy";
export * from "./src/util/debugMarkStrings";
export * from "./src/util/deepClone";
export * from "./src/util/delayWhileSync";
export * from './src/util/Duration';
export * from "./src/util/envUtils";
export * from './src/util/filterByType';
export * from "./src/util/Histogram";
export * from './src/util/httpGet';
export * from "./src/util/linkedTemplateScheme";
export * from "./src/util/mapJsonObjectValue";
export * from "./src/util/multilineStrings";
export * from "./src/util/nonNull";
export * from "./src/util/NormalizedMap";
export * from "./src/util/normalizedPaths";
export * from "./src/util/readUtf8FileWithBom";
export * from "./src/util/sorting";
export * as strings from "./src/util/strings";
export * from './src/util/time';
export * from "./src/util/uri";
export { wrapError } from "./src/util/wrapError";
export * from "./src/visitors/FindReferencesAndErrorsVisitor";
export * from "./src/visitors/FunctionCountVisitor";
export * from "./src/visitors/IncorrectArgumentsCountIssue";
export * from "./src/visitors/ReferenceInVariableDefinitionsVisitor";
export * from "./src/visitors/UndefinedVariablePropertyVisitor";
export * from "./src/visitors/UnrecognizedFunctionIssues";
export * from "./src/vscodeIntegration/commandArguments";
export * from "./src/vscodeIntegration/Configuration";
export * from "./src/vscodeIntegration/FormattedExpressionHoverInfo";
export * from "./src/vscodeIntegration/IHoverInfo";
export * from "./src/vscodeIntegration/toVsCodeCompletionItem";
export * from "./src/vscodeIntegration/Treeview";
export * from "./src/vscodeIntegration/UsageInfoHoverInfo";
export * from "./src/vscodeIntegration/vscodePosition";
export { Completion };
export { Json };
export { basic };
export { TLE };

