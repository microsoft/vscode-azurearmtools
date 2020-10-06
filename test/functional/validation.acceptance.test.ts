// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-suspicious-comment

import { ITestDiagnosticsOptions, minimalDeploymentTemplate, testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("Acceptance validation tests (all sources)", () => {

    function createAcceptanceTest(templatePath: string, options: ITestDiagnosticsOptions, expected: string[]): void {
        testWithLanguageServer(`validation acceptance test ${templatePath}`, async () => {
            await testDiagnosticsFromFile(
                templatePath,
                options,
                expected);

        });
    }

    testWithLanguageServer("minimal deployment template - no errors", async () => {
        await testDiagnostics(
            minimalDeploymentTemplate,
            {
            },
            []);
    });

    createAcceptanceTest(
        'templates/new-vm.jsonc',
        {
            includeRange: true
        },
        [
            // Expected:
            `Warning: The parameter 'backupVaultRGIsNew' is never used. (arm-template (expressions)) [32,8-32,28]`,
            `Warning: The parameter 'backupContainerName' is never used. (arm-template (expressions)) [47,8-47,29]`,
            'Warning: Please use https for the schema URL (arm-template (schema)) [2,15-2,95]',

            // Unrelated errors:
            `Warning: For full schema validation, consider updating the value to one of the following: \"2016-05-15\". It is possible that the current resource version is valid but that a schema has not been generated. For more information see https://aka.ms/arm-tools-apiversion. (arm-template (schema)) [240,12-240,24]`,
            `Warning: For full schema validation, consider updating the value to one of the following: \"2016-12-01\". It is possible that the current resource version is valid but that a schema has not been generated. For more information see https://aka.ms/arm-tools-apiversion. (arm-template (schema)) [293,28-293,40]`
        ]);

    createAcceptanceTest(
        'templates/language-service-p0.template.json',
        {
        },
        []);

    createAcceptanceTest(
        'templates/language-service-p0.template.new-schema.json',
        {
        },
        []);

    createAcceptanceTest(
        'templates/language-service-p1.template.json',
        {},
        [
            `Warning: Missing required property "kind" (arm-template (schema))`,
            `Warning: Missing required property "sku" (arm-template (schema))`,
            `Warning: The parameter 'unusedParameter' is never used. (arm-template (expressions))`
        ]);

    createAcceptanceTest(
        'templates/language-service-p1.template.new-schema.json',
        {},
        [
            `Warning: Missing required property "kind" (arm-template (schema))`,
            `Warning: Missing required property "sku" (arm-template (schema))`,
            `Warning: The parameter 'unusedParameter' is never used. (arm-template (expressions))`
        ]);

    createAcceptanceTest(
        'templates/udf-xmas-tree2.jsonc',
        {
        },
        []);

});
