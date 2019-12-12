/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from '../extensionVariables';

export async function reloadSchemas(): Promise<void> {

    if (ext.languageServerClient) {
        ext.outputChannel.appendLine("Reloading schemas");

        await ext.languageServerClient.sendRequest('schema/reloadSchemas', {});
    }
    else {
        ext.outputChannel.appendLine("Language server is not yet ready");
    }

}
