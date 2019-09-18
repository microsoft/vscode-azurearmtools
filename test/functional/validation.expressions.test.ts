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
                    "Warning: The parameter 'backupVaultRGIsNew' is never used. (arm-template (expr)) [32,8-32,28]",
                    "Warning: The parameter 'backupContainerName' is never used. (arm-template (expr)) [47,8-47,29]"
                ])
    );

    testWithLanguageServer(
        'templates/errors.json',
        async () => testDiagnosticsFromFile(
            'templates/errors.json',
            {
                includeRange: true,
                includeSources: [sources.expressions]
            },
            [
                "Error: Undefined parameter reference: 'windowsOSVersion' (arm-template (expr)) [69,26-69,44]",
                "Error: Undefined variable reference: 'storageAccountType' (arm-template (expr)) [116,35-116,55]",
                "Warning: The parameter 'domainNamePrefix' is never used. (arm-template (expr)) [4,4-4,22]",
                "Warning: The variable 'osType' is never used. (arm-template (expr)) [66,4-66,12]",
            ])
    );
});
