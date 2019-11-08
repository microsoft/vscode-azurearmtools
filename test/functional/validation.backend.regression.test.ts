// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length

import { testDiagnostics } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

suite("Schema validation regression tests", () => {
    testWithLanguageServer("Template validation error for evaluated variables (https://github.com/microsoft/vscode-azurearmtools/issues/380)", async () =>
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "Environment": {
                        "type": "string",
                        "metadata": {
                            "description": "Name of the Environment"
                        }
                    }
                },
                "variables": {
                    "PRD": {
                        "WebPorts": [
                            "8510",
                            "8520",
                            "8530",
                            "8540",
                            "8550",
                            "8560"
                        ]
                    },
                    "TST": {
                        "WebPorts": [
                            "8010",
                            "8020",
                            "8030",
                            "8040",
                            "8050",
                            "8060",
                            "8510",
                            "8520",
                            "8530",
                            "8540",
                            "8550",
                            "8560"
                        ]
                    },
                    "NSGRules": {
                        "WEBNSGRule": [
                            {
                                "name": "[concat('Allow-In-',variables(parameters('Environment')).WebPort[1],'-To-Web')]",
                                "properties": {
                                    "access": "Allow",
                                    "direction": "Inbound",
                                    "priority": 101,
                                    "protocol": "*",
                                    "sourcePortRange": "*",
                                    "sourceAddressPrefix": "VirtualNetwork",
                                    "destinationAddressPrefix": "VirtualNetwork",
                                    "destinationPortRange": "[variables(parameters('Environment')).WebPort[1]]"
                                }
                            }
                        ]
                    }
                },
                "resources": []
            },
            {
            },
            [
                // Expected: No validation errors

                // Unrelated errors:
                "Warning: The variable 'PRD' is never used. (arm-template (expressions))",
                "Warning: The variable 'TST' is never used. (arm-template (expressions))",
                "Warning: The variable 'NSGRules' is never used. (arm-template (expressions))"])
    );
});
