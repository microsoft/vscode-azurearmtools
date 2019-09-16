// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string

import { sources, testDiagnostics } from "../support/diagnostics";
import { DISABLE_LANGUAGE_SERVER_TESTS } from "../testConstants";

suite("Backend validation", () => {
    if (DISABLE_LANGUAGE_SERVER_TESTS) {
        return;
    }

    // tslint:disable-next-line: no-suspicious-comment
    test("missing required property 'resources'", async () =>
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.2.3.4"
            },
            {
                includeSources: [sources.template]
            },
            [
                "Error: Template validation failed: Required property 'resources' not found in JSON. Path '', line 4, position 1. (arm-template (template validation))"
            ])
    );
});
