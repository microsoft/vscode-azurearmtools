// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

import { diagnosticSources, testDiagnosticsFromFile } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("Expression validation", () => {
    testWithLanguageServer(
        'templates/new-vm.jsonc',
        async () =>
            testDiagnosticsFromFile(
                'templates/new-vm.jsonc',
                {
                    includeRange: true,
                    includeSources: [diagnosticSources.expressions]
                },
                [
                    'Information: Linked template "Acronis.acronis-backup-lin-20180305162104" will not have validation or parameter completion because full validation is off. To enable, either add default values to all top-level parameters or add a parameter file ("Select/Create Parameter File" command). (arm-template (expressions)) [197,21-197,64]',
                    `Information: Nested template "[concat('BackupVaultPolicy', '-', parameters('backupVaultName'), '-', parameters('backupPolicyName'))]" will not have validation or parameter completion because full validation is off. To enable, either add default values to all top-level parameters or add a parameter file ("Select/Create Parameter File" command). (arm-template (expressions)) [271,21-271,125]`,
                    `Information: Nested template "[concat(parameters('virtualMachineName'), '-' , 'BackupIntent')]" will not have validation or parameter completion because full validation is off. To enable, either add default values to all top-level parameters or add a parameter file ("Select/Create Parameter File" command). (arm-template (expressions)) [312,21-312,87]`,
                    "Warning: The parameter 'backupVaultRGIsNew' is never used. (arm-template (expressions)) [33,9-33,29]",
                    "Warning: The parameter 'backupContainerName' is never used. (arm-template (expressions)) [48,9-48,30]"
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
                "Error: Undefined parameter reference: 'windowsOSVersion' (arm-template (expressions)) [70,27-70,45]",
                "Error: Undefined variable reference: 'storageAccountType' (arm-template (expressions)) [117,36-117,56]",
                "Warning: The parameter 'domainNamePrefix' is never used. (arm-template (expressions)) [5,5-5,23]",
                "Warning: The variable 'osType' is never used. (arm-template (expressions)) [67,5-67,13]",
            ])
    );
});
