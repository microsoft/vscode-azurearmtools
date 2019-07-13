// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string

import { minimalDeploymentTemplate, testDiagnostics } from "../support/diagnostics";

suite("Backend validation", () => {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: ignore non-backend errors
    test("missing required property 'resources'", async () =>
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.2.3.4"
            },
            {},
            [
                "Warning: Missing required property resources (ARM Language Server)",
                "Error: Template validation failed: Required property 'resources' not found in JSON. Path '', line 4, position 1. (ARM Language Server)"
            ])
    );

    test("minimal deployment template - no errors", async () => {
        await testDiagnostics(
            minimalDeploymentTemplate,
            {},
            []);
    });
});
