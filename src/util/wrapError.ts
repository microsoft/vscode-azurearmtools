/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as os from 'os';
import { parseError } from 'vscode-azureextensionui';

/**
 * "Wraps" an existing throwable item, placing a new message at the beginning of the current message.
 * Retains original stack info and other properties
 * @param innerError Original error or other item that was thrown
 * @param wrappingMessage Message to wrap the original message with
 */
export function wrapError(outerMessage: string, innerError: unknown): Error {
    const newMessage = outerMessage + os.EOL + parseError(innerError).message;

    if (innerError instanceof Error) {
        const copy = cloneError(innerError);
        copy.message = newMessage;
        return copy;
    } else {
        return new Error(newMessage);
    }
}

function cloneError(error: Error): Error {
    const copy = new Error();
    for (const propName of Object.getOwnPropertyNames(error)) {
        try {
            const value = error[propName];
            copy[propName] = value;
        } catch (err2) {
            // Ignore
        }
    }
    return copy;
}
