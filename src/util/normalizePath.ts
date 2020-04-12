// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';
import { Uri } from "vscode";
import { isWin32 } from '../constants';

export function normalizePath(filePath: Uri | string): string {
    const fsPath: string = typeof filePath === 'string' ? filePath :
        filePath.fsPath;
    let normalizedPath = path.normalize(fsPath);
    if (isWin32) {
        normalizedPath = normalizedPath.toLowerCase();
    }

    return normalizedPath;
}
