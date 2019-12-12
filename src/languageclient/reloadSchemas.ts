/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from '../extensionVariables';
import { ReloadShemasRequest } from './ReloadSchemasRequest';

export async function reloadSchemas(): Promise<void> {

    ext.outputChannel.appendLine("Reloading schemas...");

    if (ext.languageServerClient) {
        const request = new ReloadShemasRequest();
        await ext.languageServerClient.sendRequest<ReloadShemasRequest>('schema/reloadSchemas', request);
    }

    ext.outputChannel.appendLine("Schemas reloaded");
}
