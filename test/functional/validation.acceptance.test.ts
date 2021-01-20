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

    /* TODO: blocked by https://github.com/microsoft/vscode-azurearmtools/issues/1143
    createAcceptanceTest(
        'templates/new-vm.jsonc',
        {
            includeRange: true
        },
        [
            // Expected:
            `Warning: The parameter 'backupVaultRGIsNew' is never used. (arm-template (expressions)) [33,9-33,29]`,
            `Warning: The parameter 'backupContainerName' is never used. (arm-template (expressions)) [48,9-48,30]`,
            'Warning: Please use https for the schema URL (arm-template (schema)) [3,16-3,96]',

            // Unrelated errors:
            `Warning: For full schema validation, consider updating the value to one of the following: \"2016-05-15\". It is possible that the current resource version is valid but that a schema has not been generated. For more information see https://aka.ms/arm-tools-apiversion. (arm-template (schema)) [241,13-241,25]`,
            `Warning: For full schema validation, consider updating the value to one of the following: \"2016-12-01\". It is possible that the current resource version is valid but that a schema has not been generated. For more information see https://aka.ms/arm-tools-apiversion. (arm-template (schema)) [294,29-294,41]`,
        ]);
    */

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
