/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import { callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync, IActionContext, parseError } from 'vscode-azureextensionui';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { dotnetAcquire, ensureDotnetDependencies } from '../acquisition/dotnetAcquisition';
import { armDeploymentLanguageId, languageServerFolderName, languageServerName } from '../constants';
import { ext } from '../extensionVariables';
import { armDeploymentDocumentSelector } from '../supported';
import { WrappedErrorHandler } from './WrappedErrorHandler';

const languageServerDllName = 'Microsoft.ArmLanguageServer.dll';
export let serverStartMs: number;
export const languageServerErrorTelemId = 'Language Server Error';
const defaultTraceLevel = 'Warning';
const dotnetVersion = '2.2';

export enum LanguageServerState {
    NotStarted,
    Starting,
    Failed,
    Started,
}
export let languageServerState: LanguageServerState = LanguageServerState.NotStarted;

export async function startArmLanguageServer(): Promise<void> {
    languageServerState = LanguageServerState.Starting;
    try {
        // The server is implemented in .NET Core. We run it by calling 'dotnet' with the dll as an argument
        let serverDllPath: string = findLanguageServer(ext.context);
        let dotnetExePath: string = await acquireDotnet(serverDllPath);
        await ensureDependencies(dotnetExePath, serverDllPath);
        startLanguageClient(serverDllPath, dotnetExePath);

        languageServerState = LanguageServerState.Started;
    } catch (error) {
        languageServerState = LanguageServerState.Failed;
        throw error;
    }
}

function startLanguageClient(serverDllPath: string, dotnetExePath: string): void {
    callWithTelemetryAndErrorHandlingSync('startArmLanguageClient', (actionContext: IActionContext) => {
        actionContext.errorHandling.rethrow = true;

        // These trace levels are available in the server:
        //   Trace
        //   Debug
        //   Information
        //   Warning
        //   Error
        //   Critical
        //   None
        let trace: string = workspace.getConfiguration('armTools').get<string>("languageServer.traceLevel") || defaultTraceLevel;

        let commonArgs = [
            serverDllPath,
            '--logLevel',
            trace
        ];

        if (workspace.getConfiguration('armTools').get<boolean>('languageServer.waitForDebugger', false) === true) {
            commonArgs.push('--wait-for-debugger');
        }
        if (ext.addCompletionDiagnostic) {
            // Forces the server to add a completion message to its diagnostics
            commonArgs.push('--verbose-diagnostics');
        }

        // If the extension is launched in debug mode then the debug server options are used
        // Otherwise the run options are used
        let serverOptions: ServerOptions = {
            run: { command: dotnetExePath, args: commonArgs, options: { shell: false } },
            debug: { command: dotnetExePath, args: commonArgs, options: { shell: false } },
        };

        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            documentSelector: armDeploymentDocumentSelector,
        };

        // Create the language client and start the client.
        ext.outputChannel.appendLine(`Starting ARM Language Server at ${serverDllPath}`);
        ext.outputChannel.appendLine(`Client options:\n${JSON.stringify(clientOptions, undefined, 2)}`);
        ext.outputChannel.appendLine(`Server options:\n${JSON.stringify(serverOptions, undefined, 2)}`);
        const client = new LanguageClient(armDeploymentLanguageId, languageServerName, serverOptions, clientOptions);

        let defaultHandler = client.createDefaultErrorHandler();
        client.clientOptions.errorHandler = new WrappedErrorHandler(defaultHandler);

        try {
            serverStartMs = Date.now();
            let disposable = client.start();
            ext.context.subscriptions.push(disposable);
        } catch (error) {
            throw new Error(
                `${languageServerName}: unexpectedly failed to start.\n\n${parseError(error).message}`);
        }
    });
}
async function acquireDotnet(dotnetExePath: string): Promise<string> {
    return await callWithTelemetryAndErrorHandling('acquireDotnet', async (actionContext: IActionContext) => {
        actionContext.errorHandling.rethrow = true;

        dotnetExePath = await dotnetAcquire(dotnetVersion, actionContext.telemetry.properties);
        if (!(await fse.pathExists(dotnetExePath)) || !(await fse.stat(dotnetExePath)).isFile) {
            throw new Error(`Unexpected path returned for .net core: ${dotnetExePath}`);
        }
        ext.outputChannel.appendLine(`Using dotnet core from ${dotnetExePath}`);

        // Telemetry: dotnet version actually used
        try {
            // E.g. "c:\Users\<user>\AppData\Roaming\Code - Insiders\User\globalStorage\msazurermtools.azurerm-vscode-tools\.dotnet\2.2.5\dotnet.exe"
            let actualVersion = dotnetExePath.match(/dotnet[\\/]([^\\/]+)[\\/]/)[1];
            actionContext.telemetry.properties.dotnetVersionInstalled = actualVersion;
        } catch (error) {
            // ignore (telemetry only)
        }

        return dotnetExePath;
    });
}

function findLanguageServer(context: ExtensionContext): string {
    let serverDllPath: string;

    return callWithTelemetryAndErrorHandlingSync('findLanguageServer', (actionContext: IActionContext) => {
        actionContext.errorHandling.rethrow = true;

        let serverDllPathSetting: string | undefined = workspace.getConfiguration('armTools').get<string | undefined>('languageServer.path');
        if (typeof serverDllPathSetting !== 'string' || serverDllPathSetting === '') {
            actionContext.telemetry.properties.customServerDllPath = 'false';

            // Default behavior: armTools.languageServer.path is not set - look for the files in their normal installed location under languageServerFolderName
            let serverFolderPath = context.asAbsolutePath(languageServerFolderName);
            serverDllPath = path.join(serverFolderPath, languageServerDllName);
            if (!fse.existsSync(serverFolderPath) || !fse.existsSync(serverDllPath)) {
                throw new Error(`Couldn't find the ARM language server at ${serverDllPath}, you may need to reinstall the extension.`);
            }
            serverDllPath = path.join(serverFolderPath, languageServerDllName);
        } else {
            actionContext.telemetry.properties.customServerDllPath = 'true';

            serverDllPath = serverDllPathSetting;
            if (fse.statSync(serverDllPathSetting).isDirectory()) {
                serverDllPath = path.join(serverDllPathSetting, languageServerDllName);
            }
            if (!fse.existsSync(serverDllPath)) {
                throw new Error(`Couldn't find the ARM language server at ${serverDllPath}.  Please verify or remove your 'armTools.languageServer.path' setting.`);
            }
        }

        return serverDllPath;
    });
}

async function ensureDependencies(dotnetExePath: string, serverDllPath: string): Promise<void> {
    await callWithTelemetryAndErrorHandling('ensureDotnetDependencies', async (actionContext: IActionContext) => {
        actionContext.errorHandling.rethrow = true;

        // Attempt to determine by running a .net app whether additional runtime dependencies are missing on the machine (Linux only),
        // and if necessary prompt the user whether to install them.
        await ensureDotnetDependencies(
            dotnetExePath,
            [
                serverDllPath,
                '--help'
            ],
            actionContext.telemetry.properties);
    });
}
