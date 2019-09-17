import { sources, testDiagnostics } from "../support/diagnostics";
import { DISABLE_LANGUAGE_SERVER_TESTS } from "../testConstants";

// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

suite("JSON validation", () => {
    if (DISABLE_LANGUAGE_SERVER_TESTS) {
        return;
    }

    test("no closing brace", async () =>
        await testDiagnostics(
            `{  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0"`,
            {
                includeSources: [sources.schema, sources.syntax]
            },
            [
                'Error: The object is unclosed, \'}\' expected. (arm-template (syntax))',
                'Warning: Missing required property resources (arm-template (schema))'
            ])
    );
});
