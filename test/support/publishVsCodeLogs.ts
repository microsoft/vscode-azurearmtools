/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { ext } from '../../extension.bundle';
import { logsFolder } from '../testConstants';

export async function publishVsCodeLogs(extensionid: string | undefined): Promise<void> {
    console.log(`Copying the vscode logs for ${extensionid ?? 'all'}...`);
    const parentPath = path.dirname(ext.context.logPath);
    const sourcePath = path.join(parentPath, extensionid ?? '..');
    const destFolderPath = path.join(logsFolder, extensionid ?? 'all');
    await fse.mkdir(destFolderPath);

    if (fse.pathExistsSync(sourcePath)) {
        await fse.copy(sourcePath, destFolderPath, {
            recursive: true,
            preserveTimestamps: true
        });
    } else {
        console.log(`  Log folder does not exist: ${sourcePath}`);
    }
}
