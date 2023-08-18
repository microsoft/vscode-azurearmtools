/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import { CancellationToken } from 'vscode';
import { CancellationTokenSource } from 'vscode-jsonrpc';

export class Cancellation {
    public static cantCancel: Cancellation = new Cancellation(new CancellationTokenSource().token);

    public constructor(public token: CancellationToken, public actionContext?: IActionContext) {
        this.throwIfCancelled();
    }

    public throwIfCancelled(): void {
        throwOnCancel(this.token, this.actionContext);
    }
}

export function throwOnCancel(token: CancellationToken, actionContext?: IActionContext): void {
    if (token.isCancellationRequested) {
        if (actionContext) {
            actionContext.telemetry.properties.cancelStep = 'vscode';
        }

        throw new UserCancelledError();
    }
}
