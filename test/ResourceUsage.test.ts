// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name

import * as assert from "assert";
import { CaseInsensitiveMap, Histogram } from "../extension.bundle";
import { IPartialDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate } from "./support/parseTemplate";

suite("ResourceUsage (schema.stats telemetry)", () => {

    async function testGetResourceUsage(
        template: IPartialDeploymentTemplate | string,
        expectedResourceCounts: { [key: string]: number },
        expectedInvalidResourceCounts?: { [key: string]: number },
        expectedInvalidVersionCounts?: { [key: string]: number }
    ): Promise<void> {
        const dt = parseTemplate(template);
        const availableResourceTypesAndVersions = new CaseInsensitiveMap<string, string[]>();
        availableResourceTypesAndVersions.set("Microsoft.Network/virtualNetworks", ["2016-08-01", "2018-10-01", "2019-08-01"]);
        availableResourceTypesAndVersions.set("Microsoft.Resources/deployments", ["2020-10-01"]);
        const [resourceUsage, invalidResourceCounts, invalidVersionCounts] = dt.getResourceUsage(availableResourceTypesAndVersions);

        const expectedResourceCountsHistogram = new Histogram();
        for (const propName of Object.getOwnPropertyNames(expectedResourceCounts)) {
            expectedResourceCountsHistogram.add(propName, expectedResourceCounts[propName]);
        }
        assert.deepStrictEqual(resourceUsage, expectedResourceCountsHistogram);

        if (expectedInvalidResourceCounts) {
            const expectedInvalidResourceCountsHistogram = new Histogram();
            for (const propName of Object.getOwnPropertyNames(expectedInvalidResourceCounts)) {
                expectedInvalidResourceCountsHistogram.add(propName, expectedInvalidResourceCounts[propName]);
            }
            assert.deepStrictEqual(invalidResourceCounts, expectedInvalidResourceCountsHistogram);
        }
        if (expectedInvalidVersionCounts) {
            const expectedInvalidVersionCountsHistogram = new Histogram();
            for (const propName of Object.getOwnPropertyNames(expectedInvalidVersionCounts)) {
                expectedInvalidVersionCountsHistogram.add(propName, expectedInvalidVersionCounts[propName]);
            }
            assert.deepStrictEqual(invalidVersionCounts, expectedInvalidVersionCountsHistogram);
        }

    }

    test("Simple resources", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "name": "[parameters('virtualMachineName')]",
                    "type": "Microsoft.Compute/virtualMachines",
                    "apiVersion": "2016-04-30-preview",
                    "location": "[parameters('location')]",
                    "dependsOn": [
                        "[concat('Microsoft.Network/networkInterfaces/', parameters('networkInterfaceName'))]",
                        "[concat('Microsoft.Compute/availabilitySets/', parameters('availabilitySetName'))]",
                        "[concat('Microsoft.Storage/storageAccounts/', parameters('diagnosticsStorageAccountName'))]"
                    ]
                },
                {
                    "name": "[concat(parameters('virtualMachineName'),'/', variables('diagnosticsExtensionName'))]",
                    "type": "Microsoft.Compute/virtualMachines/extensions",
                    "apiVersion": "2017-03-30",
                    "location": "[parameters('location')]",
                    "dependsOn": [
                        "[concat('Microsoft.Compute/virtualMachines/', parameters('virtualMachineName'))]"
                    ]
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.compute/virtualmachines@2016-04-30-preview": 1,
            "microsoft.compute/virtualmachines/extensions@2017-03-30": 1
        });
    });

    test("Multiple uses of resources, same version", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "name": "[parameters('virtualMachineName')]",
                    "type": "Microsoft.Compute/virtualMachines",
                    "apiVersion": "2016-04-30-preview",
                    "location": "[parameters('location')]",
                    "dependsOn": [
                        "[concat('Microsoft.Network/networkInterfaces/', parameters('networkInterfaceName'))]",
                        "[concat('Microsoft.Compute/availabilitySets/', parameters('availabilitySetName'))]",
                        "[concat('Microsoft.Storage/storageAccounts/', parameters('diagnosticsStorageAccountName'))]"
                    ]
                },
                {
                    "type": "Microsoft.Compute/virtualMachines",
                    "name": "[parameters('virtualMachineName')]",
                    "apiVersion": "2016-04-30-preview"
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.compute/virtualmachines@2016-04-30-preview": 2
        });
    });

    test("Multiple uses of resources, case insensitive", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "name": "[parameters('virtualMachineName')]",
                    "type": "Microsoft.Compute/virtualMachines",
                    "apiVersion": "2016-04-30-preview",
                    "location": "[parameters('location')]",
                    "dependsOn": [
                        "[concat('Microsoft.Network/networkInterfaces/', parameters('networkInterfaceName'))]",
                        "[concat('Microsoft.Compute/availabilitySets/', parameters('availabilitySetName'))]",
                        "[concat('Microsoft.Storage/storageAccounts/', parameters('diagnosticsStorageAccountName'))]"
                    ]
                },
                {
                    "type": "Microsoft.Compute/VIRTUALMACHINES",
                    "name": "[parameters('virtualMachineName')]",
                    "apiVersion": "2016-04-30-PREVIEW"
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.compute/virtualmachines@2016-04-30-preview": 2
        });
    });

    test("case insensitive keys", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "name": "[parameters('virtualMachineName')]",
                    "TYPE": "Microsoft.Compute/virtualMachines",
                    "APIVERSION": "2016-04-30-preview"
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.compute/virtualmachines@2016-04-30-preview": 1
        });
    });

    test("Multiple uses of resources, different version", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "name": "[parameters('virtualMachineName')]",
                    "type": "Microsoft.Compute/virtualMachines",
                    "apiVersion": "2016-04-30-preview",
                    "location": "[parameters('location')]",
                    "dependsOn": [
                        "[concat('Microsoft.Network/networkInterfaces/', parameters('networkInterfaceName'))]",
                        "[concat('Microsoft.Compute/availabilitySets/', parameters('availabilitySetName'))]",
                        "[concat('Microsoft.Storage/storageAccounts/', parameters('diagnosticsStorageAccountName'))]"
                    ]
                },
                {
                    "type": "Microsoft.Compute/VIRTUALMACHINES",
                    "name": "[parameters('virtualMachineName')]",
                    "apiVersion": "2016-04-30"
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.compute/virtualmachines@2016-04-30-preview": 1,
            "microsoft.compute/virtualmachines@2016-04-30": 1
        });
    });

    test("Child resources", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "apiVersion": "2018-10-01",
                    "type": "Microsoft.Network/virtualNetworks",
                    "name": "VNet1",
                    "location": "[parameters('location')]",
                    "properties": {
                        "addressSpace": {
                            "addressPrefixes": [
                                "10.0.0.0/16"
                            ]
                        }
                    },
                    "resources": [
                        {
                            "apiVersion": "2018-10-02",
                            "type": "subnets",
                            "location": "[parameters('location')]",
                            "name": "Subnet1",
                            "dependsOn": [
                                "VNet1"
                            ],
                            "properties": {
                                "addressPrefix": "10.0.0.0/24"
                            }
                        }
                    ]
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.network/virtualnetworks@2018-10-01": 1,
            "subnets@2018-10-02[parent=microsoft.network/virtualnetworks@2018-10-01]": 1
        });
    });

    test("Deep child resources", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "apiVersion": "2018-10-01",
                    "type": "Microsoft.Network/virtualNetworks",
                    "name": "VNet1",
                    "location": "[parameters('location')]",
                    "properties": {
                        "addressSpace": {
                            "addressPrefixes": [
                                "10.0.0.0/16"
                            ]
                        }
                    },
                    "resources": [
                        {
                            "apiVersion": "2018-10-02",
                            "type": "subnets",
                            "location": "[parameters('location')]",
                            "name": "Subnet1",
                            "dependsOn": [
                                "VNet1"
                            ],
                            "properties": {
                                "addressPrefix": "10.0.0.0/24"
                            },
                            "resources": [
                                {
                                    "apiVersion": "123",
                                    "type": "whatever"
                                }
                            ]
                        }
                    ]
                },
                {
                    "apiVersion": "2018-10-01",
                    "type": "Microsoft.Network/virtualNetworks",
                    "name": "VNet1",
                    "location": "[parameters('location')]",
                    "properties": {
                        "addressSpace": {
                            "addressPrefixes": [
                                "10.0.0.0/16"
                            ]
                        }
                    }
                },
                {
                    "apiVersion": "123",
                    "type": "whatever"
                }]
        };

        await testGetResourceUsage(template, {
            "microsoft.network/virtualnetworks@2018-10-01": 2,
            "subnets@2018-10-02[parent=microsoft.network/virtualnetworks@2018-10-01]": 1,
            "whatever@123[parent=subnets@2018-10-02]": 1,
            "whatever@123": 1
        });
    });

    test("resource type is expression", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "name": "[parameters('virtualMachineName')]",
                    "TYPE": "[parameters('resourceType')]",
                    "APIVERSION": "2016-04-30-preview"
                }
            ]
        };

        await testGetResourceUsage(template, {
            "[expression]@2016-04-30-preview": 1
        });
    });

    test("apiVersion is expression", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "apiVersion": "[concat(variables('apiVersion),'-preview')]",
                    "type": "Microsoft.Network/virtualNetworks"
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.network/virtualnetworks@[expression]": 1
        });
    });

    test("apiVersion is multi-line expression", async () => {
        const template = `{
            "resources": [
                {
                    "apiVersion": "[concat
                        (variables('apiVersion),'-preview')]",
                    "type": "Microsoft.Network/virtualNetworks"
                }
            ]
        }`;

        await testGetResourceUsage(template, {
            "microsoft.network/virtualnetworks@[expression]": 1
        });
    });

    test("apiVersion is missing, no apiProfile specified)", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "type": "Microsoft.Network/virtualNetworks"
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.network/virtualnetworks@(profile=none)": 1
        });
    });

    test("apiVersion is missing, apiProfile specified)", async () => {
        const template: IPartialDeploymentTemplate = {
            apiProfile: "myProfile",
            resources: [
                {
                    "type": "Microsoft.Network/virtualNetworks"
                }
            ]
        };

        await testGetResourceUsage(template, {
            "microsoft.network/virtualnetworks@(profile=myprofile)": 1
        });
    });

    test("Invalid resource types and apiVersions)", async () => {
        const template: IPartialDeploymentTemplate = {
            resources: [
                {
                    "apiVersion": "2018-10-01",
                    "type": "Microsoft.Network/virtualNetworks",
                },
                {
                    "apiVersion": "2018-10-01",
                    "type": "Microsoft.Network/virtualNetworks",
                },

                // Invalid api version
                {
                    "apiVersion": "2018-10-99",
                    "type": "Microsoft.Network/virtualNetworks"
                },
                {
                    "apiVersion": "2018-10-99",
                    "type": "Microsoft.Network/virtualNetworks"
                },

                // Invalid type
                {
                    "apiVersion": "2018-10-01",
                    "type": "Microsoft.Network/virtualNetworkies",
                },
                {
                    "apiVersion": "2018-10-01",
                    "type": "Microsoft.Network/virtualNetworkies",
                },
                {
                    "apiVersion": "2018-10-01",
                    "type": "Microsoft.Network/virtualNetworkies",
                }

            ]
        };

        await testGetResourceUsage(
            template,
            {
                "microsoft.network/virtualnetworks@2018-10-01": 2,
                "microsoft.network/virtualnetworkies@2018-10-01": 3,
                "microsoft.network/virtualnetworks@2018-10-99": 2,
            },
            {
                "microsoft.network/virtualnetworkies@2018-10-01": 3
            },
            {
                "microsoft.network/virtualnetworks@2018-10-99": 2
            }
        );
    });

});
