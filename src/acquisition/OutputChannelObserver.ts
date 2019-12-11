/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as vscode from 'vscode';
import { DotnetAcquisitionCompleted, DotnetAcquisitionError, DotnetAcquisitionMessage, DotnetAcquisitionStarted } from './EventStreamEvents';
import { EventType } from './EventType';
import { IEvent } from './IEvent';
import { IEventStreamObserver } from './IEventStreamObserver';

export class OutputChannelObserver implements IEventStreamObserver {
    private readonly inProgressDownloads: string[] = [];
    private downloadProgressInterval: NodeJS.Timeout | undefined;
    private _log: string = "";

    constructor(private readonly outputChannel: vscode.OutputChannel) {
    }

    public get log(): string {
        return this._log;
    }

    private append(message: string): void {
        this.outputChannel.append(message);
        this._log += message;
    }

    private appendLine(message: string): void {
        this.outputChannel.appendLine(message);
        this._log += `${message}\n`; // Use OS-independent newline
    }

    public post(event: IEvent): void {
        switch (event.eventType) {
            case EventType.DotnetAcquisitionStart:
                {
                    const acquisitionStarted = event as DotnetAcquisitionStarted;

                    this.inProgressDownloads.push(acquisitionStarted.version);

                    if (this.inProgressDownloads.length > 1) {
                        // Already a download in progress
                        this.appendLine(` -- Concurrent download of '${acquisitionStarted.version}' started!`);
                        this.appendLine('');
                    } else {
                        this.outputChannel.show();
                        this.startDownloadIndicator();
                    }

                    const versionString = this.inProgressDownloads.join(', ');
                    this.appendLine(`Using this command to install .NET Core version ${acquisitionStarted.version}:${os.EOL}${acquisitionStarted.installCommand}`);
                    this.append(`Downloading .NET Core tooling version(s) ${versionString}...`);
                }
                break;
            case EventType.DotnetAcquisitionCompleted:
                {
                    const acquisitionCompleted = event as DotnetAcquisitionCompleted;
                    this.appendLine(' Done!');
                    this.appendLine(`.NET Core ${acquisitionCompleted.version} executable path: ${acquisitionCompleted.dotnetPath}`);
                    this.appendLine('');

                    this.inProgressVersionDone(acquisitionCompleted.version);

                    if (this.inProgressDownloads.length > 0) {
                        const versionString = `'${this.inProgressDownloads.join('\', \'')}'`;
                        this.append(`Still downloading .NET Core tooling version(s) ${versionString} ...`);
                    } else {
                        this.stopDownloadIndicator();
                    }
                }
                break;
            case EventType.DotnetAcquisitionError:
                {
                    const error = event as DotnetAcquisitionError;
                    this.appendLine(' Error!');
                    this.appendLine(`Failed to download .NET Core tooling ${error.version}:`);
                    this.appendLine(error.getErrorMessage());
                    this.appendLine('');

                    this.inProgressVersionDone(error.version);

                    if (this.inProgressDownloads.length > 0) {
                        const versionString = this.inProgressDownloads.join(', ');
                        this.append(`Still downloading .NET Core tooling version(s) ${versionString} ...`);
                    } else {
                        this.stopDownloadIndicator();
                    }
                }
                break;
            case EventType.DotnetAcquisitionMessage:
                {
                    const msg = event as DotnetAcquisitionMessage;
                    this.appendLine(msg.getMessage());
                }
                break;
            default:
                console.error(`Unexpected event type ${event.eventType}`);
                break;
        }
    }

    private startDownloadIndicator(): void {
        this.downloadProgressInterval = setInterval(() => this.append('.'), 1000);
    }

    private stopDownloadIndicator(): void {
        if (this.downloadProgressInterval) {
            clearTimeout(this.downloadProgressInterval);
            this.downloadProgressInterval = undefined;
        }
    }

    private inProgressVersionDone(version: string): void {
        const index = this.inProgressDownloads.indexOf(version);
        if (index >= 0) {
            this.inProgressDownloads.splice(index, 1);
        }
    }
}
