/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import { ext } from '../extensionVariables';

export async function reloadSchemas(): Promise<void> {

    if (ext.languageServerClient) {
        ext.outputChannel.appendLine("Reloading schemas");

        await ext.languageServerClient.sendRequest('schema/reloadSchemas', {});

        window.showInformationMessage("Azure schema cache has been cleared. Please restart Visual Studio Code to reload schemas.");
    } else {
        throw new Error("Language server is not yet ready. Please try again in a little while.");
    }

}
