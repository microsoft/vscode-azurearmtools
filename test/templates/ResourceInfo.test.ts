// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: max-func-body-length object-literal-key-quotes

import * as assert from "assert";
import { getResourcesInfo, IResourceInfo, ResourceInfo } from "../../extension.bundle";
import { IPartialDeploymentTemplate } from "../support/diagnostics";
import { parseTemplate } from "../support/parseTemplate";

suite("ResourceInfo", () => {
    suite("fullType", () => {
        function createFullTypeTest(
            typeSegmentExpressions: string[],
            expected: string | undefined
        ): void {
            const testName = JSON.stringify(typeSegmentExpressions);
            test(testName, () => {
                const ri = new ResourceInfo([], typeSegmentExpressions);
                const typeName = ri.getFullTypeExpression();
                assert.deepStrictEqual(typeName, expected);
            });
        }

        createFullTypeTest([], undefined);
        createFullTypeTest([`'a'`], `'a'`);
        createFullTypeTest([`'ms.abc'`], `'ms.abc'`);
        createFullTypeTest([`'ms.abc'`, `'def'`], `'ms.abc/def'`);
        createFullTypeTest([`'ms.abc'`, `'def'`, `'ghi'`], `'ms.abc/def/ghi'`);

        suite("expressions", () => {
            createFullTypeTest([`parameters('abc')`], `parameters('abc')`);
            createFullTypeTest([`parameters('abc')`, `'def'`], `concat(parameters('abc'), '/def')`);
            createFullTypeTest([`'abc'`, `parameters('def')`], `concat('abc/', parameters('def'))`);
            createFullTypeTest([`parameters('abc')`, `parameters('def')`], `concat(parameters('abc'), '/', parameters('def'))`);
            createFullTypeTest([`parameters('abc')`, `'def'`, `parameters('ghi')`], `concat(parameters('abc'), '/def/', parameters('ghi'))`);
        });

        suite("coalesce consequence strings", () => {
            createFullTypeTest(
                [
                    `parameters('a')`, `'b'`, `'c'`, `'d'`, `parameters('e')`, `parameters('f')`, `'g'`, `'h'`
                ],
                `concat(parameters('a'), '/b/c/d/', parameters('e'), '/', parameters('f'), '/g/h')`);
        });
    });

    suite("fullName", () => {
        function createFullNameTest(
            typeSegmentExpressions: string[],
            expected: string | undefined
        ): void {
            const testName = JSON.stringify(typeSegmentExpressions);
            test(testName, () => {
                const ri = new ResourceInfo([], typeSegmentExpressions);
                const typeName = ri.getFullTypeExpression();
                assert.deepStrictEqual(typeName, expected);
            });
        }

        createFullNameTest([], undefined);
        createFullNameTest([`'a'`], `'a'`);
        createFullNameTest([`'abc'`, `'def'`], `'abc/def'`);
        createFullNameTest([`'abc'`, `'def'`, `'ghi'`], `'abc/def/ghi'`);

        suite("expressions", () => {
            createFullNameTest([`parameters('abc')`], `parameters('abc')`);
            createFullNameTest([`parameters('abc')`, `'def'`], `concat(parameters('abc'), '/def')`);
            createFullNameTest([`'abc'`, `parameters('def')`], `concat('abc/', parameters('def'))`);
            createFullNameTest([`parameters('abc')`, `parameters('def')`], `concat(parameters('abc'), '/', parameters('def'))`);
            createFullNameTest([`parameters('abc')`, `'def'`, `parameters('ghi')`], `concat(parameters('abc'), '/def/', parameters('ghi'))`);
        });

        suite("coalesce consequence strings", () => {
            createFullNameTest(
                [
                    `parameters('a')`,
                    `'b'`,
                    `'c'`,
                    `'d'`,
                    `123`,
                    `456`,
                    `parameters('e')`,
                    `parameters('f')`,
                    `'g'`,
                    `'h'`
                ],
                `concat(parameters('a'), '/b/c/d/', 123, '/', 456, '/', parameters('e'), '/', parameters('f'), '/g/h')`);
        });
    });

    suite("getResourceIdExpression", () => {
        function createResourceIdTest(
            testName: string,
            resource: IResourceInfo,
            expected: string | undefined
        ): void {
            testName = testName + JSON.stringify(`${resource.getFullTypeExpression()}: ${resource.getFullNameExpression()}`);
            test(testName, () => {
                const resourceId = resource.getResourceIdExpression();
                assert.deepStrictEqual(resourceId, expected);
            });
        }

        suite("empty name or type", () => {
            createResourceIdTest("", new ResourceInfo([], []), undefined);
            createResourceIdTest("", new ResourceInfo(['a'], []), undefined);
            createResourceIdTest("", new ResourceInfo([], ['a']), undefined);
        });

        createResourceIdTest(
            "type has expressions",
            new ResourceInfo(
                [`'a'`],
                [`parameters('a')`, `'b'`]
            ),
            `resourceId(concat(parameters('a'), '/b'), 'a')`);

        createResourceIdTest(
            "names with multiple segments (they are not coalesced)",
            new ResourceInfo(
                [`'a'`, `'b'`, `variables('v1')`, `'c'`],
                [`'microsoft.abc/def'`]
            ),
            `resourceId('microsoft.abc/def', 'a', 'b', variables('v1'), 'c')`);

    });

    suite("getResourcesInfo", () => {

        test("101-azure-database-migration-service", async () => {

            const template: IPartialDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "resources": [
                    {
                        "type": "Microsoft.Compute/virtualMachines",
                        "name": "[variables('sourceServerName')]",
                        "dependsOn": [
                            "[resourceId('Microsoft.Network/networkInterfaces', variables('sourceNicName'))]"
                        ],
                        "resources": [
                            {
                                "type": "extensions",
                                "name": "SqlIaasExtension",
                                "dependsOn": [
                                    "[concat('Microsoft.Compute/virtualMachines/', variables('sourceServerName'))]"
                                ]
                            },
                            {
                                "type": "extensions",
                                "name": "CustomScriptExtension",
                                "dependsOn": [
                                    "[concat('Microsoft.Compute/virtualMachines/', variables('sourceServerName'))]",
                                    "[concat('Microsoft.Compute/virtualMachines/', concat(variables('sourceServerName'),'/extensions/SqlIaasExtension'))]"
                                ]
                            }
                        ]
                    },
                    {
                        "type": "Microsoft.DataMigration/services",
                        "name": "[variables('DMSServiceName')]",
                        "properties": {
                            "virtualSubnetId": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('adVNet'), variables('defaultSubnetName'))]"
                        },
                        "resources": [
                            {
                                "type": "projects",
                                "name": "SqlToSqlDbMigrationProject",
                                "dependsOn": [
                                    "[resourceId('Microsoft.DataMigration/services', variables('DMSServiceName'))]"
                                ]
                            }
                        ],
                        "dependsOn": [
                            "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('adVNet'), variables('defaultSubnetName'))]"
                        ]
                    },
                    {
                        "type": "Microsoft.Network/networkInterfaces",
                        "name": "[variables('sourceNicName')]",
                        "dependsOn": [
                            "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('adVNet'), variables('defaultSubnetName'))]",
                            "[resourceId('Microsoft.Network/publicIpAddresses', variables('publicIPSourceServer'))]"
                        ],
                        "properties": {
                            "ipConfigurations": [
                                {
                                    "name": "ipconfig",
                                    "properties": {
                                        "subnet": {
                                            "id": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('adVNet'), variables('defaultSubnetName'))]"
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "type": "Microsoft.Network/networkSecurityGroups",
                        "name": "[variables('sourceServerNSG')]"
                    },
                    {
                        "type": "Microsoft.Network/publicIPAddresses",
                        "name": "[variables('publicIPSourceServer')]"
                    },
                    {
                        "type": "Microsoft.Network/virtualNetworks",
                        "name": "[variables('adVNet')]",
                        "properties": {
                            "addressSpace": {
                                "addressPrefixes": [
                                    "10.2.0.0/24"
                                ]
                            },
                            "SUBNETS": [
                                {
                                    "name": "default",
                                    "properties": {
                                        "addressPrefix": "10.2.0.0/24"
                                    }
                                }
                            ],
                        },
                        "resources": [
                            {
                                "type": "Subnets",
                                "name": "[variables('defaultSubnetName')]",
                                "dependsOn": [
                                    "[resourceId('Microsoft.Network/virtualNetworks', variables('adVNet'))]"
                                ]
                            }
                        ]
                    },
                    {
                        "type": "Microsoft.Storage/storageAccounts",
                        "name": "[variables('storageAccountName')]"
                    },
                    {
                        "type": "Microsoft.Sql/servers",
                        "name": "[concat(variables('targetServerName'))]",
                        "resources": [
                            {
                                "type": "databases",
                                "name": "[variables('databaseName')]",
                                "dependsOn": [
                                    "[resourceId('Microsoft.Sql/servers', concat(variables('targetServerName')))]"
                                ],
                                "resources": [
                                    {
                                        "name": "Import",
                                        "type": "extensions",
                                        "dependsOn": [
                                            "[resourceId('Microsoft.Sql/servers/databases', variables('targetServerName'), variables('databaseName'))]"
                                        ]
                                    }
                                ]
                            },
                            {
                                "type": "firewallrules",
                                "name": "AllowAllWindowsAzureIps",
                                "dependsOn": [
                                    "[resourceId('Microsoft.Sql/servers', concat(variables('targetServerName')))]"
                                ]
                            }
                        ]
                    }
                ]
            };

            const dt = await parseTemplate(template);
            const infos = getResourcesInfo(dt.topLevelScope);

            const actual = infos.map(info => ({
                name: info.shortNameExpression,
                type: info.getFullTypeExpression(),
                resourceId: info.getResourceIdExpression(),
                parent: info.parent?.shortNameExpression
            }));
            const expected = [
                {
                    "type": "'Microsoft.Compute/virtualMachines'",
                    "name": "variables('sourceServerName')",
                    resourceId: "resourceId('Microsoft.Compute/virtualMachines', variables('sourceServerName'))",
                    parent: undefined,
                },
                {
                    "type": "'Microsoft.Compute/virtualMachines/extensions'",
                    "name": "'SqlIaasExtension'",
                    resourceId: "resourceId('Microsoft.Compute/virtualMachines/extensions', variables('sourceServerName'), 'SqlIaasExtension')",
                    parent: "variables('sourceServerName')"
                },
                {
                    "type": "'Microsoft.Compute/virtualMachines/extensions'",
                    "name": "'CustomScriptExtension'",
                    resourceId: "resourceId('Microsoft.Compute/virtualMachines/extensions', variables('sourceServerName'), 'CustomScriptExtension')",
                    parent: "variables('sourceServerName')"
                },
                {
                    "type": "'Microsoft.DataMigration/services'",
                    "name": "variables('DMSServiceName')",
                    resourceId: "resourceId('Microsoft.DataMigration/services', variables('DMSServiceName'))",
                    parent: undefined
                },
                {
                    "type": "'Microsoft.DataMigration/services/projects'",
                    "name": "'SqlToSqlDbMigrationProject'",
                    resourceId: "resourceId('Microsoft.DataMigration/services/projects', variables('DMSServiceName'), 'SqlToSqlDbMigrationProject')",
                    parent: "variables('DMSServiceName')"
                },
                {
                    "type": "'Microsoft.Network/networkInterfaces'",
                    "name": "variables('sourceNicName')",
                    resourceId: `resourceId('Microsoft.Network/networkInterfaces', variables('sourceNicName'))`,
                    parent: undefined
                },
                {
                    "type": "'Microsoft.Network/networkSecurityGroups'",
                    "name": "variables('sourceServerNSG')",
                    resourceId: "resourceId('Microsoft.Network/networkSecurityGroups', variables('sourceServerNSG'))",
                    parent: undefined
                },
                {
                    "type": "'Microsoft.Network/publicIPAddresses'",
                    "name": "variables('publicIPSourceServer')",
                    resourceId: "resourceId('Microsoft.Network/publicIPAddresses', variables('publicIPSourceServer'))",
                    parent: undefined
                },
                {
                    "type": "'Microsoft.Network/virtualNetworks'",
                    "name": "variables('adVNet')",
                    resourceId: "resourceId('Microsoft.Network/virtualNetworks', variables('adVNet'))",
                    parent: undefined
                },
                {
                    "type": "'Microsoft.Network/virtualNetworks/Subnets'",
                    "name": "variables('defaultSubnetName')",
                    resourceId: `resourceId('Microsoft.Network/virtualNetworks/Subnets', variables('adVNet'), variables('defaultSubnetName'))`,
                    parent: "variables('adVNet')"
                },
                {
                    "type": "'Microsoft.Network/virtualNetworks/subnets'",
                    "name": "'default'",
                    resourceId: "resourceId('Microsoft.Network/virtualNetworks/subnets', variables('adVNet'), 'default')",
                    parent: "variables('adVNet')"
                },
                {
                    "type": "'Microsoft.Storage/storageAccounts'",
                    "name": "variables('storageAccountName')",
                    resourceId: "resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName'))",
                    parent: undefined
                },
                {
                    "type": "'Microsoft.Sql/servers'",
                    "name": "concat(variables('targetServerName'))",
                    resourceId: "resourceId('Microsoft.Sql/servers', concat(variables('targetServerName')))",
                    parent: undefined
                },
                {
                    "type": "'Microsoft.Sql/servers/databases'",
                    "name": "variables('databaseName')",
                    resourceId: "resourceId('Microsoft.Sql/servers/databases', concat(variables('targetServerName')), variables('databaseName'))",
                    parent: "concat(variables('targetServerName'))"
                },
                {
                    "type": "'Microsoft.Sql/servers/databases/extensions'",
                    "name": "'Import'",
                    resourceId: "resourceId('Microsoft.Sql/servers/databases/extensions', concat(variables('targetServerName')), variables('databaseName'), 'Import')",
                    parent: "variables('databaseName')"
                },
                {
                    "type": "'Microsoft.Sql/servers/firewallrules'",
                    "name": "'AllowAllWindowsAzureIps'",
                    resourceId: "resourceId('Microsoft.Sql/servers/firewallrules', concat(variables('targetServerName')), 'AllowAllWindowsAzureIps')",
                    parent: "concat(variables('targetServerName'))"
                }
            ];

            assert.deepStrictEqual(actual, expected);
        });

    });
});
