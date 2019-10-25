/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseError } from 'vscode-azureextensionui';
import { assetsPath } from '../constants';
import { ext } from '../extensionVariables';
import { DotnetCoreAcquisitionWorker } from './DotnetCoreAcquisitionWorker';
import { DotnetCoreDependencyInstaller } from './DotnetCoreDependencyInstaller';
import { EventStream } from './EventStream';
import { IEventStreamObserver } from './IEventStreamObserver';
import { OutputChannelObserver } from './OutputChannelObserver';
import { StatusBarObserver } from './StatusBarObserver';

let acquisitionWorker: DotnetCoreAcquisitionWorker;
let initialized = false;

function initializeDotnetAcquire(): void {
    if (initialized) {
        return;
    }
    initialized = true;

    let context = ext.context;
    let parentExtensionId = ext.extensionId;
    let scriptsPath = path.join(assetsPath, 'install scripts');

    const extension = vscode.extensions.getExtension(parentExtensionId);

    if (!extension) {
        throw new Error(`Could not resolve dotnet acquisition extension '${parentExtensionId}' location`);
    }

    const eventStreamObservers: IEventStreamObserver[] =
        [
            new StatusBarObserver(vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, Number.MIN_VALUE)),
            new OutputChannelObserver(ext.outputChannel),
        ];
    const eventStream = new EventStream();

    for (const observer of eventStreamObservers) {
        eventStream.subscribe(event => observer.post(event));
    }

    // tslint:disable-next-line: non-literal-fs-path
    if (!fs.existsSync(ext.context.globalStoragePath)) {
        // tslint:disable-next-line: non-literal-fs-path
        fs.mkdirSync(context.globalStoragePath);
    }
    acquisitionWorker = new DotnetCoreAcquisitionWorker(
        context.globalStoragePath,
        context.globalState,
        scriptsPath,
        eventStream);
}

export async function dotnetAcquire(version: string, telemetryProperties: { [key: string]: string | undefined }): Promise<string> {
    initializeDotnetAcquire();

    if (!version || version === 'latest') {
        throw new Error(`Cannot acquire .NET Core version "${version}". Please provide a valid version.`);
    }
    return acquisitionWorker.acquire(version, telemetryProperties);
}

export async function ensureDotnetDependencies(dotnetPath: string, args: string[], telemetryProperties: { [key: string]: string | undefined }): Promise<void> {
    initializeDotnetAcquire();

    if (os.platform() !== 'linux') {
        // We can't handle installing dependencies for anything other than Linux
        telemetryProperties.skipped = "true";
        return;
    }

    const result = cp.spawnSync(dotnetPath, args);
    const installer = new DotnetCoreDependencyInstaller(ext.outputChannel);
    if (installer.signalIndicatesMissingLinuxDependencies(result.signal)) {
        telemetryProperties.signalIndicatesMissing = "true";
        await installer.promptLinuxDependencyInstall(telemetryProperties, 'Failed to successfully run the language server.');
    } else {
        telemetryProperties.signalIndicatesMissing = "false";
    }
}

export async function uninstallDotnet(): Promise<void> {
    initializeDotnetAcquire();

    ext.outputChannel.show();
    ext.outputChannel.appendLine("Uninstalling local dotnet core from extension...");

    try {
        await acquisitionWorker.uninstallAll();
    } catch (error) {
        let message = parseError(error).message;
        if (message.includes('EPERM')) {
            error = new Error(`dotnet core may be in use. Please close all deployment template files, then restart VS Code and try again. ${message}`);
        }

        throw error;
    }

    ext.outputChannel.appendLine("Done.");
}
