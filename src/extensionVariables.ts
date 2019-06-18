/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { IAzureUserInput, ITelemetryReporter } from "vscode-azureextensionui";
import { JsonOutlineProvider } from "./Treeview";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
export namespace ext {
    export const extensionId: string = "ms-azuretools.azurerm-vscode-tools";

    export let context: vscode.ExtensionContext;
    export let jsonOutlineProvider: JsonOutlineProvider;
    export let reporter: ITelemetryReporter;
    export let outputChannel: vscode.OutputChannel;
    export let ui: IAzureUserInput;
}
