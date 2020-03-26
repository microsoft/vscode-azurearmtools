/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';
import * as rimraf from 'rimraf';
import { parseError } from 'vscode-azureextensionui';
import { basePath, isWin32 } from '../../extension.bundle';

const homedir = os.homedir();
const cacheFolder = isWin32
    ? `${process.env.LocalAppData}\\Microsoft\\ARMLanguageServer\\Schemas\\JSON`
    : `${homedir}/.local/share/Microsoft/ARMLanguageServer/Schemas/JSON`;

export async function clearCache(): Promise<void> {
    await displayCacheStatus();
    if (fse.pathExistsSync(cacheFolder)) {
        try {
            // tslint:disable-next-line:typedef
            await new Promise((resolve, reject) => {
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
                console.error(`...Cache folder still exists!`);
                await displayCacheStatus();
            } else {
                console.log(`...Cache folder successfully deleted`);
                await displayCacheStatus();
            }
        } catch (error) {
            console.log("Could not clear cache!");
            console.error(parseError(error).message);
            await displayCacheStatus();
        }
    } else {
        console.log(`...Cache folder does not exist, no need to clear`);
    }
}

export async function displayCacheStatus(): Promise<void> {
    console.log(`Inspecting cache...`);
    if (fse.pathExistsSync(cacheFolder)) {
        console.log(`  Cache contents:`);
        console.log(`${(await fse.readdir(cacheFolder)).length} file(s)`);
        // console.log((await fse.readdir(cacheFolder)).join(os.EOL));
    } else {
        console.log(`  Cache folder does not exist: ${cacheFolder}`);
    }
}

export async function packageCache(destFolderName: string): Promise<void> {
    console.log(`Copying the cache...`);
    const destFolderPath = path.join(basePath, destFolderName);
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
        console.log(`  Cache folder does not exist: ${cacheFolder}`);
    }

    async function copyCacheFile(cacheFileRelativePath: string, destFolderPath: string): Promise<void> {
        const sourcePath = path.join(cacheFolder, cacheFileRelativePath);
        const targetPath = path.join(destFolderPath, cacheFileRelativePath);
        if ((await fse.stat(sourcePath)).isFile()) {
            await fse.copyFile(sourcePath, targetPath);
        }
    }
}
