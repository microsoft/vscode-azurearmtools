/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { CancellationToken, CompletionContext, CompletionItem, CompletionList, Diagnostic, Event, EventEmitter, Position, ProgressLocation, TextDocument, Uri, window, workspace } from 'vscode';
import { callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync, IActionContext, ITelemetryContext, parseError } from 'vscode-azureextensionui';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions } from 'vscode-languageclient';
import { delay } from '../../test/support/delay';
import { acquireSharedDotnetInstallation } from '../acquisition/acquireSharedDotnetInstallation';
import { armTemplateLanguageId, backendValidationDiagnosticsSource, configKeys, configPrefix, downloadDotnetVersion, languageFriendlyName, languageServerFolderName, languageServerName, notifications } from '../constants';
import { convertDiagnosticUrisToLinkedTemplateSchema, INotifyTemplateGraphArgs, IRequestOpenLinkedFileArgs, onRequestOpenLinkedFile } from '../documents/templates/linkedTemplates/linkedTemplates';
import { templateDocumentSelector } from '../documents/templates/supported';
import { ext } from '../extensionVariables';
import { assert } from '../fixed_assert';
import { assertNever } from '../util/assertNever';
import { delayWhileSync } from '../util/delayWhileSync';
import { WrappedErrorHandler } from './WrappedErrorHandler';

const languageServerDllName = 'Microsoft.ArmLanguageServer.dll';
const defaultTraceLevel = 'Warning';
const _notifyTemplateGraphAvailableEmitter: EventEmitter<INotifyTemplateGraphArgs & ITelemetryContext> = new EventEmitter<INotifyTemplateGraphArgs & ITelemetryContext>();

let haveFirstSchemasStartedLoading: boolean = false;
let haveFirstSchemasFinishedLoading: boolean = false;
let isShowingLoadingSchemasProgress: boolean = false;

export enum LanguageServerState {
    NotStarted, // 0
    Starting, // 1
    Failed, // 2
    Running, // 3
    Stopped, // 4
    LoadingSchemas, // 5
}

/**
 * An event that fires when the language server notifies us of the current full template graph of a root template
 */
