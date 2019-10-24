// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

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

    // Replace 'test' with 'testSample' to activate test

    test("any-property-at-any-level-can-be-an-expression.json");
    test("apiProfile.json");
    test("apiVersion-can-be-an-expression.json");

    // Passes with an apiVersion change
    testSample("arm-is-not-case-sensitive.json");

    test("azuredeploy.inline.json");
    test("copy-and-multiline-values.json");
    test("int-bool-can-be-string-if-valid.json");
    test("nested-deployment-scoping.json");
    test("object-variable-properties.json");
    test("schema-confusion-aci.json");
    test("schema-confusion-keyvault.json");
    test("schema-expressions-everywhere.json");
    test("schema-type-mismatch-bool-int.json");
    test("some-schema-thing-I-have-not-seen-before.json");
    test("subscription-level.json");
    test("udf-xmas-tree.json");
    test("valid-invalid-json.json");
    test("variable-copy-sample.json");
    test("variable-use-via-copy.json");
    test("variable-use.json");
    test("variables-object-use-determination.json");
});
