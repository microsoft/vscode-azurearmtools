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
export const diagnosticsSource = "ARM Tools";

// For testing
export const diagnosticsCompleteMessage = "ARM Tools diagnostics complete";
export const languageServerCompleteMessage = "ARM Language Server diagnostics complete";

export namespace configKeys {
    export const autoDetectJsonTemplates = "autoDetectJsonTemplates";
}
