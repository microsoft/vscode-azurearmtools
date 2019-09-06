/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * This is the external face of extension.bundle.js, the main webpack bundle for the extension.
 * Anything needing to be exposed outside of the extension sources must be exported from here, because
 * everything else will be in private modules in extension.bundle.js.
 */

// Export activate/deactivate for main.js
export { activateInternal, deactivateInternal } from './src/AzureRMTools';

// Exports for tests
// The tests are not packaged with the webpack bundle and therefore only have access to code exported from this file.
//
// The tests should import '../extension.bundle.ts'. At design-time they live in tests/ and so will pick up this file (extension.bundle.ts).
// At runtime the tests live in dist/tests and will therefore pick up the main webpack bundle at dist/extension.bundle.js.
export { ext } from './src/extensionVariables';
export * from './src/AzureRMAssets';
import * as Completion from './src/Completion';
export { Completion };
export * from "./src/Completion";
export * from "./src/Language";
export { DeploymentTemplate, ReferenceInVariableDefinitionJSONVisitor } from "./src/DeploymentTemplate";
export { Histogram } from "./src/Histogram";
export { IncorrectArgumentsCountIssue } from "./src/IncorrectArgumentsCountIssue";
import * as Json from "./src/JSON";
export { Json };
import * as Language from "./src/Language";
export { Language };
export { ParameterDefinition } from "./src/ParameterDefinition";
import * as Reference from "./src/Reference";
export { Reference };
export { UnrecognizedFunctionIssue } from "./src/UnrecognizedFunctionIssue";
export { Duration } from './src/Duration';
import * as Hover from "./src/Hover";
export { Hover };
export { httpGet } from './src/httpGet';
import * as basic from "./src/Tokenizer";
export { basic };
import * as Utilities from "./src/Utilities";
export { Utilities };
export { PositionContext } from "./src/PositionContext";
import * as TLE from "./src/TLE";
export { TLE };
export { isLanguageIdSupported } from "./src/supported";
export { JsonOutlineProvider, shortenTreeLabel } from "./src/Treeview";
export { diagnosticsCompleteMessage, diagnosticsSource } from "./src/constants";
