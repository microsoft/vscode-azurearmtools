// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment max-line-length // TODO:

import { ExtensionContext, window, workspace } from 'vscode';
import { Trace } from 'vscode-jsonrpc';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';

export function startArmLanguageClient(context: ExtensionContext): void {
    // The server is implemented in node // TODO:
    // let serverExe = 'dotnet';

    let serverExe = 'C:\\Users\\stephwe\\Repos\\arm-language-server\\arm-language-server\\bin\\Debug\\netcoreapp2.2\\win-x64\\arm-language-server.exe';
    let serverDll = 'C:\\Users\\stephwe\\Repos\\arm-language-server\\arm-language-server\\bin\\Debug\\netcoreapp2.2\\arm-language-server.dll';
    serverExe = 'c:\\Users\\stephwe\\.dotnet\\x64\\dotnet.exe';

    // let serverExe = context.asAbsolutePath('D:/Development/Omnisharp/omnisharp-roslyn/artifacts/publish/OmniSharp.Stdio/win7-x64/OmniSharp.exe');
    // The debug options for the server
    // let debugOptions = { execArgv: ['-lsp', '-d' };5

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions: ServerOptions = {
        run: { command: serverExe, args: [serverDll, '-lsp', '--debug', '--logLevel', getLogLevelString(Trace.Verbose)] }, //TODO:
        debug: { command: serverExe, args: [serverDll, '-lsp', '--debug', '--logLevel', getLogLevelString(Trace.Verbose)] } // TODO:         let debugOptions = { execArgv: ['--nolazy', '--debug=6005', '--inspect'] };
    };

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [
            {
                pattern: '**/*.json',
                // TODO: { language: 'arm-deployment', scheme: 'file' },
                // TODO:  { language: 'arm-deployment', scheme: 'untitled' }
            }
        ],
        synchronize: {
            // Synchronize the setting section 'languageServerExample' to the server
            // TODO: configurationSection: 'languageServerExampleTODO',
            fileEvents: workspace.createFileSystemWatcher('**/*.json')
        }
    };

    // Create the language client and start the client.
    // tslint:disable-next-line:no-single-line-block-comment
    const client = new LanguageClient('arm-deployment', 'ARM Deployment Language Server', serverOptions, clientOptions, true/*asdf*/);
    client.trace = Trace.Verbose;
    // TODO: client.clientOptions.errorHandler
    let handler = client.createDefaultErrorHandler();

    try {
        let disposable = client.start();
        // Push the disposable to the context's subscriptions so that the
        // client can be deactivated on extension deactivation
        context.subscriptions.push(disposable);
    } catch (error) {
        window.showErrorMessage(
            'ARM Deployment Template Language Server failed to start unexpectedly, ' +
            'please check the output log and report an issue.'); //asdf where?

        // asdf this.telemetryReporter.reportErrorOnServerStart(error);
    }
}

function getLogLevelString(trace: Trace): string {
    switch (trace) {
        case Trace.Off:
            return 'None';
        case Trace.Messages:
            return 'Information';
        case Trace.Verbose:
            return 'Trace';
        default:
            throw new Error(`Unexpected trace value: '${Trace[trace]}'`);
    }
}
