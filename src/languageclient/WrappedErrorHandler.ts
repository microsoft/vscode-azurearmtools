/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { callWithTelemetryAndErrorHandlingSync, IActionContext, parseError } from '@microsoft/vscode-azext-utils';
import * as os from 'os';
import { Message } from 'vscode-jsonrpc';
import { CloseAction, ErrorAction, ErrorHandler } from 'vscode-languageclient';
import { languageServerName } from '../../common';

const languageServerErrorTelemId = 'Language Server Error';

/**
 * Wraps the default error handler for the language server client to send telemetry for the error
 * events.
 *
 * (The default error handler causes the server to shut down after 3 errors or 5 crashes.)
 */
export class WrappedErrorHandler implements ErrorHandler {
    private _serverStartTime: number;

    constructor(private _handler: ErrorHandler) {
        this._serverStartTime = Date.now();
    }

    /**
     * An error has occurred while writing or reading from the connection.
     *
     * @param error - the error received
     * @param message - the message to be delivered to the server if known.
     * @param count - a count indicating how often an error is received. Will
     *  be reset if a message got successfully send or received.
     */
    public error(error: Error, message: Message, count: number): ErrorAction {
        // Use our shared error handling code to notification telemetry and user of the error
        // in a standard way
        callWithTelemetryAndErrorHandlingSync(languageServerErrorTelemId, (context: IActionContext) => {
            // tslint:disable-next-line: strict-boolean-expressions
            context.telemetry.properties.jsonrpcMessage = message ? message.jsonrpc : "";
            context.telemetry.measurements.secondsSinceStart = (Date.now() - this._serverStartTime) / 1000;

            throw new Error(`An error occurred in the ${languageServerName}.${os.EOL}${os.EOL}${parseError(error).message}`);
        });

        return this._handler.error(error, message, count);
    }

    /**
     * The connection to the server got closed.
     */
    public closed(): CloseAction {
        // Use our shared error handling code to notify telemetry and user of the error
        // in a standard way
        callWithTelemetryAndErrorHandlingSync(languageServerErrorTelemId, (context: IActionContext) => {
            context.telemetry.measurements.secondsSinceStart = (Date.now() - this._serverStartTime) / 1000;

            throw new Error(`The connection to the ${languageServerName} got closed.`);
        });

        return this._handler.closed();
    }
}
