// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: no-suspicious-comment

import * as path from 'path';
import { testDiagnosticsFromFile } from "./support/diagnostics";
import { testWithLanguageServer } from './support/testWithLanguageServer';

// These are from the templates at https://github.com/bmoore-msft/arm-template-language-samples which show problems with the 0.6.0 version of the extension

suite("arm-template-language-samples", () => {
    function testSample(templateName: string, expectedErrors: string[] = []): void {
        testWithLanguageServer(templateName, async () => {
            await testDiagnosticsFromFile(
                path.join('templates', 'arm-template-language-samples', templateName),
                {
                },
                expectedErrors);
        });
    }

    // ====== PASSING (possibly with minor changes from original)

    suite("passing", () => {

        testSample("any-property-at-any-level-can-be-an-expression.json");
        testSample("apiProfile.json");
        testSample("apiprofile2.json");
        testSample("apiprofile3.json");
        testSample("arm-is-not-case-sensitive.json");
        testSample("copy-and-multiline-values.json");
        testSample("schema-expressions-everywhere.json");
        testSample(
            "some-schema-thing-I-have-not-seen-before.json",
            [
                `Warning: Please use https for the schema URL (arm-template (schema))`
            ]);
        testSample("subscription-level.json", [
            // TODO: top-level metadata
            // https://github.com/microsoft/vscode-azurearmtools/issues/677
            `Warning: Property name is not allowed by the schema (arm-template (schema))`
        ]);
        testSample("udf-xmas-tree.json", [
            `Error: Template validation failed: The template function 'storageUri' at line '15' and column '21' is not valid. These function calls are not supported in a function definition: 'reference'. Please see https://aka.ms/arm-template/#functions for usage details. (arm-template (validation))`
        ]);
        testSample("valid-invalid-json.json", [
            // TODO: https://github.com/microsoft/vscode-azurearmtools/issues/689
            `Error: Expected a function or property expression. (arm-template (expressions))`,
            `Error: Expected a right square bracket (']'). (arm-template (expressions))`
        ]);
        testSample("variable-copy-sample.json");
        testSample("variable-use-via-copy.json");
        testSample("variable-use.json");

        // Nested templates
        // https://github.com/microsoft/vscode-azurearmtools/issues/484
        testSample("nested-deployment-scoping.json");
        testSample("azuredeploy.inline.json");
    });

    // ====== TODO: NOT PASSING YET (https://github.com/microsoft/vscode-azurearmtools/issues/687)

    suite("failing", () => {

        // Replace 'test' with 'testSample' to activate test

        // TODO: Evaluating expressions in apiVersion
        // https://github.com/microsoft/vscode-azurearmtools/issues/624
        test("apiVersion-can-be-an-expression.json");
        test("apiVersion-can-be-an-expression2.json");
        test("object-variable-properties.json");
        test("variables-object-use-determination.json");

        // ======== NOT SUPPORTED

        /* We are not doing anything about schema bool/int vs string mismatches
            testSample("int-bool-can-be-string-if-valid.json");
            testSample("schema-confusion-aci.json");
            testSample("schema-confusion-keyvault.json");
            testSample("schema-type-mismatch-bool-int.json");
        */

    });
});
