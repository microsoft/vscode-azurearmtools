/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { ProgressLocation, window, workspace } from 'vscode';
import { callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync, IActionContext, parseError } from 'vscode-azureextensionui';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions } from 'vscode-languageclient';
import { acquireSharedDotnetInstallation } from '../acquisition/acquireSharedDotnetInstallation';
import { armTemplateLanguageId, configKeys, configPrefix, downloadDotnetVersion, languageFriendlyName, languageServerFolderName, languageServerName } from '../constants';
import { templateDocumentSelector } from '../documents/templates/supported';
import { ext } from '../extensionVariables';
import { assert } from '../fixed_assert';
import { WrappedErrorHandler } from './WrappedErrorHandler';

const languageServerDllName = 'Microsoft.ArmLanguageServer.dll';
const defaultTraceLevel = 'Warning';

export enum LanguageServerState {
    NotStarted,
    Starting,
    Failed,
    Started,
    Stopped,
}

export async function stopArmLanguageServer(): Promise<void> {
    // Work-around for https://github.com/microsoft/vscode/issues/83254 - store languageServerState global via ext to keep it a singleton

    if (ext.languageServerState === LanguageServerState.NotStarted || ext.languageServerState === LanguageServerState.Stopped) {
        ext.outputChannel.appendLine(`${languageServerName} already stopped...`);
        return;
    }

    ext.outputChannel.appendLine(`Stopping ${languageServerName}...`);
    ext.languageServerState = LanguageServerState.Stopped;
    if (ext.languageServerClient) {
        let client: LanguageClient = ext.languageServerClient;
        ext.languageServerClient = undefined;
        await client.stop();
    }

    ext.outputChannel.appendLine("Language server stopped");
}

export function startArmLanguageServerInBackground(): void {
    window.withProgress(
        {
            location: ProgressLocation.Window,
            title: `Starting ${languageServerName}`
        },
        async () => {
            await callWithTelemetryAndErrorHandling('startArmLanguageServer', async (actionContext: IActionContext) => {
                actionContext.telemetry.suppressIfSuccessful = true;

                ext.languageServerState = LanguageServerState.Starting;
                try {
                    // The server is implemented in .NET Core. We run it by calling 'dotnet' with the dll as an argument
                    let serverDllPath: string = findLanguageServer();
                    let dotnetExePath: string | undefined = await getDotNetPath();
                    if (!dotnetExePath) {
                        // Acquisition failed
                        ext.languageServerState = LanguageServerState.Failed;
                        return;
                    }

                    await startLanguageClient(serverDllPath, dotnetExePath);

                    ext.languageServerState = LanguageServerState.Started;
                } catch (error) {
                    ext.languageServerState = LanguageServerState.Failed;
                    throw error;
                }
            });
        });
}

async function getLangServerVersion(): Promise<string | undefined> {
    return await callWithTelemetryAndErrorHandling('getLangServerVersion', async (actionContext: IActionContext) => {
        actionContext.errorHandling.suppressDisplay = true;
        actionContext.telemetry.suppressIfSuccessful = true;

        const packagePath = ext.context.asAbsolutePath('package.json');
        const packageContents = <{ config: { ARM_LANGUAGE_SERVER_NUGET_VERSION: string } }>await fse.readJson(packagePath);
        return packageContents.config.ARM_LANGUAGE_SERVER_NUGET_VERSION;
    });
}

export async function startLanguageClient(serverDllPath: string, dotnetExePath: string): Promise<void> {
    // tslint:disable-next-line: no-suspicious-comment
    // tslint:disable-next-line: max-func-body-length // TODO: Refactor function
    await callWithTelemetryAndErrorHandling('startArmLanguageClient', async (actionContext: IActionContext) => {
        actionContext.errorHandling.rethrow = true;
        actionContext.errorHandling.suppressDisplay = true; // Let caller handle

        // These trace levels are available in the server:
        //   Trace
        //   Debug
        //   Information
        //   Warning
        //   Error
        //   Critical
        //   None
        let trace: string = workspace.getConfiguration(configPrefix).get<string>(configKeys.traceLevel)
            // tslint:disable-next-line: strict-boolean-expressions
            || defaultTraceLevel;

        let commonArgs = [
            serverDllPath,
            '--logLevel',
            trace
        ];

        const waitForDebugger = workspace.getConfiguration(configPrefix).get<boolean>(configKeys.waitForDebugger, false) === true;
        if (waitForDebugger) {
            commonArgs.push('--wait-for-debugger');
        }
        if (ext.addCompletedDiagnostic) {
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
            documentSelector: templateDocumentSelector,
            diagnosticCollectionName: `${languageServerName} diagnostics`,
            outputChannel: ext.outputChannel, // Use the same output channel as the extension does
            revealOutputChannelOn: RevealOutputChannelOn.Error,
            synchronize: {
                configurationSection: configPrefix
            }
        };

        // Create the language client and start the client.
        // tslint:disable-next-line: strict-boolean-expressions
        const langServerVersion = (await getLangServerVersion()) || "Unknown";
        actionContext.telemetry.properties.langServerNugetVersion = langServerVersion;
        ext.outputChannel.appendLine(`Starting ${languageServerName} at ${serverDllPath}`);
        ext.outputChannel.appendLine(`Language server nuget version: ${langServerVersion}`);
        ext.outputChannel.appendLine(`Client options:${os.EOL}${JSON.stringify(clientOptions, undefined, 2)}`);
        ext.outputChannel.appendLine(`Server options:${os.EOL}${JSON.stringify(serverOptions, undefined, 2)}`);
        let client: LanguageClient = new LanguageClient(
            armTemplateLanguageId,
            languageFriendlyName, // Used in the Output window combobox
            serverOptions,
            clientOptions
        );

        // Use an error handler that sends telemetry
        let defaultHandler = client.createDefaultErrorHandler();
        client.clientOptions.errorHandler = new WrappedErrorHandler(defaultHandler);

        if (waitForDebugger) {
            window.showWarningMessage(`The ${configPrefix}.languageServer.waitForDebugger option is set.  The language server will pause on startup until a debugger is attached.`);
        }

        client.onTelemetry((telemetryData: { eventName: string; properties: { [key: string]: string | undefined } }) => {
            callWithTelemetryAndErrorHandlingSync(telemetryData.eventName, telemetryActionContext => {
                telemetryActionContext.errorHandling.suppressDisplay = true;
                telemetryActionContext.telemetry.properties = telemetryData.properties;
            });
        });

        try {
            let disposable = client.start();
            ext.context.subscriptions.push(disposable);

            await client.onReady();
            ext.languageServerClient = client;
        } catch (error) {
            throw new Error(
                `${languageServerName}: An error occurred starting the language server.${os.EOL}${os.EOL}${parseError(error).message}`
            );
        }
    });
}

