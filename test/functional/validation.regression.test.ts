// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length

import * as os from 'os';
import { testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";
import { testWithLanguageServer, testWithLanguageServerAndRealFunctionMetadata } from "../support/testWithLanguageServer";

suite("Validation regression tests", () => {
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
                // Expected No validation errors

                // Unrelated errors:
                "Warning: The variable 'PRD' is never used. (arm-template (expressions))",
                "Warning: The variable 'TST' is never used. (arm-template (expressions))",
                "Warning: The variable 'NSGRules' is never used. (arm-template (expressions))"])
    );

    testWithLanguageServerAndRealFunctionMetadata(
        'validation fails using int() with parameter (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1016832)',
        async () =>
            testDiagnosticsFromFile(
                'templates/portal/new-vmscaleset1.json',
                {
                    includeRange: true
                },
                [
                    // Expected no backend validation errors

                    // Unrelated errors:

                    // tslint:disable-next-line: no-suspicious-comment
                    // TODO: https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1016835
                    "Error: Expected a comma (','). (arm-template (expressions))",

                    // Expected schema errors:
                    `Warning: Value must conform to exactly one of the associated schemas${os.EOL}|   Value must be one of the following types: boolean${os.EOL}|   or${os.EOL}|   Value must match the regular expression ^\\[([^\\[].*)?\\]$ (arm-template (schema))`
                ]
            )
    );

    testWithLanguageServer(
        'Validation error if you have a parameter of type "object" [regression from 0.7.0] (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1016824)',
        async () =>
            testDiagnostics(
                {
                    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "backupPolicyName": {
                            "type": "object"
                        },
                        "s": {
                            "type": "string"
                        },
                        "ss": {
                            "type": "securestring"
                        },
                        "i": {
                            "type": "int"
                        },
                        "b": {
                            "type": "bool"
                        },
                        "so": {
                            "type": "secureobject"
                        },
                        "a": {
                            "type": "array"
                        }
                    },
                    "resources": [
                    ],
                    "outputs": {
                        "oo": {
                            "type": "object",
                            "value": "[parameters('backupPolicyName')]"
                        },
                        "os": {
                            "type": "string",
                            "value": "[parameters('s')]"
                        },
                        "oss": {
                            "type": "securestring",
                            "value": "[parameters('ss')]"
                        }
                        ,
                        "oi": {
                            "type": "int",
                            "value": "[parameters('i')]"
                        }
                        ,
                        "b": {
                            "type": "bool",
                            "value": "[parameters('b')]"
                        },
                        "oso": {
                            "type": "secureObject",
                            "value": "[parameters('so')]"
                        },
                        "oa": {
                            "type": "array",
                            "value": "[parameters('a')]"
                        }
                    }
                },
                {},
                []
            )
    );

    testWithLanguageServer(
        'Validation error if you have a parameter of type "object" [regression from 0.7.0] (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1016824)',
        async () =>
            testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "builtInRoleType": {
                            "type": "string",
                            "allowedValues": [
                                "Owner",
                                "Contributor",
                                "Reader"
                            ],
                            "maxLength": 10,
                            "minLength": 9
                        }
                    },
                    "resources": [
                    ],
                    "outputs": {
                        "o": {
                            "type": "string",
                            "value": "[parameters('builtInRoleType')]"
                        }
                    }
                },
                {},
                []));
});
