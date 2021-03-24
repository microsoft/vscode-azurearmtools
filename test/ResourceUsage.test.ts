// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name

import * as assert from "assert";
import { Histogram } from "../extension.bundle";
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate } from "./support/parseTemplate";

suite("ResourceUsage (schema.stats telemetry)", () => {

    async function testGetResourceUsage(template: Partial<IDeploymentTemplate>, expectedResourceUsage: { [key: string]: number }): Promise<void> {
        // tslint:disable-next-line:no-any
        const dt = parseTemplate(template);
        const resourceUsage: Histogram = dt.getResourceUsage();
        const expected = new Histogram();
        for (let propName of Object.getOwnPropertyNames(expectedResourceUsage)) {
            expected.add(propName, expectedResourceUsage[propName]);
        }

        assert.deepStrictEqual(resourceUsage, expected);
    }

    test("Simple resources", async () => {
        // tslint:disable-next-line:no-any
        const template = <IDeploymentTemplate><any>{
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
        // tslint:disable-next-line:no-any
        const template = <IDeploymentTemplate><any>{
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
        // tslint:disable-next-line:no-any
        const template = <IDeploymentTemplate><any>{
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
        // tslint:disable-next-line:no-any
        const template = {
            resources: [
                {
                    "name": "[parameters('virtualMachineName')]",
                    "TYPE": "Microsoft.Compute/virtualMachines",
                    "APIVERSION": "2016-04-30-preview"
                }
            ]
        };

        // tslint:disable-next-line:no-any
        await testGetResourceUsage(<any>template, {
            "microsoft.compute/virtualmachines@2016-04-30-preview": 1
        });
    });

    test("Multiple uses of resources, different version", async () => {
        // tslint:disable-next-line:no-any
        const template = <IDeploymentTemplate><any>{
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
        // tslint:disable-next-line:no-any
        const template = <IDeploymentTemplate><any>{
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
        // tslint:disable-next-line:no-any
        const template = <IDeploymentTemplate><any>{
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
        // tslint:disable-next-line:no-any
        const template = {
            resources: [
                {
                    "name": "[parameters('virtualMachineName')]",
                    "TYPE": "[parameters('resourceType')]",
                    "APIVERSION": "2016-04-30-preview"
                }
            ]
        };

        // tslint:disable-next-line:no-any
        await testGetResourceUsage(<any>template, {
            "[expression]@2016-04-30-preview": 1
        });
    });

    test("apiVersion is expression", async () => {
        // tslint:disable-next-line:no-any
        const template = {
            resources: [
                {
                    "apiVersion": "[concat(variables('apiVersion),'-preview')]",
                    "type": "Microsoft.Network/virtualNetworks"
                }
            ]
        };

        // tslint:disable-next-line:no-any
        await testGetResourceUsage(<any>template, {
            "microsoft.network/virtualnetworks@[expression]": 1
        });
    });

    test("apiVersion is multi-line expression", async () => {
        // tslint:disable-next-line:no-any
        const template = `{
            "resources": [
                {
                    "apiVersion": "[concat
                        (variables('apiVersion),'-preview')]",
                    "type": "Microsoft.Network/virtualNetworks"
                }
            ]
        }`;

        // tslint:disable-next-line:no-any
        await testGetResourceUsage(<any>template, {
            "microsoft.network/virtualnetworks@[expression]": 1
        });
    });

    test("apiVersion is missing, no apiProfile specified)", async () => {
        // tslint:disable-next-line:no-any
        const template = {
            resources: [
                {
                    "type": "Microsoft.Network/virtualNetworks"
                }
            ]
        };

        // tslint:disable-next-line:no-any
        await testGetResourceUsage(<any>template, {
            "microsoft.network/virtualnetworks@(profile=none)": 1
        });
    });

    test("apiVersion is missing, apiProfile specified)", async () => {
        // tslint:disable-next-line:no-any
        const template = {
            apiProfile: "myProfile",
            resources: [
                {
                    "type": "Microsoft.Network/virtualNetworks"
                }
            ]
        };

        // tslint:disable-next-line:no-any
        await testGetResourceUsage(<any>template, {
            "microsoft.network/virtualnetworks@(profile=myprofile)": 1
        });
    });
});
