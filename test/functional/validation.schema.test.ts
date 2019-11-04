// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length

import { sources, testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("Schema validation", () => {
    // tslint:disable-next-line: no-unsafe-any
    testWithLanguageServer("missing required property 'resources'", async () =>
        await testDiagnostics(
            {
                $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.2.3.4"
            },
            {
                includeSources: [sources.schema]
            },
            [
                'Warning: Missing required property "resources" (arm-template (schema))'
            ])
    );

    testWithLanguageServer(
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

    testWithLanguageServer(
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

    testWithLanguageServer(
        "Shouldn't validate expressions against schema",
        async () =>
            await testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "rgName": {
                            "type": "string",
                            "metadata": {
                                "description": "Name of the resourceGroup to create"
                            }
                        },
                        "rgLocation": {
                            "type": "string",
                            "defaultValue": "southcentralus",
                            "metadata": {
                                "description": "Location for the resourceGroup"
                            }
                        }
                    },
                    "variables": {},
                    "resources": [
                        {
                            "type": "Microsoft.Resources/resourceGroups",
                            "apiVersion": "2018-05-01",
                            "location": "[parameters('rgLocation')]",
                            // Schema has a regex validation and a maxLength validation, which we should ignore since it's an expression
                            "name": "[concat(parameters('rgName'),uniqueString('some-very-long-expression','and-another-long-expression','plus another one'))]",
                            "tags": {
                                "Note": "subscription level deployment"
                            },
                            "properties": {}
                        }
                    ]
                },
                {},
                []
            )
    );

    suite("Case-insensitivity", async () => {
        testWithLanguageServer(
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
        // TODO
        test("https://devdiv.visualstudio.com/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1013538");
    });
});
