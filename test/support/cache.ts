/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable: no-implicit-dependencies

import { parseError } from "@microsoft/vscode-azext-utils";
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';
import * as rimraf from 'rimraf';
import { isWin32 } from '../testConstants';
import { writeToError, writeToLog } from './testLog';

const homedir = os.homedir();
const cacheFolder = isWin32
    ? `${process.env.LocalAppData}\\Microsoft\\ARMLanguageServer\\Schemas\\JSON`
    : `${homedir}/.local/share/Microsoft/ARMLanguageServer/Schemas/JSON`;

export async function clearCache(): Promise<void> {
    await displayCacheStatus();
    if (fse.pathExistsSync(cacheFolder)) {
        try {
            await new Promise<void>((resolve, reject): void => {
                rimraf(
                    cacheFolder,
                    (error) => {
                        // tslint:disable-next-line: strict-boolean-expressions
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
            });

            if (fse.pathExistsSync(cacheFolder)) {
                writeToError(`...Cache folder still exists!`);
                await displayCacheStatus();
            } else {
                writeToLog(`...Cache folder successfully deleted`);
                await displayCacheStatus();
            }
        } catch (error) {
            writeToError("Could not clear cache!");
            writeToError(parseError(error).message);
            await displayCacheStatus();
        }
    } else {
        writeToLog(`...Cache folder does not exist, no need to clear`);
    }
}

export async function displayCacheStatus(): Promise<void> {
    writeToLog(`Inspecting cache...`);
    if (fse.pathExistsSync(cacheFolder)) {
        writeToLog(`  Cache contents:`);
        writeToLog(`${(await fse.readdir(cacheFolder)).length} file(s)`);
        // writeToLog((await fse.readdir(cacheFolder)).join(os.EOL));
    } else {
        writeToLog(`  Cache folder does not exist: ${cacheFolder}`);
    }
}

export async function publishCache(destFolderPath: string): Promise<void> {
    writeToLog(`Copying the cache...`);
    const destFolderExpirationPath = path.join(destFolderPath, 'Expiration');

    if (await fse.pathExists(destFolderExpirationPath)) {
        rimraf.sync(destFolderPath);
    }

    await fse.mkdir(destFolderPath);
    await fse.mkdir(destFolderExpirationPath);

    if (fse.pathExistsSync(cacheFolder)) {
        for (let file of await fse.readdir(cacheFolder)) {
            await copyCacheFile(file, destFolderPath);
        }
        for (let file of await fse.readdir(path.join(cacheFolder, "Expiration"))) {
            await copyCacheFile(path.join('Expiration', file), destFolderPath);
        }
    } else {
        writeToLog(`  Cache folder does not exist: ${cacheFolder}`);
    }

    async function copyCacheFile(cacheFileRelativePath: string, destCacheFolderPath: string): Promise<void> {
        const sourcePath = path.join(cacheFolder, cacheFileRelativePath);
        const targetPath = path.join(destCacheFolderPath, cacheFileRelativePath);
        if ((await fse.stat(sourcePath)).isFile()) {
            await fse.copyFile(sourcePath, targetPath);
        }
    }
}
