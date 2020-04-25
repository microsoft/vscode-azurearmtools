// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

import { ext } from "../../extension.bundle";
import { minimalDeploymentTemplate, testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

const EOL = ext.EOL;

suite("Acceptance validation tests (all sources)", () => {
    testWithLanguageServer("minimal deployment template - no errors", async () => {
        await testDiagnostics(
            minimalDeploymentTemplate,
            {
            },
            []);
    });

    testWithLanguageServer(
        'templates/new-vm.jsonc',
        async () =>
            testDiagnosticsFromFile(
                'templates/new-vm.jsonc',
                {
                    includeRange: true
                },
                [
                    // Expected:
                    `Warning: The parameter 'backupVaultRGIsNew' is never used. (arm-template (expressions)) [32,8-32,28]`,
                    `Warning: The parameter 'backupContainerName' is never used. (arm-template (expressions)) [47,8-47,29]`,

                    // Unrelated errors:
                    `Warning: For full schema validation, consider updating the value to one of the following: \"2016-05-15\". It is possible that the current resource version is valid but that a schema has not been generated. For more information see https://aka.ms/arm-tools-apiversion. (arm-template (schema)) [240,12-240,24]`,
                    `Warning: Value must conform to exactly one of the associated schemas${EOL}|   For full schema validation, consider updating the value to one of the following: \"2016-12-01\". It is possible that the current resource version is valid but that a schema has not been generated. For more information see https://aka.ms/arm-tools-apiversion. at #/resources/6/properties/template/resources/1/apiVersion${EOL}|   or${EOL}|   Value must be one of the following types: string${EOL}|   For full schema validation, consider updating the value to one of the following: \"2016-12-01\". It is possible that the current resource version is valid but that a schema has not been generated. For more information see https://aka.ms/arm-tools-apiversion. at #/resources/6/properties/template/resources/1/apiVersion (arm-template (schema)) [273,12-273,24]`,
                ])
    );

    testWithLanguageServer('language-service-p0.template.json'); // TODO
    testWithLanguageServer('language-service-p1.template.json'); // TODO
    testWithLanguageServer('language-service-p2.template.json'); // TODO

    testWithLanguageServer("udf-xmas-tree2", async () => {
        await testDiagnostics(
            minimalDeploymentTemplate,
            {
            },
            []);
    });
});
