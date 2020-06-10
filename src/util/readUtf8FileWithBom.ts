// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';

const utf8Bom = 65279;

export async function readUtf8FileWithBom(fsPath: string): Promise<string> {
    let contents = (await fse.readFile(fsPath, { encoding: "utf8" }));
    if (contents.charCodeAt(0) === utf8Bom) {
        contents = contents.slice(1);
    }
    return contents;
}
