/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parseError, TelemetryProperties } from 'vscode-azureextensionui';
import { Message } from 'vscode-jsonrpc';
import { CloseAction, ErrorAction, ErrorHandler } from 'vscode-languageclient';
import { ext } from '../extensionVariables';
import { languageServerErrorTelemId, serverStartMs } from './startArmLanguageServer';

// tslint:disable-next-line:no-suspicious-comment
// TODO: manual testing (in a later PR focused on error handling)
export class WrappedErrorHandler implements ErrorHandler {
    constructor(private _handler: ErrorHandler) {
    }

    /**
     * An error has occurred while writing or reading from the connection.
     *
     * @param error - the error received
     * @param message - the message to be delivered to the server if known.
     * @param count - a count indicating how often an error is received. Will
     *  be reset if a message got successfully send or received.
     */
    public error(error: Error, message: Message | undefined, count: number): ErrorAction {
        let parsed = parseError(error);
        ext.reporter.sendTelemetryEvent(
            languageServerErrorTelemId,
            <TelemetryProperties>{
                error: parsed.errorType,
                errorMessage: parsed.message,
                result: "Failed",
                jsonrpcMessage: message ? message.jsonrpc : "",
                count: String(count),
                stack: parsed.stack
            },
            {
                secondsSinceStart: (Date.now() - serverStartMs) / 1000
            });
        return this._handler.error(error, message, count);
    }

    /**
     * The connection to the server got closed.
     */
    public closed(): CloseAction {
        ext.reporter.sendTelemetryEvent(
            languageServerErrorTelemId,
            <TelemetryProperties>{
                error: "Crashed",
                errorMessage: '(Language server crashed)',
                result: "Failed"
            },
            {
                secondsSinceStart: (Date.now() - serverStartMs) / 1000
            });
        return this._handler.closed();
    }
}
