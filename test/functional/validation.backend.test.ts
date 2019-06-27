// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string

import { testDiagnostics } from "../support/diagnostics";

interface IDeploymentTemplateResource {
    // tslint:disable-next-line:no-reserved-keywords
    type: string;
    name: string;
    apiVersion: string;
    location: string;
    dependsOn?: string[];
    tags?: { [key: string]: string };
    properties?: { [key: string]: unknown };
    resources?: IDeploymentTemplateResource[];
}

interface IDeploymentTemplate {
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" | "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#";
    contentVersion: string;
    parameters?: {
        [key: string]: unknown;
        // tslint:disable-next-line:no-reserved-keywords
        type: string;
        metadata?: {
            [key: string]: string;
            description?: string;
        };
        maxLength?: number;
        defaultValue?: unknown;
        allowedValues: unknown[];
    };
    variables?: {
        [key: string]: unknown;
    };
    resources: IDeploymentTemplateResource[];
    outputs?: {
        [key: string]: {
            // tslint:disable-next-line:no-reserved-keywords
            type: string;
            value: unknown;
        };
    };
}

const minimalDeploymentTemplate: IDeploymentTemplate = {
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
    ]
};

suite("Backend validation", () => {
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
