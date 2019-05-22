// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: object-literal-key-quotes

import { ISuiteCallbackContext } from "mocha";
import { diagnosticsTimeout, languageServerSource, testDiagnosticsDeferred, testDiagnosticsFromFile } from "./support/testDiagnostics";

suite("Diagnostics", function (this: ISuiteCallbackContext): void {
    this.timeout(diagnosticsTimeout);

    suite("ARM Tools", () => {

        testDiagnosticsFromFile(
            'new-vm.jsonc',
            {
                includeRange: true,
                ignoreSources: [languageServerSource] // TODO: currently getting false positives from schema validation
            },
            [
                "Warning: The parameter 'backupVaultRGIsNew' is never used. (ARM Tools) [32,8-32,28]",
                "Warning: The parameter 'backupContainerName' is never used. (ARM Tools) [47,8-47,29]"
            ]);

        testDiagnosticsFromFile(
            'errors.json',
            { includeRange: true },
            [
                "Error: Undefined parameter reference: 'windowsOSVersion' (ARM Tools) [69,26-69,44]",
                "Error: Undefined variable reference: 'storageAccountType' (ARM Tools) [116,35-116,55]",
                "Warning: The parameter 'domainNamePrefix' is never used. (ARM Tools) [4,4-4,22]",
                "Warning: The variable 'osType' is never used. (ARM Tools) [66,4-66,12]",
            ]);

        testDiagnosticsDeferred('language-service-p0.template.json');
        testDiagnosticsDeferred('language-service-p2.template.json');

    }); // end suite ARM Tools

    suite("Schema", () => {
        suite("Capitalization", () => {

            /* TODO: enable when fixed
            testDiagnostics(
                'Resource type miscapitalized (https://github.com/microsoft/vscode-azurearmtools/issues/238)',
                {
                    "resources": [
                        {
                            "name": "example",
                            "type": "Microsoft.Network/publicIpAddresses",
                            "apiVersion": "2018-08-01",
                            "location": "[parameters('location')]",
                            "properties": {},
                        }]
                },
                { ignoreSources: [armToolsSource] },
                [
                ]);*/

        });
    });
});
