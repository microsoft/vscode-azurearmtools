/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { IAzExtOutputChannel, IAzureUserInput, ITelemetryReporter } from "vscode-azureextensionui";
import { isWebpack } from "./constants";
import { LanguageServerState } from "./languageclient/startArmLanguageServer";
import { JsonOutlineProvider } from "./Treeview";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
// Work-around for https://github.com/microsoft/vscode/issues/83254 - store ext instance on global to keep it a singleton
// tslint:disable-next-line: class-name
class ExtensionVariables {
    public readonly extensionId: string = "msazurermtools.azurerm-vscode-tools";

    public context: vscode.ExtensionContext;
    public jsonOutlineProvider: JsonOutlineProvider;
    public reporter: ITelemetryReporter;
    public outputChannel: IAzExtOutputChannel;
    public ui: IAzureUserInput;
    public ignoreBundle: boolean = !isWebpack;

    public languageServerState: LanguageServerState = LanguageServerState.NotStarted;

    // Suite support - lets us know when diagnostics have been completely published for a file
    public addCompletedDiagnostic: boolean;
}

// tslint:disable-next-line: no-any
if (!(<any>global).vscodearm_ext) {
    // tslint:disable-next-line: no-any
    (<any>global).vscodearm_ext = new ExtensionVariables();
}

// tslint:disable-next-line: no-any no-unsafe-any
export const ext: ExtensionVariables = (<any>global).vscodearm_ext;
