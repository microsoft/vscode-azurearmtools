// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

import * as os from 'os';
import * as path from 'path';

export function getTempFilePath(filename?: string): string {
    let tempName = '';

    if (!filename) {
        for (let i = 0; i < 10; ++i) {
            // tslint:disable-next-line: insecure-random
            tempName += String.fromCharCode(64 + Math.random() * 26);
        }

        tempName = `${tempName}.jsonc`;
    } else {
        tempName = filename;
    }

    return path.join(os.tmpdir(), tempName);
}
