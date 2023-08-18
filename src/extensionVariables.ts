/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzExtOutputChannel } from "@microsoft/vscode-azext-utils";
import * as os from 'os';
import * as path from "path";
import * as vscode from "vscode";
// This is the documented way to use this module (https://github.com/microsoft/vscode-extension-samples/blob/main/lsp-sample/client/src/extension.ts)
// eslint-disable-next-line import/no-internal-modules
import { LanguageClient } from 'vscode-languageclient/node';
import { configPrefix, isWebpack } from "../common";
import { IProvideOpenedDocuments } from './IProvideOpenedDocuments';
import { DeploymentFileMapping } from "./documents/parameters/DeploymentFileMapping";
import { LanguageServerState } from "./languageclient/startArmLanguageServer";
import { ISnippetManager } from './snippets/ISnippetManager';
import { CompletionsSpy } from "./util/CompletionsSpy";
import { InitializeBeforeUse } from "./util/InitializeBeforeUse";
import { IConfiguration, VsCodeConfiguration } from './vscodeIntegration/Configuration';
import { JsonOutlineProvider } from "./vscodeIntegration/Treeview";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
// Work-around for https://github.com/microsoft/vscode/issues/83254 - store ext instance on global to keep it a singleton
// tslint:disable-next-line: class-name
class ExtensionVariables {
    public readonly extensionId: string = "msazurermtools.azurerm-vscode-tools";

    private _context: InitializeBeforeUse<vscode.ExtensionContext> = new InitializeBeforeUse<vscode.ExtensionContext>("_context");
    private _jsonOutlineProvider: InitializeBeforeUse<JsonOutlineProvider> = new InitializeBeforeUse<JsonOutlineProvider>("_jsonOutlineProvider");
    private _outputChannel: InitializeBeforeUse<IAzExtOutputChannel> = new InitializeBeforeUse<IAzExtOutputChannel>("_outputChannel");
    private _languageServerState: LanguageServerState = LanguageServerState.NotStarted;
    private _languageServerStateEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    public set context(context: vscode.ExtensionContext) {
        this._context.value = context;
    }
    public get context(): vscode.ExtensionContext {
        return this._context.value;
    }

    public set jsonOutlineProvider(context: JsonOutlineProvider) {
        this._jsonOutlineProvider.value = context;
    }
    public get jsonOutlineProvider(): JsonOutlineProvider {
        return this._jsonOutlineProvider.value;
    }

    public set outputChannel(outputChannel: IAzExtOutputChannel) {
        this._outputChannel.value = outputChannel;
    }
    public get outputChannel(): IAzExtOutputChannel {
        return this._outputChannel.value;
    }

    public EOL: string = os.EOL;
    public pathSeparator: string = path.sep;
    public provideOpenedDocuments: IProvideOpenedDocuments | undefined;

    public readonly ignoreBundle: boolean = !isWebpack;

    public languageServerClient: LanguageClient | undefined;
    public set languageServerState(value: LanguageServerState) {
        if (this._languageServerState !== value) {
            this._languageServerState = value;
            this._languageServerStateEmitter.fire();
        }
    }
    public get languageServerState(): LanguageServerState {
        return this._languageServerState;
    }
    public get languageServerStateChanged(): vscode.Event<void> {
        return this._languageServerStateEmitter.event;
    }
    public languageServerStartupError: string | undefined;

    public extensionStartupComplete: boolean | undefined;
    public extensionStartupError: string | undefined;

    // Suite support - lets us know when diagnostics have been completely published for a file
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Switch to using notifications?
    public addCompletedDiagnostic: boolean = false;

    // Note: We can't effectively change the configuration for all actions right now because
    // the language server reads the vscode configuration directly in order to
    // receive the parameter file mappings.
    public readonly configuration: IConfiguration = new VsCodeConfiguration(configPrefix);

    public readonly completionItemsSpy: CompletionsSpy = new CompletionsSpy();
    public deploymentFileMapping: InitializeBeforeUse<DeploymentFileMapping> = new InitializeBeforeUse<DeploymentFileMapping>("deploymentFileMapping");
    public snippetManager: InitializeBeforeUse<ISnippetManager> = new InitializeBeforeUse<ISnippetManager>("snippetManager", true);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
if (!(<any>global).vscodearm_ext) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (<any>global).vscodearm_ext = new ExtensionVariables();
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
export const ext: ExtensionVariables = (<any>global).vscodearm_ext;
