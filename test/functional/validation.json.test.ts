import { sources, testDiagnostics } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

suite("JSON validation", () => {
    testWithLanguageServer("no closing brace", async () =>
        await testDiagnostics(
            `{  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0"`,
            {
                includeSources: [sources.schema, sources.syntax]
            },
            [
                'Error: The object is unclosed, \'}\' expected. (arm-template (syntax))',
                'Warning: Missing required property "resources" (arm-template (schema))'
            ])
    );
});
