/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';
import { Memento } from 'vscode';
import { EventStream } from './EventStream';
import { DotnetAcquisitionCompleted, DotnetAcquisitionInstallError, DotnetAcquisitionScriptError, DotnetAcquisitionStarted, DotnetAcquisitionUnexpectedError } from './EventStreamEvents';

// tslint:disable-next-line:no-require-imports
import rimraf = require('rimraf');

export class DotnetCoreAcquisitionWorker {
    private readonly installingVersionsKey: string = 'installing';
    private readonly installDir: string;
    private readonly scriptPath: string;
    private readonly dotnetExecutable: string;

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Represent this in package.json OR utilize the channel argument in dotnet-install to dynamically acquire the
    // latest for a specific channel. Concerns for using the dotnet-install channel mechanism:
    //  1. Is the specified "latest" version available on the CDN yet?
    //  2. Would need to build a mechanism to occasionally query latest so you don't pay the cost on every acquire.
    private readonly latestVersionMap: { [version: string]: string | undefined } = {
        '1.0': '1.0.16',
        1.1: '1.1.13',
        '2.0': '2.0.9',
        2.1: '2.1.11',
        2.2: '2.2.5',
    };

    private acquisitionPromises: { [version: string]: Promise<string> | undefined };

    constructor(
        private readonly storagePath: string,
        private readonly extensionState: Memento,
        private readonly scriptsPath: string,
        private readonly eventStream: EventStream
    ) {
        // tslint:disable-next-line: strict-boolean-expressions
        const dotnetInstallFolder: string = process.env.ARM_DOTNET_INSTALL_FOLDER || '.dotnet';

        const script = os.platform() === 'win32' ? 'dotnet-install.cmd' : 'dotnet-install.sh';
        this.scriptPath = path.join(this.scriptsPath, script);
        this.installDir = path.join(this.storagePath, dotnetInstallFolder);
        const dotnetExtension = os.platform() === 'win32' ? '.exe' : '';
        this.dotnetExecutable = `dotnet${dotnetExtension}`;
        this.acquisitionPromises = {};
    }

    public async uninstallAll(): Promise<void> {
        this.acquisitionPromises = {};

        rimraf.sync(this.installDir);

        await this.extensionState.update(this.installingVersionsKey, []);
    }

    // tslint:disable-next-line: promise-function-async
    public acquire(version: string, telemetryProperties: { [key: string]: string | undefined }): Promise<string> {
        telemetryProperties.requestedVersion = version;

        const resolvedVersion = this.latestVersionMap[version];
        if (resolvedVersion) {
            version = resolvedVersion;
        }

        telemetryProperties.resolvedVersion = version;

        const existingAcquisitionPromise = this.acquisitionPromises[version];
        telemetryProperties.acquisitionAlreadyInProcess = "false";
        if (existingAcquisitionPromise) {
            // This version of dotnet is already being acquired. Memoize the promise.

            telemetryProperties.acquisitionAlreadyInProcess = "true";
            return existingAcquisitionPromise;
        } else {
            // We're the only one acquiring this version of dotnet, start the acquisition process.

            const acquisitionPromise = this.acquireCore(version, telemetryProperties).catch(error => {
                delete this.acquisitionPromises[version];
                throw error;
            });

            this.acquisitionPromises[version] = acquisitionPromise;
            return acquisitionPromise;
        }
    }

    private async acquireCore(version: string, telemetryProperties: { [key: string]: string | undefined }): Promise<string> {
        const installingVersions = this.extensionState.get<string[]>(this.installingVersionsKey, []);

        telemetryProperties.partialInstallFound = "false";
        const partialInstall = installingVersions.indexOf(version) >= 0;
        if (partialInstall) {
            // Partial install, we never updated our extension to no longer be 'installing'.
            // uninstall everything and then re-install.
            telemetryProperties.partialInstallFound = "true";
            await this.uninstall(version);
        }

        const dotnetInstallDir = this.getDotnetInstallDir(version);
        const dotnetPath = path.join(dotnetInstallDir, this.dotnetExecutable);

        telemetryProperties.alreadyInstalled = "false";
        if (fs.existsSync(dotnetPath)) {
            // Version requested has already been installed.
            telemetryProperties.alreadyInstalled = "true";
            return dotnetPath;
        }

        // We update the extension state to indicate we're starting a .NET Core installation.
        installingVersions.push(version);
        await this.extensionState.update(this.installingVersionsKey, installingVersions);

        //const dotnetInstallDirEscaped = dotnetInstallDir.replace("'", "''");
        let dotnetInstallDirEscaped: string;
        if (os.platform() === 'win32') {
            // Need to escape apostrophes with two apostrophes
            dotnetInstallDirEscaped = dotnetInstallDir.replace(/'/g, "''");

            // Surround with single quotes instead of double quotes (see https://github.com/dotnet/cli/issues/11521)
            dotnetInstallDirEscaped = `'${dotnetInstallDirEscaped}'`;
        } else {
            dotnetInstallDirEscaped = `"${dotnetInstallDir}"`;
        }

        const args = [
            '-InstallDir', dotnetInstallDirEscaped,
            '-Runtime', 'dotnet',
            '-Version', version,
        ];

        const installCommand = `"${this.scriptPath}" ${args.join(' ')}`;

        this.eventStream.post(new DotnetAcquisitionStarted(version, installCommand));
        await this.installDotnet(installCommand, version, dotnetPath);

        // Need to re-query our installing versions because there may have been concurrent acquisitions that
        // changed its value.
        const latestInstallingVersions = this.extensionState.get<string[]>(this.installingVersionsKey, []);
        const versionIndex = latestInstallingVersions.indexOf(version);
        if (versionIndex >= 0) {
            latestInstallingVersions.splice(versionIndex, 1);
            await this.extensionState.update(this.installingVersionsKey, latestInstallingVersions);
        }

        return dotnetPath;
    }

    private async uninstall(version: string): Promise<void> {
        delete this.acquisitionPromises[version];

        const dotnetInstallDir = this.getDotnetInstallDir(version);
        rimraf.sync(dotnetInstallDir);

        const installingVersions = this.extensionState.get<string[]>(this.installingVersionsKey, []);
        const versionIndex = installingVersions.indexOf(version);
        if (versionIndex >= 0) {
            installingVersions.splice(versionIndex, 1);
            await this.extensionState.update(this.installingVersionsKey, installingVersions);
        }
    }

    private getDotnetInstallDir(version: string): string {
        const dotnetInstallDir = path.join(this.installDir, version);
        return dotnetInstallDir;
    }

    // tslint:disable-next-line: promise-function-async
    private installDotnet(installCommand: string, version: string, dotnetPath: string): Promise<void> {
        return new Promise<void>((resolve, reject): void => {
            try {
                cp.exec(installCommand, { cwd: process.cwd(), maxBuffer: 500 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        this.eventStream.post(new DotnetAcquisitionInstallError(error, version));
                        reject(error);
                    } else if (stderr && stderr.length > 0) {
                        this.eventStream.post(new DotnetAcquisitionScriptError(stderr, version));
                        reject(stderr);
                    } else {
                        this.eventStream.post(new DotnetAcquisitionCompleted(version, dotnetPath));
                        resolve();
                    }
                });
            } catch (error) {
                this.eventStream.post(new DotnetAcquisitionUnexpectedError(error, version));
                reject(error);
            }
        });
    }
}
