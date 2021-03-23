// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: max-func-body-length object-literal-key-quotes

import * as assert from "assert";
import { getResourceInfo, getResourcesInfo, ResourceInfo } from "../../extension.bundle";
import { IPartialDeploymentTemplate } from "../support/diagnostics";
import { parseTemplate } from "../support/parseTemplate";

suite("ResourceInfo", () => {

    suite("split names", () => {
        function createSplitNameTest(nameAsJsonString: string, expected: string[]): void {
            test(nameAsJsonString, async () => {
                const dt = parseTemplate({
                    resources: [
                        {
                            name: nameAsJsonString,
                            type: "ms.abc/def"
                        }
                    ]
                });
                // tslint:disable-next-line: no-non-null-assertion
                const info = getResourceInfo(dt.topLevelScope.rootObject!.getPropertyValue('resources')!.asArrayValue!.elements[0].asObjectValue!)!;
                const actual = info.nameSegmentExpressions;
                assert.deepStrictEqual(actual, expected);

            });
        }

        createSplitNameTest("simple string", ["'simple string'"]);
        createSplitNameTest("simple string/separated", ["'simple string'", "'separated'"]);
        createSplitNameTest("simple string/separated/again", ["'simple string'", "'separated'", "'again'"]);
        createSplitNameTest("[]", ['']);
        createSplitNameTest("[variables('a')]", ["variables('a')"]);
        createSplitNameTest("[concat(variables('a'), variables('b'))]", ["concat(variables('a'), variables('b'))"]);
        createSplitNameTest("[concat(variables('a'), '/', variables('b'))]", ["variables('a')", "variables('b')"]);
        createSplitNameTest("[concat(variables('a'), '/b')]", ["variables('a')", "'b'"]);
        createSplitNameTest("[concat(variables('a'), '/b', '/', variables('c'))]", ["variables('a')", "'b'", "variables('c')"]);
    });

    suite("split types", () => {
        function createSplitTypeTest(typeAsJsonString: string, expected: string[]): void {
            test(typeAsJsonString, async () => {
                const dt = parseTemplate({
                    resources: [
                        {
                            name: "name",
                            type: typeAsJsonString
                        }
                    ]
                });
                // tslint:disable-next-line: no-non-null-assertion
                const info = getResourceInfo(dt.topLevelScope.rootObject!.getPropertyValue('resources')!.asArrayValue!.elements[0].asObjectValue!);
                // tslint:disable-next-line: no-non-null-assertion
                const actual = info!.typeSegmentExpressions;
                assert.deepStrictEqual(actual, expected);

            });
        }

        suite("invalid types", () => {
            createSplitTypeTest("", ["''"]);
            createSplitTypeTest("simple string", ["'simple string'"]);
            createSplitTypeTest("simple string/separated", ["'simple string/separated'"]);
            createSplitTypeTest("[]", ['']);
            createSplitTypeTest("[variables('a')]", ["variables('a')"]);
            createSplitTypeTest("[concat(variables('a'), variables('b'))]", ["concat(variables('a'), variables('b'))"]);
        });

        suite("simple strings", () => {
            createSplitTypeTest("Microsoft.Sql/servers", ["'Microsoft.Sql/servers'"]);
            createSplitTypeTest("Microsoft.Sql/servers/firewallRules", ["'Microsoft.Sql/servers'", "'firewallRules'"]);
            createSplitTypeTest("Microsoft.Sql/servers/firewallRules/another", ["'Microsoft.Sql/servers'", "'firewallRules'", "'another'"]);
        });

        suite('expressions', () => {
            createSplitTypeTest("[variables('sqlservers')]", ["variables('sqlservers')"]);
            createSplitTypeTest("[concat('Microsoft.Sql/servers')]", ["'Microsoft.Sql/servers'"]);
            createSplitTypeTest("[concat('Microsoft.Sql', '/servers')]", ["'Microsoft.Sql/servers'"]);
            createSplitTypeTest("[concat('Microsoft.Sql/', 'servers')]", ["'Microsoft.Sql/servers'"]);
            createSplitTypeTest("[concat('Microsoft.Sql', '/', 'servers')]", ["'Microsoft.Sql/servers'"]);

            createSplitTypeTest("[concat('Microsoft.Sql', '/', variables('servers'))]", ["concat('Microsoft.Sql/', variables('servers'))"]);

            // This one is ambiguous - we don't know if variables('a') or variables('b') contains a '/'.  If they do, they're separate segments, otherwise a single segment.
            // Like with names, we always assume that variables/variables do *not* contain slashes.  But this is just one way to interpret this.
            createSplitTypeTest("[concat('Microsoft.Sql', '/', variables('a'), variables('b'))]", ["concat('Microsoft.Sql/', concat(variables('a'), variables('b')))"]);

            createSplitTypeTest("[concat('Microsoft.Sql', '/', variables('servers'),'/', variables('grandchild'))]", ["concat('Microsoft.Sql/', variables('servers'))", "variables('grandchild')"]);
            createSplitTypeTest("[concat('Microsoft.Sql', '/', variables('servers'),'/', 'grandchild')]", ["concat('Microsoft.Sql/', variables('servers'))", "'grandchild'"]);

            // Again, assuming "/servers" and variables('other') must go together because there's no '/' in between.
            // Not currently optimizing the expression as well as we could
            createSplitTypeTest("[concat('Microsoft.Sql', '/servers', variables('other'),'/', 'grandchild')]", ["concat('Microsoft.Sql/', concat('servers', variables('other')))", "'grandchild'"]);

            createSplitTypeTest("[concat('Microsoft.Sql', variables('slashservers'),'/', 'grandchild')]", ["concat('Microsoft.Sql', variables('slashservers'))", "'grandchild'"]);
            createSplitTypeTest("[concat('Microsoft.Sql/servers/', variables('servers'))]", ["'Microsoft.Sql/servers'", "variables('servers')"]);
            createSplitTypeTest("[concat('Microsoft.Sql/servers/other2', variables('servers'))]", ["'Microsoft.Sql/servers'", "concat('other2', variables('servers'))"]);
            createSplitTypeTest("[concat('Microsoft.Sql/servers/other2/', variables('servers'))]", ["'Microsoft.Sql/servers'", "'other2'", "variables('servers')"]);

            createSplitTypeTest("Microsoft.Sql/servers", ["'Microsoft.Sql/servers'"]);
            createSplitTypeTest("Microsoft.Sql/servers/firewallRules", ["'Microsoft.Sql/servers'", "'firewallRules'"]);
            createSplitTypeTest("Microsoft.Sql/servers/firewallRules/another", ["'Microsoft.Sql/servers'", "'firewallRules'", "'another'"]);
        });

        createSplitTypeTest("[variables('a')]", ["variables('a')"]);
        createSplitTypeTest("[concat(variables('a'), variables('b'))]", ["concat(variables('a'), variables('b'))"]);
        createSplitTypeTest("[concat(variables('a'), '/', variables('b'))]", ["variables('a')", "variables('b')"]);
        createSplitTypeTest("[concat(variables('a'), '/b')]", ["variables('a')", "'b'"]);
        createSplitTypeTest("[concat(variables('a'), '/b', '/', variables('c'))]", ["variables('a')", "'b'", "variables('c')"]);
        createSplitTypeTest("[concat(variables('a'), '/b')]", ["variables('a')", "'b'"]);

        createSplitTypeTest("[concat('ms.abc', '/', parameters('b'))]", ["concat('ms.abc/', parameters('b'))"]);
        createSplitTypeTest("[concat('ms.abc', '/', parameters('b'))]", ["concat('ms.abc/', parameters('b'))"]);
        createSplitTypeTest("[concat('ms.abc/', parameters('b'))]", ["concat('ms.abc/', parameters('b'))"]);
        createSplitTypeTest("[concat(parameters('a'), '/def/', parameters('b'))]", ["parameters('a')", "'def'", "parameters('b')"]);
    });

    suite("fullTypeExpression", () => {
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

    suite("shortTypeExpression", () => {
        function createShortTypeTest(
            typeSegmentExpressions: string[],
            expected: string | undefined
        ): void {
            const testName = JSON.stringify(typeSegmentExpressions);
            test(testName, () => {
                const ri = new ResourceInfo([], typeSegmentExpressions);
                const typeName = ri.shortTypeExpression;
                assert.deepStrictEqual(typeName, expected);
            });
        }

        createShortTypeTest([], undefined);
        createShortTypeTest([`'a'`], `'a'`);
        createShortTypeTest([`'ms.abc'`], `'ms.abc'`);
        createShortTypeTest([`'ms.abc'`, `'def'`], `'def'`);
        createShortTypeTest([`'ms.abc'`, `'def'`, `'ghi'`], `'ghi'`);

        suite("expressions", () => {
            createShortTypeTest([`parameters('abc')`], `parameters('abc')`);
            createShortTypeTest([`parameters('abc')`, `'def'`], `'def'`);
            createShortTypeTest([`'abc'`, `parameters('def')`], `parameters('def')`);
            createShortTypeTest([`parameters('abc')`, `parameters('def')`], `parameters('def')`);
            createShortTypeTest([`parameters('abc')`, `'def'`, `parameters('ghi')`], `parameters('ghi')`);
        });

        suite("coalesce consecutive strings", () => {
            createShortTypeTest(
                [
                    `parameters('a')`, `'b'`, `'c'`, `'d'`, `parameters('e')`, `parameters('f')`, `'g'`, `'h'`
                ],
                `'h'`);
        });
    });

    suite("fullNameExpression", () => {
        function createFullNameTest(
            nameSegmentExpressions: string[],
            expected: string | undefined
        ): void {
            const testName = JSON.stringify(nameSegmentExpressions);
            test(testName, () => {
                const ri = new ResourceInfo(nameSegmentExpressions, []);
                const typeName = ri.getFullNameExpression();
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

    suite("shortNameExpression", () => {
        function createShortNameTest(
            nameSegmentExpressions: string[],
            expected: string | undefined
        ): void {
            const testName = JSON.stringify(nameSegmentExpressions);
            test(testName, () => {
                const ri = new ResourceInfo(nameSegmentExpressions, []);
                const typeName = ri.shortNameExpression;
                assert.deepStrictEqual(typeName, expected);
            });
        }

        createShortNameTest([], undefined);
        createShortNameTest([`'a'`], `'a'`);
        createShortNameTest([`'abc'`, `'def'`], `'def'`);
        createShortNameTest([`'abc'`, `'def'`, `'ghi'`], `'ghi'`);

        suite("expressions", () => {
            createShortNameTest([`parameters('abc')`], `parameters('abc')`);
            createShortNameTest([`parameters('abc')`, `'def'`], `'def'`);
            createShortNameTest([`'abc'`, `parameters('def')`], `parameters('def')`);
            createShortNameTest([`parameters('abc')`, `parameters('def')`], `parameters('def')`);
            createShortNameTest([`parameters('abc')`, `'def'`, `parameters('ghi')`], `parameters('ghi')`);
        });

        suite("coalesce consequence strings", () => {
            createShortNameTest(
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
                `'h'`);
        });
    });

    suite("IResource getFriendlyName", () => {
        function createFriendlyNameTest(
            resource: ResourceInfo,
            expectedWithShortResourceName: string | undefined,
            expectedWithFullResourceName: string | undefined
        ): void {
            const testName = JSON.stringify(`${resource.getFullTypeExpression()}: ${resource.getFullNameExpression()}`);
            test(`${testName} (short name)`, () => {
                const actualShort = resource.getFriendlyResourceLabel({});
                assert.deepStrictEqual(actualShort, expectedWithShortResourceName);
            });
            test(`${testName} (full name)`, () => {
                const actualFull = resource.getFriendlyResourceLabel({ fullName: true });
                assert.deepStrictEqual(actualFull, expectedWithFullResourceName);
            });
        }

        createFriendlyNameTest(
            // simple string name with parent
            new ResourceInfo(
                [`'parent name'`, `'my name'`],
                [`'Microsoft.AAD/domainServices'`]),
            `my name (domainServices)`,
            `parent name/my name (domainServices)`
        );

        // simple param/var name
        createFriendlyNameTest(
            new ResourceInfo(
                ["variables('b')"],
                [`'Microsoft.AAD/domainServices'`]),
            // tslint:disable-next-line: no-invalid-template-strings
            '${b} (domainServices)',
            // tslint:disable-next-line: no-invalid-template-strings
            '${b} (domainServices)');

        // interpolatable name
        createFriendlyNameTest(
            new ResourceInfo(
                ["'prefix'", "variables('b')"],
                [`'Microsoft.AAD/domainServices'`]),
            // tslint:disable-next-line: no-invalid-template-strings
            '${b} (domainServices)',
            // tslint:disable-next-line: no-invalid-template-strings
            'prefix/${b} (domainServices)');

        // name with expression
        createFriendlyNameTest(
            new ResourceInfo(
                ["add(add(1, 2), '/', variables('b'))"],
                [`'Microsoft.AAD/domainServices'`]),
            // tslint:disable-next-line: no-invalid-template-strings
            "[add(add(1, 2), '/', ${b})] (domainServices)",
            // tslint:disable-next-line: no-invalid-template-strings
            "[add(add(1, 2), '/', ${b})] (domainServices)");

        // simple type name with parent
        createFriendlyNameTest(
            new ResourceInfo(
                [`'my name'`],
                [`'Microsoft.AAD/domainServices/abc'`]),
            // tslint:disable-next-line: no-invalid-template-strings
            "my name (abc)",
            // tslint:disable-next-line: no-invalid-template-strings
            "my name (abc)"
        );

        // type name with simple var/param
        createFriendlyNameTest(
            new ResourceInfo(
                [`'my name'`],
                [`variables('typeName')`]),
            // tslint:disable-next-line: no-invalid-template-strings
            "my name (${typeName})",
            // tslint:disable-next-line: no-invalid-template-strings
            "my name (${typeName})"
        );

        // type name with expression
        createFriendlyNameTest(
            new ResourceInfo(
                [`'my name'`],
                [`add(1, variables('typeName'))`]),
            // tslint:disable-next-line: no-invalid-template-strings
            "my name ([add(1, ${typeName})])",
            // tslint:disable-next-line: no-invalid-template-strings
            "my name ([add(1, ${typeName})])");
    });

    suite("getResourceIdExpression", () => {
        function createResourceIdTest(
            testName: string,
            resource: ResourceInfo,
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

            const dt = parseTemplate(template);
            const infos = getResourcesInfo({ scope: dt.topLevelScope, recognizeDecoupledChildren: false });

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
