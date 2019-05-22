// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment max-line-length // TODO:

import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import { callWithTelemetryAndErrorHandlingSync, parseError, TelemetryProperties } from 'vscode-azureextensionui';
import { Message } from 'vscode-jsonrpc';
import { CloseAction, ErrorAction, ErrorHandler, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { armDeploymentLanguageId } from '../constants';
import { ext } from '../extensionVariables';
import { armDeploymentDocumentSelector } from '../supported';

const languageServerName = 'ARM Language Server';
let serverStartMs: number;
const languageServerErrorTelemId = "Language Server Error";

export function startArmLanguageServer(context: ExtensionContext): void {
    callWithTelemetryAndErrorHandlingSync('startArmLanguageClient', () => {
        // The server is implemented in .NET Core. We run it by calling 'dotnet' with the dll as an argument

        let serverExe = 'dotnet.exe'; // 'c:\\Users\\stephwe\\.dotnet\\x64\\dotnet.exe'; //asdf

        // asdf remove old setting
        let serverDllPath = workspace.getConfiguration('armTools').get<string | undefined>('languageServer.path');

        if (typeof serverDllPath !== 'string' || serverDllPath === '') {
            // Check for the files under LanguageServerBin
            let serverFolderPath = context.asAbsolutePath('LanguageServerBin');
            serverDllPath = path.join(serverFolderPath, 'Microsoft.ArmLanguageServer.dll');
            if (!fs.existsSync(serverFolderPath) || !fs.existsSync(serverDllPath)) {
                throw new Error(`Couldn't find the ARM language server at ${serverDllPath}, you may need to reinstall the extension.`);
            }

            serverDllPath = path.join(serverFolderPath, 'Microsoft.ArmLanguageServer.dll');
        } else {
            if (!fs.existsSync(serverDllPath)) {
                throw new Error(`Couldn't find the ARM language server at ${serverDllPath}.  Please verify your 'armTools.languageServer.path' setting.`);
            }
        }

        // let serverExe = context.asAbsolutePath('D:/Development/Omnisharp/omnisharp-roslyn/artifacts/publish/OmniSharp.Stdio/win7-x64/OmniSharp.exe');
        // The debug options for the server
        // let debugOptions = { execArgv: ['-lsp', '-d' };

        // If the extension is launched in debug mode then the debug server options are used
        // Otherwise the run options are used

        // These trace levels are available in the server:
        //   Trace
        //   Debug
        //   Information
        //   Warning
        //   Error
        //   Critical
        //   None
        let trace: string = workspace.getConfiguration('armTools').get<string>("languageServer.traceLevel");

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
            commonArgs.push('--test-diagnostics');
        }

        let serverOptions: ServerOptions = {
            run: { command: serverExe, args: commonArgs },
            debug: { command: serverExe, args: commonArgs }
        };

        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            documentSelector: armDeploymentDocumentSelector,
            // synchronize: {
            //     // Synchronize the setting section 'languageServerExample' to the server
            //     // TODO: configurationSection: 'languageServerExampleTODO',
            //     fileEvents: workspace.createFileSystemWatcher('**/*.json')
            // },
            //asdf initializationFailedHandler
        };

        // Create the language client and start the client.
        ext.outputChannel.appendLine(`Starting ARM Language Server at ${serverDllPath}`);
        ext.outputChannel.appendLine(`Client options:\n${JSON.stringify(clientOptions, null, 2)}`);
        ext.outputChannel.appendLine(`Server options:\n${JSON.stringify(serverOptions, null, 2)}`);
        const client = new LanguageClient(armDeploymentLanguageId, languageServerName, serverOptions, clientOptions);

        let defaultHandler = client.createDefaultErrorHandler();
        client.clientOptions.errorHandler = new WrappedErrorHandler(defaultHandler);

        try {
            serverStartMs = Date.now();
            let disposable = client.start();
            // Push the disposable to the context's subscriptions so that the
            // client can be deactivated on extension deactivation
            context.subscriptions.push(disposable);
        } catch (error) {
            throw new Error(
                // tslint:disable-next-line: prefer-template
                `${languageServerName}: unexpectedly failed to start.\n\n` +
                parseError(error).message);
        }
    });
}

class WrappedErrorHandler implements ErrorHandler {
    constructor(private _handler: ErrorHandler) {
    }

    /**
     * An error has occurred while writing or reading from the connection.
     *
     * @param error - the error received
     * @param message - the message to be delivered to the server if known.
     * @param count - a count indicating how often an error is received. Will
     *  be reset if a message got successfully send or received.
     */
    public error(error: Error, message: Message | undefined, count: number): ErrorAction {
        let parsed = parseError(error);
        ext.reporter.sendTelemetryEvent(
            languageServerErrorTelemId,
            <TelemetryProperties>{
                error: parsed.errorType,
                errorMessage: parsed.message,
                result: "Failed",
                jsonrpcMessage: message ? message.jsonrpc : "",
                count: String(count),
                stack: parsed.stack
            },
            {
                secondsSinceStart: (Date.now() - serverStartMs) / 1000
            });

        return this._handler.error(error, message, count);
    }

    /**
     * The connection to the server got closed.
     */
    public closed(): CloseAction {
        ext.reporter.sendTelemetryEvent(
            languageServerErrorTelemId,
            <TelemetryProperties>{
                error: "Crashed",
                errorMessage: '(Language server crashed)',
                result: "Failed"
            },
            {
                secondsSinceStart: (Date.now() - serverStartMs) / 1000
            });

        return this._handler.closed();
    }
}
