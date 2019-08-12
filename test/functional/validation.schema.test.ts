// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length

import { sources, testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";

suite("Schema validation", () => {
    test("missing required property 'resources'", async () =>
        await testDiagnostics(
            {
                $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.2.3.4"
            },
            {
                includeSources: [sources.schema]
            },
            [
                "Warning: Missing required property resources (ARM (Schema))"
            ])
    );

    test(
        "networkInterfaces 2018-10-01",
        async () =>
            await testDiagnosticsFromFile(
                'templates/networkInterfaces.json',
                {
                    search: /{{apiVersion}}/,
                    replace: "2018-10-01",
                    includeSources: [sources.schema]
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
                    replace: "2018-11-01",
                    includeSources: [sources.schema]
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
                    {
                        includeSources: [sources.schema]
                    },
                    [
                    ])
        );
    });

    suite("More specific error messages for schema problems", async () => {
        // tslint:disable-next-line: no-suspicious-comment
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
