// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

import { minimalDeploymentTemplate, testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";
import { DISABLE_LANGUAGE_SERVER_TESTS } from "../testConstants";

suite("Acceptance validation tests (all sources)", () => {
    if (DISABLE_LANGUAGE_SERVER_TESTS) {
        return;
    }

    test("minimal deployment template - no errors", async () => {
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
                    "Warning: The parameter 'backupVaultRGIsNew' is never used. (ARM (Expressions)) [32,8-32,28]",
                    "Warning: The parameter 'backupContainerName' is never used. (ARM (Expressions)) [47,8-47,29]"
                ])
    );

    test('language-service-p0.template.json'); // TODO
    test('language-service-p1.template.json'); // TODO
    test('language-service-p2.template.json'); // TODO
});
