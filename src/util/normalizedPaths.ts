// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';
import { Uri } from "vscode";
import { documentSchemes, isWin32 } from '../constants';

/**
 * Given an (assumed local file) path or URI, returns a string file path from it that
 * has been normalized
 */
export function normalizeFilePath(filePath: Uri | string): string {
    const suffix: string = (typeof filePath === 'string' || !filePath.query)
        ? ''
        : `?${filePath.query}`;
    const fsPath: string = typeof filePath === 'string' ? filePath : filePath.fsPath;
    let normalizedPath = path.normalize(fsPath);
    if (isWin32) {
        normalizedPath = normalizedPath.toLowerCase();
    }

    return normalizedPath + suffix;
}

/**
 * Normalizes a URI (whether local or not)
 */
export function normalizeUri(pathOrUri: Uri | string): string {
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
