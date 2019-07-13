// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";

suite("Schema validation", () => {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: ignore backend error
    test("missing required property 'resources'", async () =>
        await testDiagnostics(
            {
                $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.2.3.4"
            },
            {},
            [
                "Warning: Missing required property resources (ARM Language Server)",
                "Error: Template validation failed: Required property 'resources' not found in JSON. Path '', line 4, position 1. (ARM Language Server)"
            ])
    );

    test(
        "networkInterfaces 2018-10-01",
        async () =>
            await testDiagnosticsFromFile(
                'templates/networkInterfaces.json',
                {
                    search: /{{apiVersion}}/,
                    replace: "2018-10-01"
                },
                [])
    );

    test(
        "https://github.com/Azure/azure-resource-manager-schemas/issues/627",
        async () =>
            await testDiagnosticsFromFile(
                'templates/networkInterfaces.json',
                {
                    search: /{{apiVersion}}/,
                    replace: "2018-11-01"
                },
                [])
    );

    suite("Case-insensitivity", async () => {
        test(
            'Resource type miscapitalized',
            async () =>
                await testDiagnostics(
                    {
                        $schema: "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                        contentVersion: "1.0.0.0",
                        parameters: {
                            "publicIpAddressName": {
                                "type": "string"
                            },
                            "publicIpAddressType": {
                                type: "string"
                            },
                            publicIpAddressSku: {
                                type: "string"
                            },
                            location: {
                                type: "string"
                            }
                        },
                        resources: [{
                            "name": "[parameters('publicIpAddressName')]",
                            "type": "Microsoft.Network/publicIpAddresses", // should be publicIPAddresses
                            "apiVersion": "2018-08-01",
                            "location": "[parameters('location')]",
                            "properties": {
                                "publicIpAllocationMethod": "[parameters('publicIpAddressType')]" // should be publicIPAllocationMethod
                            },
                            "SKU": { // should be sku
                                "name": "[parameters('publicIpAddressSku')]"
                            },
                            "tags": {}
                        }
                        ]
                    },
                    {},
                    [
                    ])
        );
    });

    suite("More specific error messages for schema problems", async () => {
        /* TODO: not yet fixed
        test('Resource type miscapitalized (https://github.com/microsoft/vscode-azurearmtools/issues/238)',
            async () =>
                await testDiagnostics(
                    {
                        $schema: "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                        contentVersion: "1.0.0.0",
                        resources: [
                            {
                                name: "example",
                                type: "Microsoft.Network/publicIPAddresses",
                                apiVersion: "2018-08-01",
                                location: "westus",
                                properties: {},
                            }]
                    },
                    {},
                    [
                    ])
        ); */
    });
});
