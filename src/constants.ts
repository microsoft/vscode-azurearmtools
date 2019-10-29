/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

// tslint:disable-next-line: strict-boolean-expressions
export const isWebpack: boolean = /^(false|0)?$/i.test(process.env.AZCODE_ARM_IGNORE_BUNDLE || '');

export const assetsPath = path.join(__dirname, isWebpack ? "" : "..", "..", "assets");
export const iconsPath = path.join(__dirname, isWebpack ? "" : "..", "..", "icons");

export const languageServerName = 'ARM Template Language Server';
export const languageFriendlyName = 'Azure Resource Manager Template';
export const languageId = 'arm-template';
export const languageServerFolderName = 'languageServer';
export const outputWindowName = 'Azure Resource Manager Tools';

// String that shows up in our errors as the source in parentheses
export const expressionsDiagnosticsSource = "arm-template (expressions)";

// Source string for errors related to the language server starting up or failing
export const languageServerStateSource = "arm-template";

export const configPrefix = 'azureResourceManagerTools'; // Prefix for user settings

export namespace configKeys {
    export const autoDetectJsonTemplates = 'autoDetectJsonTemplates';
    export const dotnetExePath = 'languageServer.dotnetExePath';
    export const traceLevel = 'languageServer.traceLevel';
    export const waitForDebugger = 'languageServer.waitForDebugger';
    export const langServerPath = 'languageServer.path';
}

// For testing: We create a diagnostic with this message during testing to indicate when all (expression) diagnostics have been calculated
export const diagnosticsCompletePrefix = "Diagnostics complete: ";
export const expressionsDiagnosticsCompletionMessage = diagnosticsCompletePrefix + expressionsDiagnosticsSource;

export namespace templateKeys {
    export const parameters = 'parameters';
    export const variables = 'variables';
}
