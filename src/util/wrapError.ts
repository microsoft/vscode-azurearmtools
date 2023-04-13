/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as os from 'os';
import { parseError } from 'vscode-azureextensionui';

/**
 * "Wraps" an existing throwable item, placing a new message at the beginning of the current message.
 * Retains original stack info and other properties
 * @param outerMessage Message to wrap the original message with
 * @param innerError Original error or other item that was thrown
 */
export function wrapError(outerMessage: string, innerError: unknown): Error {
    // Note: We add a space as well as an EOL because in some vscode scenarios the EOL
    //   doesn't show up in the UI
    // tslint:disable-next-line:prefer-template
    const newMessage = outerMessage + " " + os.EOL + parseError(innerError).message;

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            (<any>copy)[propName] = (<any>error)[propName];
        } catch (err2) {
            // Ignore
        }
    }
    return copy;
}
