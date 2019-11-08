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
                    // Expected:
                    "Warning: The parameter 'backupVaultRGIsNew' is never used. (arm-template (expressions)) [32,8-32,28]",
                    "Warning: The parameter 'backupContainerName' is never used. (arm-template (expressions)) [47,8-47,29]",

                    // Unrelated errors:
                    'Warning: Value must be one of the following values: "2016-05-15" (arm-template (schema)) [240,12-240,24]',
                    'Warning: OneOf (Require 1 match, following 2 not matched):\r\n    Value must be one of the following values: "2016-12-01"\r\n    string (arm-template (schema)) [273,12-273,24]',
                    'Warning: Value must be one of the following values: "2016-12-01" (arm-template (schema)) [293,28-293,40]',
                    'Warning: Exactly 1 match required, but found more than 1 (arm-template (schema)) [324,28-324,40]'
                ])
    );

    test('language-service-p0.template.json'); // TODO
    test('language-service-p1.template.json'); // TODO
    test('language-service-p2.template.json'); // TODO

    testWithLanguageServer("udf-xmas-tree2", async () => {
        await testDiagnostics(
            minimalDeploymentTemplate,
            {
            },
            []);
    });
});
