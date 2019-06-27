import { testDiagnostics } from "../support/diagnostics";

// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

suite("JSON validation", () => {
    test("no closing brace", async () =>
        await testDiagnostics(
            `{  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0"`,
            {
            },
            [
                'Error: The object is unclosed, \'}\' expected. (ARM Language Server)',
                'Error: Template validation failed: Unexpected end when deserializing object. Path \'contentVersion\', line 2, position 39. (ARM Language Server)'
            ])
    );
});
