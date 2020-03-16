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

import * as Completion from './src/Completion';
import * as Json from "./src/JSON";
import * as Language from "./src/Language";
import * as TLE from "./src/TLE";
import * as basic from "./src/Tokenizer";
import * as Utilities from "./src/Utilities";

export * from './src/AzureRMAssets';
export { AzureRMAssets } from "./src/AzureRMAssets";
export { activateInternal, deactivateInternal } from './src/AzureRMTools'; // Export activate/deactivate for main.js
export { CachedPromise } from "./src/CachedPromise";
export { CachedValue } from "./src/CachedValue";
export { CaseInsensitiveMap } from "./src/CaseInsensitiveMap";
export * from "./src/Completion";
export { IConfiguration } from "./src/Configuration";
export { armTemplateLanguageId as armDeploymentLanguageId, armTemplateLanguageId as languageId, configKeys, configPrefix, diagnosticsCompletePrefix, expressionsDiagnosticsSource, isWin32, languageServerStateSource, templateKeys } from "./src/constants";
export { __debugMarkPositionInString, __debugMarkRangeInString as __debugMarkSubstring } from "./src/debugMarkStrings";
export { DeploymentTemplate } from "./src/DeploymentTemplate";
export { Duration } from './src/Duration';
export { ExpressionType } from "./src/ExpressionType";
export { ext } from './src/extensionVariables';
export { Histogram } from "./src/Histogram";
export { HoverInfo } from "./src/Hover";
export { httpGet } from './src/httpGet';
export { DefinitionKind, INamedDefinition } from "./src/INamedDefinition";
export { IncorrectArgumentsCountIssue } from "./src/IncorrectArgumentsCountIssue";
export { IParameterDefinition } from "./src/IParameterDefinition";
export * from "./src/Language";
export { LanguageServerState } from "./src/languageclient/startArmLanguageServer";
export { ParameterDefinition } from "./src/ParameterDefinition";
export { createParameterFileContents, createParameterFromTemplateParameter as createParameterProperty } from './src/parameterFileGeneration';
export { DeploymentFileMapping } from "./src/parameterFiles/DeploymentFileMapping";
export { DeploymentParameters } from "./src/parameterFiles/DeploymentParameters";
export { mayBeMatchingParameterFile } from "./src/parameterFiles/parameterFiles";
export { ParametersPositionContext } from "./src/parameterFiles/ParametersPositionContext";
export { ParameterValueDefinition } from "./src/parameterFiles/ParameterValueDefinition";
export { IReferenceSite, PositionContext } from "./src/PositionContext";
export { ReferenceList } from "./src/ReferenceList";
export { containsArmSchema, getPreferredSchema, isArmSchema } from './src/schemas';
export * from "./src/survey";
export { ScopeContext, TemplateScope } from "./src/TemplateScope";
export { FunctionSignatureHelp } from "./src/TLE";
export { JsonOutlineProvider, shortenTreeLabel } from "./src/Treeview";
export { UnrecognizedBuiltinFunctionIssue, UnrecognizedUserFunctionIssue, UnrecognizedUserNamespaceIssue } from "./src/UnrecognizedFunctionIssues";
export { UserFunctionMetadata } from "./src/UserFunctionMetadata";
export { UserFunctionNamespaceDefinition } from "./src/UserFunctionNamespaceDefinition";
export { UserFunctionParameterDefinition } from "./src/UserFunctionParameterDefinition";
export { mapJsonObjectValue } from "./src/util/mapJsonObjectValue";
export { indentMultilineString } from "./src/util/multilineStrings";
export * from "./src/util/nonNull";
export { normalizePath } from "./src/util/normalizePath";
export * from './src/util/time';
export { getVSCodePositionFromPosition } from "./src/util/vscodePosition";
export { wrapError } from "./src/util/wrapError";
export { isVariableDefinition, IVariableDefinition } from "./src/VariableDefinition";
export { FindReferencesVisitor } from "./src/visitors/FindReferencesVisitor";
export { FunctionCountVisitor } from "./src/visitors/FunctionCountVisitor";
export { IncorrectFunctionArgumentCountVisitor } from "./src/visitors/IncorrectFunctionArgumentCountVisitor";
export { ReferenceInVariableDefinitionsVisitor } from "./src/visitors/ReferenceInVariableDefinitionsVisitor";
export { UndefinedParameterAndVariableVisitor } from "./src/visitors/UndefinedParameterAndVariableVisitor";
export { UndefinedVariablePropertyVisitor } from "./src/visitors/UndefinedVariablePropertyVisitor";
export { UnrecognizedFunctionVisitor } from "./src/visitors/UnrecognizedFunctionVisitor";
export { Completion };
export { Json };
export { Language };
export { basic };
export { Utilities };
export { TLE };