async function getDotNetPath(): Promise<string | undefined> {
    return await callWithTelemetryAndErrorHandling("getDotNetPath", async (actionContext: IActionContext) => {
        actionContext.errorHandling.rethrow = true;
        actionContext.errorHandling.suppressDisplay = true; // Let caller handle

        let dotnetPath: string | undefined;

        const overriddenDotNetExePath = workspace.getConfiguration(configPrefix).get<string>(configKeys.dotnetExePath);
        if (typeof overriddenDotNetExePath === "string" && !!overriddenDotNetExePath) {
            if (!(await isFile(overriddenDotNetExePath))) {
                throw new Error(`Invalid path given for ${configPrefix}.${configKeys.dotnetExePath} setting. Must point to dotnet executable. Could not find file ${overriddenDotNetExePath}`);
            }
            dotnetPath = overriddenDotNetExePath;
            actionContext.telemetry.properties.overriddenDotNetExePath = "true";
        } else {
            actionContext.telemetry.properties.overriddenDotNetExePath = "false";

            dotnetPath = await acquireSharedDotnetInstallation(downloadDotnetVersion);
            if (!dotnetPath) {
                // Error is handled by dotnet extension
                actionContext.errorHandling.suppressDisplay = true;
                actionContext.errorHandling.rethrow = false;
                throw new Error("acquireSharedDotnetInstallation failed (didn't return a path)");
            }

            if (!(await isFile(dotnetPath))) {
                throw new Error(`The path returned for .net core does not exist: ${dotnetPath}`);
            }

            // Telemetry: dotnet version actually used
            try {
                // E.g. "c:\Users\<user>\AppData\Roaming\Code - Insiders\User\globalStorage\msazurermtools.azurerm-vscode-tools\.dotnet\2.2.5\dotnet.exe"
                const versionMatch = dotnetPath.match(/dotnet[\\/]([^\\/]+)[\\/]/);
                // tslint:disable-next-line: strict-boolean-expressions
                const actualVersion = versionMatch && versionMatch[1] || 'unknown';
                actionContext.telemetry.properties.dotnetVersionInstalled = actualVersion;
            } catch (error) {
                // ignore (telemetry only)
            }
        }

        ext.outputChannel.appendLine(`Using dotnet core executable at ${dotnetPath}`);

        return dotnetPath;
    });
}

function findLanguageServer(): string {
    const serverDllPath: string | undefined = callWithTelemetryAndErrorHandlingSync('findLanguageServer', (actionContext: IActionContext) => {
        actionContext.errorHandling.rethrow = true;
        actionContext.errorHandling.suppressDisplay = true; // Let caller handle

        let serverDllPathSetting: string | undefined = workspace.getConfiguration(configPrefix).get<string | undefined>(configKeys.langServerPath);
        if (typeof serverDllPathSetting !== 'string' || serverDllPathSetting === '') {
            actionContext.telemetry.properties.customServerDllPath = 'false';

            // Default behavior: <configPrefix>.languageServer.path is not set - look for the files in their normal installed location under languageServerFolderName
            const serverFolderPath = ext.context.asAbsolutePath(languageServerFolderName);
            const fullPath = path.join(serverFolderPath, languageServerDllName);
            if (!fse.existsSync(serverFolderPath) || !fse.existsSync(fullPath)) {
                throw new Error(`Cannot find the ${languageServerName} at ${fullPath}. Only template string expression functionality will be available.`);
            }
            return fullPath;
        } else {
            actionContext.telemetry.properties.customServerDllPath = 'true';

            let fullPath = serverDllPathSetting.trim();
            if (fse.statSync(fullPath).isDirectory()) {
                fullPath = path.join(fullPath, languageServerDllName);
            }
            if (!fse.existsSync(fullPath)) {
                throw new Error(`Couldn't find the ${languageServerName} at ${fullPath}.  Please verify or remove your '${configPrefix}.languageServer.path' setting.`);
            }

            window.showInformationMessage(`Using custom path for ${languageServerName}: ${fullPath}`);
            return fullPath;
        }
    });

    assert(typeof serverDllPath === "string", "Should have thrown instead of returning undefined");
    // tslint:disable-next-line:no-non-null-assertion // Asserted
    return serverDllPath!;
}

async function isFile(pathPath: string): Promise<boolean> {
    return (await fse.pathExists(pathPath)) && (await fse.stat(pathPath)).isFile();
}
