// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';

export const testFolder = path.join(__dirname, '..', '..', '..', 'test');

export function resolveInTestFolder(relativePath: string): string {
    return path.resolve(testFolder, relativePath);
}
