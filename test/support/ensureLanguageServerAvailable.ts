// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { getDiagnosticsForTemplate } from "./diagnostics";

let isLanguageServerAvailable = false;

export async function ensureLanguageServerAvailable(): Promise<void> {
    if (!isLanguageServerAvailable) {
        // Wait until we get some diagnostics from the language server
        await getDiagnosticsForTemplate('{}');
        isLanguageServerAvailable = true;
    }
}