export const notifyTemplateGraphAvailable: Event<INotifyTemplateGraphArgs & ITelemetryContext> = _notifyTemplateGraphAvailableEmitter.event;

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
    // tslint:disable-next-line: no-console
    console.log(">>> startArmLanguageServerInBackground");

    switch (ext.languageServerState) {
        case LanguageServerState.Running:
        case LanguageServerState.Starting:
        case LanguageServerState.LoadingSchemas:
            // Nothing to do
            return;

        case LanguageServerState.Failed:
        case LanguageServerState.NotStarted:
        case LanguageServerState.Stopped:
            break;

        default:
            assertNever(ext.languageServerState);
    }

    ext.languageServerState = LanguageServerState.Starting;

    window.withProgress(
        {
            location: ProgressLocation.Notification,
            title: `Starting ${languageServerName}`
        },
        async () => {
            try {
                await callWithTelemetryAndErrorHandling('startArmLanguageServer', async (actionContext: IActionContext) => {
                    try {
                        // The server is implemented in .NET Core. We run it by calling 'dotnet' with the dll as an argument
                        let serverDllPath: string = findLanguageServer();
                        let dotnetExePath: string | undefined = await getDotNetPath();
                        if (!dotnetExePath) {
                            // Acquisition failed
                            ext.languageServerStartupError = ".dotnet acquisition returned no path";
                            ext.languageServerState = LanguageServerState.Failed;
                            return;
                        }

                        await startLanguageClient(serverDllPath, dotnetExePath);

                        ext.languageServerState = haveFirstSchemasFinishedLoading ?
                            LanguageServerState.Running :
                            LanguageServerState.LoadingSchemas;
                    } catch (error) {
                        ext.languageServerStartupError = `${parseError(error).message}: ${error instanceof Error ? error.stack : 'no stack'}`;
                        ext.languageServerState = LanguageServerState.Failed;
                        throw error;
                    }
                });
            } catch (err) {
                assert.fail("callWithTelemetryAndErrorHandling in startArmLanguageServerInBackground onTemplateGraphAvailable shouldn't throw");
            }

            // tslint:disable-next-line: no-console
            console.log(">>> startArmLanguageServerInBackground DONE");
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

async function startLanguageClient(serverDllPath: string, dotnetExePath: string): Promise<void> {
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
            },
            middleware: {
                handleDiagnostics: (uri: Uri, diagnostics: Diagnostic[], next: (uri: Uri, diagnostics: Diagnostic[]) => void): void => {
                    for (const d of diagnostics) {
                        if (d.source === backendValidationDiagnosticsSource) {
                            convertDiagnosticUrisToLinkedTemplateSchema(d);
                        }
                    }
                    next(uri, diagnostics);
                },
                provideCompletionItem: async (document: TextDocument, position: Position, context: CompletionContext, token: CancellationToken, next: (document: TextDocument, position: Position, context: CompletionContext, token: CancellationToken) => undefined | null | CompletionItem[] | CompletionList | Thenable<undefined | null | CompletionItem[] | CompletionList>): Promise<undefined | null | CompletionItem[] | CompletionList> => {
                    let result: CompletionItem[] | CompletionList | undefined | null = await next(document, position, context, token);

                    if (result) {
                        let items: CompletionList | CompletionItem[] = result;
                        let isIncomplete: boolean = false;
                        if (items instanceof CompletionList) {
                            isIncomplete = items.isIncomplete ?? false;
                            items = items.items;
                        }

                        if (items.every(item => isApiVersion(item.label))) {
                            // It's a list of apiVersion completions
                            // Show them in reverse order so the newest is at the top of the list
                            const countItems = items.length;
                            items = items.map((ci, index) => {
                                if (!ci.sortText) {
                                    let sortText = (countItems - index).toString(10);
                                    sortText = sortText.padStart(10 - sortText.length, '0');
                                    ci.sortText = sortText;
                                }
                                return ci;
                            });
                            result = new CompletionList(items, isIncomplete);
                        }
                    }

                    return result;
                },
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
            clientOptions,
        );

        // Use an error handler that sends telemetry
        let defaultHandler = client.createDefaultErrorHandler();
        client.clientOptions.errorHandler = new WrappedErrorHandler(defaultHandler);

        if (waitForDebugger) {
            window.showWarningMessage(`The ${configPrefix}.languageServer.waitForDebugger option is set.  The language server will pause on startup until a debugger is attached.`);
        }

        client.onTelemetry((telemetryData: { eventName: string; properties: { [key: string]: string | undefined } }) => {
            const eventName = telemetryData.eventName.replace(/^\/|\/$/g, ""); // Remove slashes at beginning or end
            const fullEventName = `langserver/${eventName}`;

            if (sanitizeTelemetryData(fullEventName, telemetryData.properties)
            ) {
                callWithTelemetryAndErrorHandlingSync(fullEventName, telemetryActionContext => {
                    telemetryActionContext.errorHandling.suppressDisplay = true;

                    for (let prop of Object.getOwnPropertyNames(telemetryData.properties)) {
                        const value = telemetryData.properties[prop];
                        prop = prop.replace(/^\./g, ""); // Remove starting period
                        telemetryActionContext.telemetry.properties[prop] = String(value);
                    }

                    if (telemetryActionContext.telemetry.properties.error) {
                        telemetryActionContext.telemetry.properties.result = 'Failed';
                    }
                });
            }
        });

        try {
            // client.trace = Trace.Messages;

            let disposable = client.start();
            ext.context.subscriptions.push(disposable);

            await client.onReady();
            ext.languageServerClient = client;

            client.onRequest(notifications.requestOpenLinkedTemplate, async (args: IRequestOpenLinkedFileArgs) => {
                return onRequestOpenLinkedFile(args);
            });

            client.onNotification(notifications.notifyTemplateGraph, async (args: INotifyTemplateGraphArgs) => {
                onNotifyTemplateGraph(args);
            });

            client.onNotification(notifications.schemaValidationNotification, async (args: notifications.ISchemaValidationNotificationArgs) => {
                onSchemaValidationNotication(args);
            });
        } catch (error) {
            throw new Error(
                `${languageServerName}: An error occurred starting the language server.${os.EOL}${os.EOL}${parseError(error).message}`
            );
        }
    });
}

function sanitizeTelemetryData(fullEventName: string, properties: { [key: string]: string | undefined }): boolean {
    switch (fullEventName) {
        case 'langserver/VS/WebTools/Languages/JSON/UnrecognizedResourceApiVersion':
            if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}(-(alpha|beta|preview)+)?$/i.test(properties['vS.WebTools.Languages.JSON.apiVersion'] ?? '')) {
                {
                    return false;
                }
            }

            properties['vS.WebTools.Languages.JSON.apiVersion'] = properties['vS.WebTools.Languages.JSON.apiVersion']?.toLowerCase();
            properties['vS.WebTools.Languages.JSON.type'] = properties['vS.WebTools.Languages.JSON.type']
                ?.replace('/', '@')
                .toLowerCase();
            return true;

        default:
            return true;
    }
}

