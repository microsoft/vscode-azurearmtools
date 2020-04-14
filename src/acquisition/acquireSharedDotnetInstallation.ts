/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { commands } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext, parseError } from 'vscode-azureextensionui';
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
        actionContext.errorHandling.suppressDisplay = true;

        let message: string | undefined;
        let result: IDotnetAcquireResult | undefined;
        let dotnetPath: string | undefined;

        try {
            result = await commands.executeCommand<IDotnetAcquireResult>('dotnet.acquire', { version });
        } catch (err) {
            message = parseError(err).message;
        }
        if (!message) {
            if (!result) {
                message = "dotnet.acquire returned undefined";
            } else {
                dotnetPath = result.dotnetPath;
                if (!dotnetPath) {
                    message = "dotnet.acquire returned undefined";
                }
            }
        }

        if (message) {
            const linkMessage = `This extension requires .NET Core for full functionality, but we were unable to download and install a local copy for the extension. If this error persists, please see https://aka.ms/vscode-armtools-dotnet for troubleshooting tips.`;
            const err = wrapError(linkMessage, `Details: ${message}`);
            ext.outputChannel.appendLog(parseError(err).message);
            ext.outputChannel.appendLog(`See '.NET Core Tooling' in the output window for more information.`);
            ext.outputChannel.show();
            throw err;
        }

        return dotnetPath;
    });
}
