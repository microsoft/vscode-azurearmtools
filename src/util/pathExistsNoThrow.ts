// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';
import { Uri } from 'vscode';

export async function pathExistsNoThrow(path: Uri | string | undefined): Promise<boolean> {
    try {
        const localPath = path instanceof Uri ? path.fsPath : path;
        return !!localPath && await fse.pathExists(localPath);
    } catch (err) {
        return false;
    }
}
