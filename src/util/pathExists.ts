// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';
import { Uri } from 'vscode';

export async function pathExists(uri: Uri | undefined): Promise<boolean> {
    try {
        return !!uri && await fse.pathExists(uri.fsPath);
    } catch (err) {
        return false;
    }
}
