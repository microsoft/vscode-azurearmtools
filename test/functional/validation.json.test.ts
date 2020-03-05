import { testDiagnostics } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

suite("JSON validation", () => {
    testWithLanguageServer("no closing brace", async () =>
        await testDiagnostics(
            `{  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            // Some comments here
            "resources": []`,
            {
            },
            [
                'Error: The object is unclosed, \'}\' expected. (arm-template (syntax))',
                "Error: Template validation failed: Unexpected end when deserializing object. Path 'resources', line 3, position 27. (arm-template (validation))"
            ])
    );
});