async function getDotNetPath(): Promise<string | undefined> {
    return await callWithTelemetryAndErrorHandling("getDotNetPath", async (actionContext: IActionContext) => {
        actionContext.errorHandling.rethrow = true;
        actionContext.errorHandling.suppressDisplay = true; // Let caller handle

        let dotnetPath: string | undefined;

        const overriddenDotNetExePath = workspace.getConfiguration(configPrefix).get<string>(configKeys.dotnetExePath);
        if (typeof overriddenDotNetExePath === "string" && !!overriddenDotNetExePath) {
            ext.outputChannel.appendLine(
                `WARNING: ${configPrefix}.${configKeys.dotnetExePath} is set. ` +
                `This overrides the automatic download and usage of the dotnet runtime and should only be used to work around dotnet installation issues. ` +
                `If you encounter problems, please try clearing this setting.`);
            ext.outputChannel.appendLine("");
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

/**
 * Handles a notification from the language server that provides us the linked template reference graph
 * @param sourceTemplateUri The full URI of the template which contains the link
 * @param requestedLinkPath The full URI of the resolved link being requested
 */

function onNotifyTemplateGraph(args: INotifyTemplateGraphArgs): void {
    callWithTelemetryAndErrorHandlingSync('notifyTemplateGraph', async (context: IActionContext) => {
        _notifyTemplateGraphAvailableEmitter.fire(<INotifyTemplateGraphArgs & ITelemetryContext>Object.assign({}, context.telemetry, args));
    });
}

function onSchemaValidationNotication(args: notifications.ISchemaValidationNotificationArgs): void {
    if (!haveFirstSchemasStartedLoading) {
        haveFirstSchemasStartedLoading = true;
    }
    if (args.completed && !haveFirstSchemasFinishedLoading) {
        haveFirstSchemasFinishedLoading = true;
    }

    const isLoadingSchemas = haveFirstSchemasStartedLoading && !haveFirstSchemasFinishedLoading;
    const newState =
        (isLoadingSchemas && ext.languageServerState === LanguageServerState.Running)
            ? LanguageServerState.LoadingSchemas
            : (!isLoadingSchemas && ext.languageServerState === LanguageServerState.LoadingSchemas)
                ? LanguageServerState.Running
                : ext.languageServerState;
    ext.languageServerState = newState;

    if (newState === LanguageServerState.LoadingSchemas) {
        showLoadingSchemasProgress();
    }
}

function showLoadingSchemasProgress(): void {
    if (!isShowingLoadingSchemasProgress) {
        isShowingLoadingSchemasProgress = true;
        window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: `Loading ARM schemas`
            },
            async () => delayWhileSync(500, () => ext.languageServerState === LanguageServerState.LoadingSchemas)
        ).then(() => {
            isShowingLoadingSchemasProgress = false;
        });
    }
}

export async function waitForLanguageServerAvailable(): Promise<void> {
    const currentState = ext.languageServerState;
    switch (currentState) {
        case LanguageServerState.Stopped: {
            const msg = 'Cannot start language server. It is in a stopped state.';
            ext.outputChannel.appendLine(msg);
            throw new Error(msg);
        }

        case LanguageServerState.Failed: {
            const msg = `Language server failed on start-up: ${ext.languageServerStartupError}`;
            ext.outputChannel.appendLine(msg);
            throw new Error(msg);
        }

        case LanguageServerState.NotStarted:
            startArmLanguageServerInBackground();
            break;

        case LanguageServerState.Running:
            return;

        case LanguageServerState.LoadingSchemas:
        case LanguageServerState.Starting:
            break;

        default:
            assertNever(currentState);
    }

    // tslint:disable-next-line: no-constant-condition
    while (true) {
        switch (ext.languageServerState) {
            case LanguageServerState.Failed: {
                const msg = `Language server failed on start-up: ${ext.languageServerStartupError}`;
                ext.outputChannel.appendLine(msg);
                throw new Error(msg);
            }

            case LanguageServerState.NotStarted:
            case LanguageServerState.Starting:
            case LanguageServerState.LoadingSchemas:
                await delay(100);
                break;
            case LanguageServerState.Running:
                await delay(1000); // Give vscode time to notice the new formatter available (I don't know of a way to detect this)

                ext.outputChannel.appendLine("Language server is ready.");
                assert(ext.languageServerClient);
                return;

            case LanguageServerState.Stopped: {
                const msg = 'Language server has stopped';
                throw new Error(msg);
            }

            default:
                assertNever(ext.languageServerState);
        }
    }
}

function isApiVersion(s: string): boolean {
    return /^[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9a-zA-Z]+)?$/.test(s);
}
