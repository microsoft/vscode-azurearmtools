// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment max-line-length // TODO:

import { ExtensionContext, workspace } from 'vscode';
import { Trace } from 'vscode-jsonrpc';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';

export function startArmLanguageClient(context: ExtensionContext): void {
    // The server is implemented in node // TODO:
    // let serverExe = 'dotnet';

    let serverExe = 'C:\\Users\\stephwe\\Repos\\arm-language-server\\arm-language-server\\bin\\Debug\\netcoreapp2.2\\win-x64\\arm-language-server.exe';
    // let serverExe = context.asAbsolutePath('D:/Development/Omnisharp/omnisharp-roslyn/artifacts/publish/OmniSharp.Stdio/win7-x64/OmniSharp.exe');
    // The debug options for the server
    // let debugOptions = { execArgv: ['-lsp', '-d' };5

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions: ServerOptions = {
        run: { command: serverExe, args: ['-lsp', '-d'] }, //TODO:
        debug: { command: serverExe, args: ['-lsp', '-d'] } // TODO:         let debugOptions = { execArgv: ['--nolazy', '--debug=6005', '--inspect'] };
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
    const client = new LanguageClient('arm-deployment', 'ARM Deployment Template Language Server', serverOptions, clientOptions);
    client.trace = Trace.Verbose;
    // TODO: client.clientOptions.errorHandler
    let disposable = client.start();

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(disposable);
}
