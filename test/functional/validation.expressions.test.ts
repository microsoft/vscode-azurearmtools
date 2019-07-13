// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

import { schemaSource, testDiagnosticsFromFile } from "../support/diagnostics";

suite("Expression validation", () => {
    test(
        'templates/new-vm.jsonc',
        async () =>
            testDiagnosticsFromFile(
                'templates/new-vm.jsonc',
                {
                    includeRange: true,
                    ignoreSources: [schemaSource]
                },
                [
                    "Warning: The parameter 'backupVaultRGIsNew' is never used. (ARM Tools) [32,8-32,28]",
                    "Warning: The parameter 'backupContainerName' is never used. (ARM Tools) [47,8-47,29]"
                ])
    );

    test(
        'templates/errors.json',
        async () => testDiagnosticsFromFile(
            'templates/errors.json',
            {
                includeRange: true,
                ignoreSources: [schemaSource]
            },
            [
                "Error: Undefined parameter reference: 'windowsOSVersion' (ARM Tools) [69,26-69,44]",
                "Error: Undefined variable reference: 'storageAccountType' (ARM Tools) [116,35-116,55]",
                "Warning: The parameter 'domainNamePrefix' is never used. (ARM Tools) [4,4-4,22]",
                "Warning: The variable 'osType' is never used. (ARM Tools) [66,4-66,12]",
            ])
    );

    test('language-service-p0.template.json'); // TODO
    test('language-service-p2.template.json'); // TODO

});
