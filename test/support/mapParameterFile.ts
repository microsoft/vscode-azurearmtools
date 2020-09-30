// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri } from "vscode";
import { ext } from "../../extension.bundle";
import { delay } from "./delay";

/**
 * Maps a parameter file to a template file, then waits for the language server to pick up the change
 */
export async function mapParameterFile(templateFileUri: Uri, parameterFileUri: Uri | undefined, options: { saveInSettings: boolean; waitForLanguageServer: boolean }): Promise<void> {
    await ext.deploymentFileMapping.value.mapParameterFile(templateFileUri, parameterFileUri, options);
    if (options.waitForLanguageServer) {
        // tslint:disable-next-line: no-suspicious-comment
        await delay(500); // TODO: waitForLanguageServer
    }
}
