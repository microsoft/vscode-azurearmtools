// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { testDiagnosticsFromFile } from "./support/diagnostics";

suite("Schema validation", () => {
    test(
        "networkInterfaces 2018-10-01",
        async () =>
            testDiagnosticsFromFile(
                'networkInterfaces.json',
                {
                    search: /{{apiVersion}}/,
                    replace: "2018-10-01"
                },
                [])
    );

    test(
        "https://github.com/Azure/azure-resource-manager-schemas/issues/627",
        async () =>
            testDiagnosticsFromFile(
                'networkInterfaces.json',
                {
                    search: /{{apiVersion}}/,
                    replace: "2018-11-01"
                },
                [])
    );

    suite("Capitalization", () => {
        /* TODO: enable when fixed
        testDiagnostics(
            'Resource type miscapitalized (https://github.com/microsoft/vscode-azurearmtools/issues/238)',
            {
                "resources": [
                    {
                        "name": "example",
                        "type": "Microsoft.Network/publicIpAddresses",
                        "apiVersion": "2018-08-01",
                        "location": "[parameters('location')]",
                        "properties": {},
                    }]
            },
            { ignoreSources: [armToolsSource] },
            [
            ]);*/
    });
});
