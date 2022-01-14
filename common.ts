/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// NOTE: This is used by gulp and should avoid referencing code from ./src

import { assert } from "console";
import * as fs from "fs";
import * as os from 'os';
import * as path from 'path';

export const isWebpack: boolean = !!/^(false|0)?$/i.test(process.env.AZCODE_ARM_IGNORE_BUNDLE ?? '');
console.log(`isWebpack: ${isWebpack}`);

export const isWin32: boolean = os.platform() === 'win32';
export const isCaseSensitiveFileSystem: boolean = !isWin32;

let base = __dirname;
while (true) {
    let test = path.join(base, "assets");
    if (fs.existsSync(test)) {
        base = test;
        break;
    }
    base = path.dirname(base);
    assert(base != '', "Could not find base project path");
}
export const assetsPath = base;
export const basePath = path.join(assetsPath, "..");
export const iconsPath = path.join(basePath, "icons");
assert(fs.existsSync(assetsPath), "Assets path does not exist: " + assetsPath);

export const DEFAULT_TESTCASE_TIMEOUT_MS = 5 * 60 * 1000;

export namespace documentSchemes {
    export const file: string = 'file'; // Locally-saved files
    export const untitled: string = 'untitled';  // unsaved files
    export const linkedTemplate = 'linked-template'; // For our ITextDocumentContentProvider that serves HTTP documents
    export const git = 'git';
}

export const languageServerName = 'ARM Template Language Server';
export const languageFriendlyName = 'Azure Resource Manager Template';
export const armTemplateLanguageId = 'arm-template';
export const languageServerFolderName = 'languageServer';
export const extensionName = 'Azure Resource Manager Tools';
export const outputChannelName = extensionName;

// String that shows up in our errors as the source in parentheses
export const expressionsDiagnosticsSource = "arm-template (expressions)";
export const backendValidationDiagnosticsSource = 'arm-template (validation)';

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
    export const codeLensForResourceParentsAndChildren = 'codelens.resourceChildren';
}

export namespace notifications {
    export const requestOpenLinkedTemplate = 'arm-template/requestOpenLinkedTemplate';
    export const notifyTemplateGraph = 'arm-template/notifyTemplateGraph';
    export const schemaValidationNotification = 'arm-template/schemaValidation';

    export interface ISchemaValidationNotificationArgs {
        uri: string;
        completed: boolean;
    }

    export namespace Diagnostics {
        export const codeAnalysisStarting = 'arm-template/diag-codeAnalysisStarting';

        export interface ICodeAnalysisStartingArgs {
            uri: string;
            docVersion: number;
            codeAnalysisVersion: number;

        }
    }
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

    export namespace messages {
        export const bicepMessagePostponedUntilTime = 'bicepMessagePostponedUntilTime';
    }
}

// For testing: We create a diagnostic with this message during testing to indicate when all (expression) diagnostics have been calculated
export const diagnosticsCompletePrefix = "Diagnostics complete: ";
export const expressionsDiagnosticsCompletionMessage = diagnosticsCompletePrefix + expressionsDiagnosticsSource;

export const isRunningTests: boolean = /^(true|1)$/i.test(process.env.IS_RUNNING_TESTS ?? '');

export namespace templateKeys {
    // Top-level
    export const schema = '$schema';
    export const parameters = 'parameters';
    export const resources = 'resources';
    export const variables = 'variables';
    export const functions = 'functions';
    export const outputs = 'outputs';
    export const apiProfile = 'apiProfile';

    // Copy blocks
    export const copyLoop = "copy";
    export const copyName = 'name';
    export const copyInput = 'input';
    export const copyCount = 'count';

    // Resources
    export const properties = 'properties';
    export const resourceType = 'type';
    export const resourceApiVersion = 'apiVersion';
    export const resourceDependsOn = 'dependsOn';
    export const resourceName = 'name';
    export const tags = 'tags';
    export const displayNameTag = 'displayName';

    // Nested templates
    export const nestedDeploymentExprEvalOptions = 'expressionEvaluationOptions';
    export const nestedDeploymentExprEvalScope = 'scope';
    export const nestedDeploymentExprEvalScopeInner = 'inner';
    export const nestedDeploymentTemplateProperty = 'template';

    // Linked templates
    export const linkedDeploymentTemplateLink = 'templateLink';
    export const linkedDeploymentTemplateLinkUri = 'uri';
    export const linkedDeploymentTemplateLinkRelativePath = 'relativePath';

    // User functions
    export const userFunctionNamespace = 'namespace';
    export const userFunctionMembers = 'members';
}

export const deploymentsResourceTypeLC: string = 'microsoft.resources/deployments';
