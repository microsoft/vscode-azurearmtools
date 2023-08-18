/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { callWithTelemetryAndErrorHandling, IActionContext, parseError } from '@microsoft/vscode-azext-utils';
import { commands } from 'vscode';
import { ext } from '../extensionVariables';
import { wrapError } from '../util/wrapError';

interface IDotnetAcquireResult {
    dotnetPath: string;
}

// Returns undefined if acquisition fails.
export async function acquireSharedDotnetInstallation(version: string): Promise<string | undefined> {
    return await callWithTelemetryAndErrorHandling('acquireSharedDotnet', async (actionContext: IActionContext) => {
        // If this fails, the dotnet.acquire extension should display its own error, so no need to do
        // it here, other than to our output channel.
        actionContext.errorHandling.suppressDisplay = true; // Allow caller to handle
        actionContext.errorHandling.rethrow = false;

        let message: string | undefined;
        let result: IDotnetAcquireResult | undefined;
        let dotnetPath: string | undefined;

        try {
            result = await commands.executeCommand<IDotnetAcquireResult>(
                'dotnet.acquire',
                {
                    version,
                    requestingExtensionId: ext.extensionId
                });
        } catch (err) {
            message = parseError(err).message;
        }
        actionContext.telemetry.properties.dotnetAcquireResult = result?.dotnetPath ? 'path returned' : 'undefined';

        if (!message) {
            if (!result) {
                message = "dotnet.acquire failed";
            } else {
                dotnetPath = result.dotnetPath;
                if (!dotnetPath) {
                    message = "dotnet.acquire returned an undefined dotnetPath";
                }
            }
        }

        if (message) {
            const linkMessage = `This extension requires .NET Core for full functionality, but we were unable to download and install a local copy for the extension. If this error persists, please see https://aka.ms/vscode-armtools-dotnet for troubleshooting tips.`;
            const err = wrapError(linkMessage, `Details: ${message}`);
            ext.outputChannel.appendLog(parseError(err).message);
            ext.outputChannel.appendLog(`See '.NET Runtime' in the output window for more information.`);
            ext.outputChannel.show();
            actionContext.telemetry.properties.dotnetAcquireError = message;
            throw err;
        }

        return dotnetPath;
    });
}
