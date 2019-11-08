// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

import { sources, testDiagnosticsFromFile } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("Expression validation", () => {
    testWithLanguageServer(
        'templates/new-vm.jsonc',
        async () =>
            testDiagnosticsFromFile(
                'templates/new-vm.jsonc',
                {
                    includeRange: true,
                    includeSources: [sources.expressions]
                },
                [
                    "Warning: The parameter 'backupVaultRGIsNew' is never used. (arm-template (expressions)) [32,8-32,28]",
                    "Warning: The parameter 'backupContainerName' is never used. (arm-template (expressions)) [47,8-47,29]"
                ])
    );

    testWithLanguageServer(
        'templates/errors.json',
        async () => testDiagnosticsFromFile(
            'templates/errors.json',
            {
                includeRange: true
            },
            [
                "Error: Undefined parameter reference: 'windowsOSVersion' (arm-template (expressions)) [69,26-69,44]",
                "Error: Undefined variable reference: 'storageAccountType' (arm-template (expressions)) [116,35-116,55]",
                "Warning: The parameter 'domainNamePrefix' is never used. (arm-template (expressions)) [4,4-4,22]",
                "Warning: The variable 'osType' is never used. (arm-template (expressions)) [66,4-66,12]",
            ])
    );
});
