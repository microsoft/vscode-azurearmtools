// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

import * as os from 'os';
import * as path from 'path';

export function getTempFilePath(baseFilename?: string, extension?: string): string {
    let randomName = '';
    extension = extension === undefined ? '.jsonc' : extension;

    for (let i = 0; i < 10; ++i) {
        // tslint:disable-next-line: insecure-random
        randomName += String.fromCharCode(64 + Math.random() * 26);
    }

    let tempName = `${randomName}${baseFilename ? `-${baseFilename}` : ''}${extension}`;

    return path.join(os.tmpdir(), tempName);
}
