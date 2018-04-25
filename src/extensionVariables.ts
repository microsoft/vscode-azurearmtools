/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { JsonOutlineProvider } from "./Treeview";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
export namespace ext {
    export const extensionId: string = "msazurermtools.azurerm-vscode-tools";

    export let extensionContext: vscode.ExtensionContext;
    export let jsonOutlineProvider: JsonOutlineProvider;
}
