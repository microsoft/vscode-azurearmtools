// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: no-console

import * as vscode from "vscode";
import { IAzExtOutputChannel } from "vscode-azureextensionui";

/**
 * Wraps an output channel to echo everything logged to the console
 */
export class ConsoleOutputChannelWrapper implements IAzExtOutputChannel {
    public constructor(private readonly outputChannel: IAzExtOutputChannel) {
    }

    public appendLog(value: string, options?: { resourceName?: string | undefined; date?: Date | undefined } | undefined): void {
        console.log(value);
        this.outputChannel.appendLog(value, options);
    }

    public get name(): string {
        return this.outputChannel.name;
    }

    public append(value: string): void {
        console.log(value);
        this.outputChannel.append(value);
    }

    public appendLine(value: string): void {
        console.log(value);
        this.outputChannel.appendLine(value);
    }

    public clear(): void {
        this.outputChannel.clear();
    }

    public show(preserveFocus?: boolean | undefined): void;

    public show(column?: vscode.ViewColumn | undefined, preserveFocus?: boolean | undefined): void;

    // tslint:disable-next-line: no-any
    public show(column?: any, preserveFocus?: boolean | undefined): void {
        // tslint:disable-next-line: no-unsafe-any
        this.outputChannel.show(column, preserveFocus);
    }

    public hide(): void {
        this.outputChannel.hide();
    }
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
