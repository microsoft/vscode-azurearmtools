/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
import * as Hover from "./src/Hover";
import * as Json from "./src/JSON";
import * as Language from "./src/Language";
import * as Reference from "./src/Reference";
import * as TLE from "./src/TLE";
import * as basic from "./src/Tokenizer";
import * as Utilities from "./src/Utilities";

export * from './src/AzureRMAssets';
export { activateInternal, deactivateInternal } from './src/AzureRMTools'; // Export activate/deactivate for main.js
export * from "./src/Completion";
export { armDeploymentLanguageId, configKeys, diagnosticsCompletePrefix, expressionsDiagnosticsSource, languageServerStateSource } from "./src/constants";
export { DeploymentTemplate, ReferenceInVariableDefinitionJSONVisitor } from "./src/DeploymentTemplate";
export { Duration } from './src/Duration';
export { ext } from './src/extensionVariables';
export { Histogram } from "./src/Histogram";
export { httpGet } from './src/httpGet';
export { IncorrectArgumentsCountIssue } from "./src/IncorrectArgumentsCountIssue";
export * from "./src/Language";
export { LanguageServerState, languageServerState } from "./src/languageclient/startArmLanguageServer";
export { ParameterDefinition } from "./src/ParameterDefinition";
export { PositionContext } from "./src/PositionContext";
export { doesJsonContainArmSchema } from './src/supported';
export { JsonOutlineProvider, shortenTreeLabel } from "./src/Treeview";
export { UnrecognizedFunctionIssue } from "./src/UnrecognizedFunctionIssue";
export { Completion };
export { Json };
export { Language };
export { Reference };
export { Hover };
export { basic };
export { Utilities };
export { TLE };
