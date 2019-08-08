// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

import { sources, testDiagnosticsFromFile } from "../support/diagnostics";

suite("Expression validation", () => {
    test(
        'templates/new-vm.jsonc',
        async () =>
            testDiagnosticsFromFile(
                'templates/new-vm.jsonc',
                {
                    includeRange: true,
                    includeSources: [sources.expressions]
                },
                [
                    "Warning: The parameter 'backupVaultRGIsNew' is never used. (ARM (Expressions)) [32,8-32,28]",
                    "Warning: The parameter 'backupContainerName' is never used. (ARM (Expressions)) [47,8-47,29]"
                ])
    );

    test(
        'templates/errors.json',
        async () => testDiagnosticsFromFile(
            'templates/errors.json',
            {
                includeRange: true,
                includeSources: [sources.expressions]
            },
            [
                "Error: Undefined parameter reference: 'windowsOSVersion' (ARM (Expressions)) [69,26-69,44]",
                "Error: Undefined variable reference: 'storageAccountType' (ARM (Expressions)) [116,35-116,55]",
                "Warning: The parameter 'domainNamePrefix' is never used. (ARM (Expressions)) [4,4-4,22]",
                "Warning: The variable 'osType' is never used. (ARM (Expressions)) [66,4-66,12]",
            ])
    );
});
