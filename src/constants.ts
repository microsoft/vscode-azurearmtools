/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

// tslint:disable-next-line: strict-boolean-expressions
export const isWebpack: boolean = /^(false|0)?$/i.test(process.env.AZCODE_ARM_IGNORE_BUNDLE || '');

export const assetsPath = path.join(__dirname, isWebpack ? "" : "..", "..", "assets");
export const iconsPath = path.join(__dirname, isWebpack ? "" : "..", "..", "icons");

export const armDeploymentLanguageId = 'arm-deployment';

// String that shows up in our errors as the source in parentheses
export const expressionsDiagnosticsSource = "ARM (Expressions)";

// For testing
export const diagnosticsCompletePrefix = "Diagnostics complete: ";
export const expressionsDiagnosticsCompletionMessage = diagnosticsCompletePrefix + expressionsDiagnosticsSource;

export namespace configKeys {
    export const autoDetectJsonTemplates = "autoDetectJsonTemplates";
}
