// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as assert from "assert";
import * as path from 'path';
import { Uri } from 'vscode';
import { normalizeFilePath } from '../../util/normalizedPaths';

export function getRelativeParameterFilePath(templateUri: Uri, parameterUri: Uri): string {
    const templatePath = normalizeFilePath(templateUri);
    const paramPath = normalizeFilePath(parameterUri);

    return path.relative(path.dirname(templatePath), paramPath);
}

export function resolveParameterFilePath(templatePath: string, parameterPathRelativeToTemplate: string): string {
    assert(path.isAbsolute(templatePath));
    const resolved = path.resolve(path.dirname(templatePath), parameterPathRelativeToTemplate);
    return resolved;
}
