/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';

export const isWebpack: boolean = /^(false|0)?$/i.test(process.env.AZCODE_ARM_IGNORE_BUNDLE ?? '');

export const isWin32: boolean = os.platform() === 'win32';
export const isCaseSensitiveFileSystem: boolean = !isWin32;

export const basePath = path.join(__dirname, isWebpack ? "" : "..", "..");
export const assetsPath = path.join(basePath, "assets");
export const iconsPath = path.join(basePath, "icons");

export const languageServerName = 'ARM Template Language Server';
export const languageFriendlyName = 'Azure Resource Manager Template';
export const armTemplateLanguageId = 'arm-template';
export const languageServerFolderName = 'languageServer';
export const extensionName = 'Azure Resource Manager Tools';
export const outputChannelName = extensionName;

// String that shows up in our errors as the source in parentheses
export const expressionsDiagnosticsSource = "arm-template (expressions)";

// Source string for errors related to the language server starting up or failing
export const languageServerStateSource = "arm-template";

export const configPrefix = 'azureResourceManagerTools'; // Prefix for user settings

// The dotnet version the language server is compiled against (affects where the
// assembly is found in the langServer folder)
export const langServerDotnetVersion = '3.1';
// The dotnet version to download and run the language server against (minor version
// may be greater than langServerDotnetVersion)
export const downloadDotnetVersion = '3.1';

export namespace configKeys {
    export const autoDetectJsonTemplates = 'autoDetectJsonTemplates';
    export const dotnetExePath = 'languageServer.dotnetExePath';
    export const traceLevel = 'languageServer.traceLevel';
    export const waitForDebugger = 'languageServer.waitForDebugger';
    export const langServerPath = 'languageServer.path';
    export const checkForLatestSchema = 'checkForLatestSchema';
    export const checkForMatchingParameterFiles = 'checkForMatchingParameterFiles';
    export const parameterFiles = 'parameterFiles';
    export const enableCodeLens = 'codelens.enable';
    export const codeLensForParameters = 'codelens.parameters';
}

export namespace globalStateKeys {
    // Set of files to not ask about using the newest schema
    export const dontAskAboutSchemaFiles = 'dontAskAboutSchemaFiles';
    // Set of files to not automatically search for params files for
    export const dontAskAboutParameterFiles = 'dontAskAboutParameterFiles';

    export namespace survey {
        export const neverShowSurvey = 'neverShowSurvey';
        export const surveyPostponedUntilTime = 'surveyPostponedUntilTime';
    }
}

// For testing: We create a diagnostic with this message during testing to indicate when all (expression) diagnostics have been calculated
export const diagnosticsCompletePrefix = "Diagnostics complete: ";
export const expressionsDiagnosticsCompletionMessage = diagnosticsCompletePrefix + expressionsDiagnosticsSource;

export namespace templateKeys {
    // Top-level
    export const parameters = 'parameters';
    export const resources = 'resources';
    export const variables = 'variables';
    export const functions = 'functions';
    export const outputs = 'outputs';
    export const apiProfile = 'apiProfile';

    // Copy blocks
    export const loopVarCopy = "copy";
    export const loopVarName = 'name';
    export const loopVarInput = 'input';
    export const loopVarCount = 'count';

    // Resources
    export const properties = 'properties';
    export const resourceType = 'type';
    export const resourceApiVersion = 'apiVersion';
    export const resourceDependsOn = 'dependsOn';
    export const resourceName = 'name';

    // Nested templates
    export const nestedDeploymentExprEvalOptions = 'expressionEvaluationOptions';
    export const nestedDeploymentExprEvalScope = 'scope';
    export const nestedDeploymentExprEvalScopeInner = 'inner';
    export const nestedDeploymentTemplateProperty = 'template';
}
