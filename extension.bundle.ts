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
import * as Language from "./src/language/LineColPos";
import * as Completion from './src/vscodeIntegration/Completion';

export { activateInternal, deactivateInternal } from './src/AzureRMTools'; // Export activate/deactivate for main.js
export { armTemplateLanguageId, basePath, configKeys, configPrefix, diagnosticsCompletePrefix, expressionsDiagnosticsSource, isWin32, languageServerStateSource, templateKeys } from "./src/constants";
export { DeploymentFileMapping } from "./src/documents/parameters/DeploymentFileMapping";
export { DeploymentParametersDoc } from "./src/documents/parameters/DeploymentParametersDoc";
export { IParameterDefinition } from "./src/documents/parameters/IParameterDefinition";
export { IParameterValuesSource } from "./src/documents/parameters/IParameterValuesSource";
export { IParameterValuesSourceProvider } from "./src/documents/parameters/IParameterValuesSourceProvider";
export { ParameterDefinition } from "./src/documents/parameters/ParameterDefinition";
export { createParameterFileContents, createParameterFromTemplateParameter } from './src/documents/parameters/parameterFileGeneration';
export { mayBeMatchingParameterFile } from "./src/documents/parameters/parameterFiles";
export { ParameterValueDefinition } from "./src/documents/parameters/ParameterValueDefinition";
export { canAddPropertyValueHere } from "./src/documents/parameters/ParameterValues";
export { ParametersPositionContext } from "./src/documents/positionContexts/ParametersPositionContext";
export { IReferenceSite, PositionContext, ReferenceSiteKind } from "./src/documents/positionContexts/PositionContext";
export { TemplatePositionContext } from "./src/documents/positionContexts/TemplatePositionContext";
export { ParameterDefinitionCodeLens, ShowCurrentParameterFileCodeLens } from "./src/documents/templates/deploymentTemplateCodeLenses";
export { DeploymentTemplateDoc } from "./src/documents/templates/DeploymentTemplateDoc";
export { ExpressionType } from "./src/documents/templates/ExpressionType";
export { looksLikeResourceTypeStringLiteral, splitResourceNameIntoSegments } from "./src/documents/templates/getResourceIdCompletions";
export { InsertItem } from "./src/documents/templates/insertItem";
export { TemplateScope, TemplateScopeKind } from "./src/documents/templates/scopes/TemplateScope";
export * from "./src/documents/templates/scopes/templateScopes";
export { TemplateSectionType } from "./src/documents/templates/TemplateSectionType";
export { UserFunctionMetadata } from "./src/documents/templates/UserFunctionMetadata";
export { UserFunctionNamespaceDefinition } from "./src/documents/templates/UserFunctionNamespaceDefinition";
export { UserFunctionParameterDefinition } from "./src/documents/templates/UserFunctionParameterDefinition";
export { isVariableDefinition, IVariableDefinition } from "./src/documents/templates/VariableDefinition";
export { ext } from './src/extensionVariables';
export * from './src/language/expressions/AzureRMAssets';
export { FunctionSignatureHelp, TleParseResult } from "./src/language/expressions/TLE";
export { DefinitionKind, INamedDefinition } from "./src/language/INamedDefinition";
export { Issue } from "./src/language/Issue";
export { IssueKind } from "./src/language/IssueKind";
export * from "./src/language/LineColPos";
export { ReferenceList } from "./src/language/ReferenceList";
export { ContainsBehavior, Span } from "./src/language/Span";
export { LanguageServerState } from "./src/languageclient/startArmLanguageServer";
export { containsArmSchema, getPreferredSchema, isArmSchema } from './src/schemas';
export { ISnippetManager } from './src/snippets/ISnippetManager';
export { SnippetManager } from './src/snippets/SnippetManager';
export * from "./src/survey";
export { CachedPromise } from "./src/util/CachedPromise";
export { CachedValue } from "./src/util/CachedValue";
export { CaseInsensitiveMap } from "./src/util/CaseInsensitiveMap";
export { CompletionsSpy, ICompletionsSpyResult } from "./src/util/CompletionsSpy";
export { __debugMarkPositionInString, __debugMarkRangeInString } from "./src/util/debugMarkStrings";
export { deepClone } from "./src/util/deepClone";
export { Duration } from './src/util/Duration';
export { Histogram } from "./src/util/Histogram";
export { httpGet } from './src/util/httpGet';
export { mapJsonObjectValue } from "./src/util/mapJsonObjectValue";
export { indentMultilineString, unindentMultilineString } from "./src/util/multilineStrings";
export * from "./src/util/nonNull";
export { normalizePath } from "./src/util/normalizePath";
export * from "./src/util/readUtf8FileWithBom";
export * as strings from "./src/util/strings";
export * from './src/util/time';
export { wrapError } from "./src/util/wrapError";
export { FindReferencesVisitor } from "./src/visitors/FindReferencesVisitor";
export { FunctionCountVisitor } from "./src/visitors/FunctionCountVisitor";
export { IncorrectArgumentsCountIssue } from "./src/visitors/IncorrectArgumentsCountIssue";
export { IncorrectFunctionArgumentCountVisitor } from "./src/visitors/IncorrectFunctionArgumentCountVisitor";
export { ReferenceInVariableDefinitionsVisitor } from "./src/visitors/ReferenceInVariableDefinitionsVisitor";
export { UndefinedParameterAndVariableVisitor } from "./src/visitors/UndefinedParameterAndVariableVisitor";
export { UndefinedVariablePropertyVisitor } from "./src/visitors/UndefinedVariablePropertyVisitor";
export { UnrecognizedBuiltinFunctionIssue, UnrecognizedUserFunctionIssue, UnrecognizedUserNamespaceIssue } from "./src/visitors/UnrecognizedFunctionIssues";
export { UnrecognizedFunctionVisitor } from "./src/visitors/UnrecognizedFunctionVisitor";
export { IGotoParameterValueArgs } from "./src/vscodeIntegration/commandArguments";
export * from "./src/vscodeIntegration/Completion";
export { IConfiguration } from "./src/vscodeIntegration/Configuration";
export { HoverInfo } from "./src/vscodeIntegration/Hover";
export { JsonOutlineProvider, shortenTreeLabel } from "./src/vscodeIntegration/Treeview";
export { getVSCodePositionFromPosition, getVSCodeRangeFromSpan } from "./src/vscodeIntegration/vscodePosition";
export { Completion };
export { Json };
export { Language };
export { basic };
export { TLE };

