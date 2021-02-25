// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';
import { Uri } from "vscode";
import { documentSchemes, isWin32 } from '../constants';

export function normalizePath(pathOrUri: Uri | string): string {
    if (pathOrUri instanceof Uri && pathOrUri.scheme === documentSchemes.file) {
        pathOrUri = pathOrUri.fsPath;
    }

    if (typeof pathOrUri === 'string') {
        let normalizedPath = path.normalize(pathOrUri);
        if (isWin32) {
            normalizedPath = normalizedPath.toLowerCase();
        }
        pathOrUri = Uri.parse(normalizedPath);
    }

    return pathOrUri.toString();
}
