// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

import { minimalDeploymentTemplate, testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("Acceptance validation tests (all sources)", () => {
    testWithLanguageServer("minimal deployment template - no errors", async () => {
        await testDiagnostics(
            minimalDeploymentTemplate,
            {
            },
            []);
    });

    test(
        'templates/new-vm.jsonc',
        async () =>
            testDiagnosticsFromFile(
                'templates/new-vm.jsonc',
                {
                    includeRange: true
                },
                [
                    "Warning: The parameter 'backupVaultRGIsNew' is never used. (arm-template (expr)) [32,8-32,28]",
                    "Warning: The parameter 'backupContainerName' is never used. (arm-template (expr)) [47,8-47,29]"
                ])
    );

    test('language-service-p0.template.json'); // TODO
    test('language-service-p1.template.json'); // TODO
    test('language-service-p2.template.json'); // TODO
});
