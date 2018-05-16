// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length

import * as assert from "assert";
import * as vscode from "vscode";
import * as Json from "../src/JSON";
import * as path from "path";

import { ext } from "../src/extensionVariables"
import { JsonOutlineProvider, IElementInfo, shortenTreeLabel } from "../src/Treeview";
import { Span } from "../src/Language";

suite("TreeView", async (): Promise<void> => {
    suite("shortenTreeLabel", async (): Promise<void> => {
        test("shortenTreeLabel", () => {
            function testShorten(label: string, expected: string) {
                let shortenedLabel = shortenTreeLabel(label);
                assert.equal(shortenedLabel, expected);
            }

            testShorten(undefined, undefined);
            testShorten(null, null);
            testShorten("", "");
            testShorten("a", "a");
            testShorten("[]", "[]");
            testShorten("[parameter('a')]", "[parameter('a')]");
            testShorten("[parameterss('a')]", "[parameterss('a')]");

            // params/vars
            testShorten("[parameters('a')]", "<a>");
            testShorten("[variables('a')]", "<a>");
            testShorten("[(variables('a')+variables('abc'))]", "(<a>+<abc>)");

            // concat
            testShorten("[concat(a)]", "a");
            testShorten("[concat(variables('a'),'b',variables('abc'))]", "<a>,'b',<abc>");

            // nested concat
            testShorten("[concat(concat(a))]", "a");
        });
    });

    suite("JsonOutlineProvider", async (): Promise<void> => {
        let provider: JsonOutlineProvider;

        setup(function (this: Mocha.IHookCallbackContext, done: MochaDone): void {
            this.timeout(15000);

            async function mySetup(): Promise<void> {
                let extension = vscode.extensions.getExtension(ext.extensionId);
                assert.equal(!!extension, true, "Extension not found");
                await extension.activate();
                provider = ext.jsonOutlineProvider;
                assert.equal(!!provider, true, "JSON outlin provider not found");
            }

            mySetup().then(done, () => { assert.fail("Setup failed"); });
        });

        async function testChildren(template: string, expected: ITestTreeItem[]): Promise<void> {
            let editor = await showNewTextDocument(template);
            let children = provider.getChildren(null);
            let testChildren = children.map(child => {
                let treeItem = provider.getTreeItem(child);
                return toTestTreeItem(treeItem);
            });

            assert.deepStrictEqual(testChildren, expected);
        }

        async function testTree(template: string, expected: ITestTreeItem[], selectProperties?: string[]): Promise<void> {
            let editor = await showNewTextDocument(template);
            let testChildren = getTree(null);

            function select(node: ITestTreeItem): Partial<ITestTreeItem> {
                if (selectProperties) {
                    let newNode: Partial<ITestTreeItem> = {};
                    for (let prop of selectProperties) {
                        newNode[prop] = node[prop];
                    }
                    return newNode;
                } else {
                    return node;
                }
            }

            let testChildrenSelected = treeMap(testChildren, select);
            assert.deepStrictEqual(testChildrenSelected, expected);
        }

        interface INode<T> {
            children?: INode<T>[];
        }

        function treeMap<T extends INode<T>, U extends INode<U>>(tree: T[], visit: (node: T) => U): INode<U>[] {
            let newTree = tree.map<INode<T>>(node => {
                let newNode = visit(node);
                if (node.children) {
                    newNode.children = treeMap(node.children, visit);
                }

                return newNode;
            });

            return newTree;
        }

        async function testLabels(template: string, expected: Partial<ITestTreeItem>[]): Promise<void> {
            await testTree(template, expected, ["label"]);
        }

        function getTree(element?: string): ITestTreeItem[] {
            let children = provider.getChildren(element);
            let testChildren = children.map(child => {
                let treeItem = provider.getTreeItem(child);
                let testItem = toTestTreeItem(treeItem);

                if (treeItem.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    // Get subchildren
                    let testGrandChilderen = getTree(child);
                    testItem.children = testGrandChilderen;
                }

                return testItem;
            });

            return testChildren;
        }

        /////////////////////////

        test("getChildren: Top level: all default param types", async () => {

            await testChildren(templateAllParamDefaultTypes, [
                {
                    label: "$schema: http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    collapsibleState: 0,
                    icon: "label.svg"
                }, {
                    label: "contentVersion: 1.0.0.0",
                    collapsibleState: 0,
                    icon: "label.svg"
                }, {
                    label: "a: 1",
                    collapsibleState: 0
                }, {
                    label: "parameters",
                    collapsibleState: 1,
                    icon: "parameters.svg"
                }, {
                    label: "variables",
                    collapsibleState: 1,
                    icon: "variables.svg"
                }, {
                    label: "resources",
                    collapsibleState: 1,
                    icon: "resources.svg"
                }
            ]);
        });

        /////////////////////////

        test("getLabel: displayName tag overrides name", async () => {

            await testLabels(`
                {
                    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [
                        {
                            "apiVersion": "2017-03-01",
                            "type": "Microsoft.Network/networkSecurityGroups",
                            "name": "SwarmNSG",
                            "location": "[resourceGroup().location]",
                            "tags": {
                                "any": "who there",
                                "displayName": "Swarm Display Name"
                            }
                        }
                    ]
                }`,
                [
                    {
                        label: "$schema: http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    },
                    {
                        label: "contentVersion: 1.0.0.0",
                    },
                    {
                        label: "resources",
                        children: [
                            {
                                label: "Swarm Display Name",
                                children: [
                                    {
                                        label: "apiVersion: 2017-03-01",
                                    },
                                    {
                                        label: "type: Microsoft.Network/networkSecurityGroups",
                                    },
                                    {
                                        label: "name: SwarmNSG",
                                    },
                                    {
                                        label: "location: [resourceGroup().location]",
                                    },
                                    {
                                        label: "tags",
                                        children: [
                                            {
                                                label: "any: who there",
                                            },
                                            {
                                                label: "displayName: Swarm Display Name",
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            );
        });

        /////////////////////////

        test("getChildren: Full tree: all default param types", async () => {
            await testTree(templateAllParamDefaultTypes,
                [
                    {
                        label: "$schema: http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                        collapsibleState: 0,
                        icon: "label.svg"
                    },
                    {
                        label: "contentVersion: 1.0.0.0",
                        collapsibleState: 0,
                        icon: "label.svg"
                    },
                    {
                        label: "a: 1",
                        collapsibleState: 0
                    },
                    {
                        label: "parameters",
                        collapsibleState: 1,
                        icon: "parameters.svg",
                        children: [
                            {
                                label: "int",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: int",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue: 1",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "string",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue: hi",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "array",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: array",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "object",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: object",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "hi: there",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "one: 1",
                                                collapsibleState: 0
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "bool",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: bool",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue: false",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "null",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: bool",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue: null",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "undefined",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue: undefined",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "securestring",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: securestring",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "secureObject",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: secureObject",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "hi: there",
                                                collapsibleState: 0
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "windowsOSVersion",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue: 2016-Datacenter-with-Containers",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "allowedValues",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "metadata",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "description: The Windows version for the VM. This will pick a fully patched image of this given Windows version. Allowed values: 2008-R2-SP1, 2012-Datacenter, 2012-R2-Datacenter.",
                                                collapsibleState: 0
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "hostVMprofile",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: object",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "defaultValue",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "hostvmSku",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "type: string",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "defaultValue: Standard_A1",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "metadata",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "description: Size of VMs in the VM Scale Set hosting docker swarm hosts.",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                label: "windowsOSVersion",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "type: string",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "defaultValue: 2016-Datacenter-with-Containers",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "allowedValues",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "metadata",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "description: The Windows version for the host VMs, please note that if you choose SAC version then you need to choose SemiAnnual for offer",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                label: "offer",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "type: string",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "defaultValue: WindowsServer",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "allowedValues",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "metadata",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "description: Choose WindowsServerSemiannual for SAC channel",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        label: "variables",
                        collapsibleState: 1,
                        icon: "variables.svg",
                        children: [
                            {
                                label: "swarmhostimageReference",
                                collapsibleState: 1,
                                icon: "variables.svg",
                                children: [
                                    {
                                        label: "publisher: MicrosoftWindowsServer",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "offer: [parameters('hostVMprofile').offer]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "sku: [parameters('hostVMprofile').windowsOSVersion]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "version: latest",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "namingInfix: [toLower(substring(concat(parameters('vmssName'), uniqueString(resourceGroup().id)), 0, 9))]",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            },
                            {
                                label: "addressPrefix: 10.0.0.0/16",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            }
                        ]
                    },
                    {
                        label: "resources",
                        collapsibleState: 1,
                        icon: "resources.svg",
                        children: [
                            {
                                label: "<virtualNetworkName>",
                                collapsibleState: 1,
                                icon: "virtualnetworks.svg",
                                children: [
                                    {
                                        label: "type: Microsoft.Network/virtualNetworks",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "name: [variables('virtualNetworkName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [resourceGroup().location]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2017-06-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "addressSpace",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "addressPrefixes",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            },
                                            {
                                                label: "subnets",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "<subnetName>",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "name: [variables('subnetName')]",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "properties",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "addressPrefix: [variables('subnetPrefix')]",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "networkSecurityGroup",
                                                                        collapsibleState: 1,
                                                                        children: [
                                                                            {
                                                                                label: "id: [resourceId('Microsoft.Network/networkSecurityGroups', 'SwarmNSG')]",
                                                                                collapsibleState: 0
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        label: "<appGwSubnetName>",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "name: [variables('appGwSubnetName')]",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "properties",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "addressPrefix: [variables('appGwSubnetPrefix')]",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "Swarm Display Name",
                                collapsibleState: 1,
                                icon: "nsg.svg",
                                children: [
                                    {
                                        label: "apiVersion: 2017-03-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Network/networkSecurityGroups",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "name: SwarmNSG",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [resourceGroup().location]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "tags",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "any: who there",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "displayName: Swarm Display Name",
                                                collapsibleState: 0
                                            }
                                        ]
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "securityRules",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "rdp-rule",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "name: rdp-rule",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "properties",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "description: Allow RDP",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "protocol: Tcp",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "sourcePortRange: *",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "destinationPortRange: 3389",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "sourceAddressPrefix: Internet",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "destinationAddressPrefix: *",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "access: Allow",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "priority: 100",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "direction: Inbound",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        label: "Docker-API",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "name: Docker-API",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "properties",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "description: Allow WEB",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "protocol: Tcp",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "sourcePortRange: *",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "destinationPortRange: 2376",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "sourceAddressPrefix: Internet",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "destinationAddressPrefix: *",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "access: Allow",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "priority: 101",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "direction: Inbound",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            )
        });

        /////////////////////////

        test("getChildren: Full tree: VN Gateway", async () => {
            const templateVNGateway: string = `
                {
                    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [
                        {
                            "apiVersion": "2017-06-01",
                            "name": "[parameters('name')]",
                            "type": "Microsoft.Network/virtualNetworkGateways",
                            "location": "[parameters('location')]",
                            "dependsOn": [
                                "Microsoft.Network/virtualNetworks/stephwevn1/subnets/GatewaySubnet",
                                "[concat('Microsoft.Network/publicIPAddresses/', parameters('newPublicIpAddressName'))]"
                            ],
                            "properties": {
                                "gatewayType": "[parameters('gatewayType')]",
                                "ipConfigurations": [
                                    {
                                        "name": "default",
                                        "properties": {
                                            "privateIPAllocationMethod": "Dynamic",
                                            "subnet": {
                                                "id": "[resourceId('deleteme', 'Microsoft.Network/virtualNetworks/subnets', parameters('existingVirtualNetworkName'), parameters('newSubnetName'))]"
                                            },
                                            "publicIpAddress": {
                                                "id": "[resourceId('deleteme', 'Microsoft.Network/publicIPAddresses', parameters('newPublicIpAddressName'))]"
                                            }
                                        }
                                    }
                                ],
                                "vpnType": "[parameters('vpnType')]",
                                "sku": {
                                    "name": "[parameters('sku')]",
                                    "tier": "[parameters('sku')]"
                                }
                            }
                        },
                        {
                            "apiVersion": "2017-08-01",
                            "type": "Microsoft.Network/virtualNetworks/subnets",
                            "name": "[concat(parameters('existingVirtualNetworkName'), '/', parameters('newSubnetName'))]",
                            "location": "[parameters('location')]",
                            "properties": {
                                "addressPrefix": "[parameters('subnetAddressPrefix')]"
                            }
                        },
                        {
                            "apiVersion": "2017-08-01",
                            "type": "Microsoft.Network/publicIPAddresses",
                            "name": "[parameters('newPublicIpAddressName')]",
                            "location": "[parameters('location')]",
                            "properties": {
                                "publicIPAllocationMethod": "Dynamic"
                            }
                        }
                    ]
                }
                `;

            await testTree(templateVNGateway,
                [
                    {
                        label: "$schema: http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                        collapsibleState: 0,
                        icon: "label.svg"
                    },
                    {
                        label: "contentVersion: 1.0.0.0",
                        collapsibleState: 0,
                        icon: "label.svg"
                    },
                    {
                        label: "resources",
                        collapsibleState: 1,
                        icon: "resources.svg",
                        children: [
                            {
                                label: "<name>",
                                collapsibleState: 1,
                                icon: "resources.svg",
                                children: [
                                    {
                                        label: "apiVersion: 2017-06-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "name: [parameters('name')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Network/virtualNetworkGateways",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "dependsOn",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "gatewayType: [parameters('gatewayType')]",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "ipConfigurations",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "default",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "name: default",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "properties",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "privateIPAllocationMethod: Dynamic",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "subnet",
                                                                        collapsibleState: 1,
                                                                        children: [
                                                                            {
                                                                                label: "id: [resourceId('deleteme', 'Microsoft.Network/virtualNetworks/subnets', parameters('existingVirtualNetworkName'), parameters('newSubnetName'))]",
                                                                                collapsibleState: 0
                                                                            }
                                                                        ]
                                                                    },
                                                                    {
                                                                        label: "publicIpAddress",
                                                                        collapsibleState: 1,
                                                                        children: [
                                                                            {
                                                                                label: "id: [resourceId('deleteme', 'Microsoft.Network/publicIPAddresses', parameters('newPublicIpAddressName'))]",
                                                                                collapsibleState: 0
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                label: "vpnType: [parameters('vpnType')]",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "sku",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "name: [parameters('sku')]",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "tier: [parameters('sku')]",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "<existingVirtualNetworkName>, '/', <newSubnetName>",
                                collapsibleState: 1,
                                icon: "resources.svg",
                                children: [
                                    {
                                        label: "apiVersion: 2017-08-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Network/virtualNetworks/subnets",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "name: [concat(parameters('existingVirtualNetworkName'), '/', parameters('newSubnetName'))]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "addressPrefix: [parameters('subnetAddressPrefix')]",
                                                collapsibleState: 0
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "<newPublicIpAddressName>",
                                collapsibleState: 1,
                                icon: "publicip.svg",
                                children: [
                                    {
                                        label: "apiVersion: 2017-08-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Network/publicIPAddresses",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "name: [parameters('newPublicIpAddressName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "publicIPAllocationMethod: Dynamic",
                                                collapsibleState: 0
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            );
        });

        /////////////////////////

        test("getChildren: Full tree: New VM", async () => {
            const templateNewVM: string = `
                {
                    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "location": {
                            "type": "string"
                        },
                        "virtualMachineName": {
                            "type": "string"
                        },
                        "virtualMachineSize": {
                            "type": "string"
                        },
                        "adminUsername": {
                            "type": "string"
                        },
                        "virtualNetworkName": {
                            "type": "string"
                        },
                        "networkInterfaceName": {
                            "type": "string"
                        },
                        "backupVaultName": {
                            "type": "string"
                        },
                        "backupFabricName": {
                            "type": "string"
                        },
                        "backupVaultRGName": {
                            "type": "string"
                        },
                        "backupVaultRGIsNew": {
                            "type": "bool"
                        },
                        "backupPolicyName": {
                            "type": "string"
                        },
                        "backupPolicySchedule": {
                            "type": "object"
                        },
                        "backupPolicyRetention": {
                            "type": "object"
                        },
                        "backupPolicyTimeZone": {
                            "type": "string"
                        },
                        "backupContainerName": {
                            "type": "string"
                        },
                        "backupItemName": {
                            "type": "string"
                        },
                        "networkSecurityGroupName": {
                            "type": "string"
                        },
                        "adminPassword": {
                            "type": "securestring"
                        },
                        "availabilitySetName": {
                            "type": "string"
                        },
                        "availabilitySetPlatformFaultDomainCount": {
                            "type": "string"
                        },
                        "availabilitySetPlatformUpdateDomainCount": {
                            "type": "string"
                        },
                        "diagnosticsStorageAccountName": {
                            "type": "string"
                        },
                        "diagnosticsStorageAccountId": {
                            "type": "string"
                        },
                        "diagnosticsStorageAccountType": {
                            "type": "string"
                        },
                        "addressPrefix": {
                            "type": "string"
                        },
                        "subnetName": {
                            "type": "string"
                        },
                        "subnetPrefix": {
                            "type": "string"
                        },
                        "publicIpAddressName": {
                            "type": "string"
                        },
                        "publicIpAddressType": {
                            "type": "string"
                        },
                        "publicIpAddressSku": {
                            "type": "string"
                        },
                        "autoShutdownStatus": {
                            "type": "string"
                        },
                        "autoShutdownTime": {
                            "type": "string"
                        },
                        "autoShutdownTimeZone": {
                            "type": "string"
                        },
                        "autoShutdownNotificationStatus": {
                            "type": "string"
                        }
                    },
                    "variables": {
                        "vnetId": "[resourceId('newresourcegroup','Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
                        "subnetRef": "[concat(variables('vnetId'), '/subnets/', parameters('subnetName'))]",
                        "metricsresourceid": "[concat('/subscriptions/', subscription().subscriptionId, '/resourceGroups/', resourceGroup().name, '/providers/', 'Microsoft.Compute/virtualMachines/', parameters('virtualMachineName'))]",
                        "metricsclosing": "[concat('<Metrics resourceId=\"', variables('metricsresourceid'), '\"><MetricAggregation scheduledTransferPeriod=\"PT1H\"/><MetricAggregation scheduledTransferPeriod=\"PT1M\"/></Metrics></DiagnosticMonitorConfiguration></WadCfg>')]",
                        "metricscounters": "<PerformanceCounters scheduledTransferPeriod=\"PT1M\"><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\AvailableMemory\" sampleRate=\"PT15S\" unit=\"Bytes\"><annotation displayName=\"Memory available\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\PercentAvailableMemory\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"Mem. percent available\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\UsedMemory\" sampleRate=\"PT15S\" unit=\"Bytes\"><annotation displayName=\"Memory used\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\PercentUsedMemory\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"Memory percentage\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\PercentUsedByCache\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"Mem. used by cache\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\PagesPerSec\" sampleRate=\"PT15S\" unit=\"CountPerSecond\"><annotation displayName=\"Pages\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\PagesReadPerSec\" sampleRate=\"PT15S\" unit=\"CountPerSecond\"><annotation displayName=\"Page reads\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\PagesWrittenPerSec\" sampleRate=\"PT15S\" unit=\"CountPerSecond\"><annotation displayName=\"Page writes\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\AvailableSwap\" sampleRate=\"PT15S\" unit=\"Bytes\"><annotation displayName=\"Swap available\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\PercentAvailableSwap\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"Swap percent available\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\UsedSwap\" sampleRate=\"PT15S\" unit=\"Bytes\"><annotation displayName=\"Swap used\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Memory\\PercentUsedSwap\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"Swap percent used\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Processor\\PercentIdleTime\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"CPU idle time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Processor\\PercentUserTime\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"CPU user time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Processor\\PercentNiceTime\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"CPU nice time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Processor\\PercentPrivilegedTime\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"CPU privileged time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Processor\\PercentInterruptTime\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"CPU interrupt time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Processor\\PercentDPCTime\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"CPU DPC time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Processor\\PercentProcessorTime\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"CPU percentage guest OS\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\Processor\\PercentIOWaitTime\" sampleRate=\"PT15S\" unit=\"Percent\"><annotation displayName=\"CPU IO wait time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\BytesPerSecond\" sampleRate=\"PT15S\" unit=\"BytesPerSecond\"><annotation displayName=\"Disk total bytes\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\ReadBytesPerSecond\" sampleRate=\"PT15S\" unit=\"BytesPerSecond\"><annotation displayName=\"Disk read guest OS\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\WriteBytesPerSecond\" sampleRate=\"PT15S\" unit=\"BytesPerSecond\"><annotation displayName=\"Disk write guest OS\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\TransfersPerSecond\" sampleRate=\"PT15S\" unit=\"CountPerSecond\"><annotation displayName=\"Disk transfers\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\ReadsPerSecond\" sampleRate=\"PT15S\" unit=\"CountPerSecond\"><annotation displayName=\"Disk reads\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\WritesPerSecond\" sampleRate=\"PT15S\" unit=\"CountPerSecond\"><annotation displayName=\"Disk writes\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\AverageReadTime\" sampleRate=\"PT15S\" unit=\"Seconds\"><annotation displayName=\"Disk read time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\AverageWriteTime\" sampleRate=\"PT15S\" unit=\"Seconds\"><annotation displayName=\"Disk write time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\AverageTransferTime\" sampleRate=\"PT15S\" unit=\"Seconds\"><annotation displayName=\"Disk transfer time\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\PhysicalDisk\\AverageDiskQueueLength\" sampleRate=\"PT15S\" unit=\"Count\"><annotation displayName=\"Disk queue length\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\NetworkInterface\\BytesTransmitted\" sampleRate=\"PT15S\" unit=\"Bytes\"><annotation displayName=\"Network out guest OS\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\NetworkInterface\\BytesReceived\" sampleRate=\"PT15S\" unit=\"Bytes\"><annotation displayName=\"Network in guest OS\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\NetworkInterface\\PacketsTransmitted\" sampleRate=\"PT15S\" unit=\"Count\"><annotation displayName=\"Packets sent\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\NetworkInterface\\PacketsReceived\" sampleRate=\"PT15S\" unit=\"Count\"><annotation displayName=\"Packets received\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\NetworkInterface\\BytesTotal\" sampleRate=\"PT15S\" unit=\"Bytes\"><annotation displayName=\"Network total bytes\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\NetworkInterface\\TotalRxErrors\" sampleRate=\"PT15S\" unit=\"Count\"><annotation displayName=\"Packets received errors\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\NetworkInterface\\TotalTxErrors\" sampleRate=\"PT15S\" unit=\"Count\"><annotation displayName=\"Packets sent errors\" locale=\"en-us\"/></PerformanceCounterConfiguration><PerformanceCounterConfiguration counterSpecifier=\"\\NetworkInterface\\TotalCollisions\" sampleRate=\"PT15S\" unit=\"Count\"><annotation displayName=\"Network collisions\" locale=\"en-us\"/></PerformanceCounterConfiguration></PerformanceCounters>",
                        "metricsstart": "<WadCfg><DiagnosticMonitorConfiguration overallQuotaInMB=\"4096\"><DiagnosticInfrastructureLogs scheduledTransferPeriod=\"PT1M\" scheduledTransferLogLevelFilter=\"Warning\"/>",
                        "wadcfgx": "[concat(variables('metricsstart'), variables('metricscounters'), variables('metricsclosing'))]",
                        "diagnosticsExtensionName": "Microsoft.Insights.VMDiagnosticsSettings"
                    },
                    "resources": [
                        {
                            "name": "[parameters('virtualMachineName')]",
                            "type": "Microsoft.Compute/virtualMachines",
                            "apiVersion": "2016-04-30-preview",
                            "location": "[parameters('location')]",
                            "dependsOn": [
                                "[concat('Microsoft.Network/networkInterfaces/', parameters('networkInterfaceName'))]",
                                "[concat('Microsoft.Compute/availabilitySets/', parameters('availabilitySetName'))]",
                                "[concat('Microsoft.Storage/storageAccounts/', parameters('diagnosticsStorageAccountName'))]"
                            ],
                            "properties": {
                                "osProfile": {
                                    "computerName": "[parameters('virtualMachineName')]",
                                    "adminUsername": "[parameters('adminUsername')]",
                                    "adminPassword": "[parameters('adminPassword')]"
                                },
                                "hardwareProfile": {
                                    "vmSize": "[parameters('virtualMachineSize')]"
                                },
                                "storageProfile": {
                                    "imageReference": {
                                        "publisher": "RedHat",
                                        "offer": "RHEL",
                                        "sku": "7-RAW",
                                        "version": "latest"
                                    },
                                    "osDisk": {
                                        "createOption": "fromImage",
                                        "managedDisk": {
                                            "storageAccountType": "Premium_LRS"
                                        }
                                    },
                                    "dataDisks": []
                                },
                                "networkProfile": {
                                    "networkInterfaces": [
                                        {
                                            "id": "[resourceId('Microsoft.Network/networkInterfaces', parameters('networkInterfaceName'))]"
                                        }
                                    ]
                                },
                                "diagnosticsProfile": {
                                    "bootDiagnostics": {
                                        "enabled": true,
                                        "storageUri": "[reference(resourceId('newresourcegroup', 'Microsoft.Storage/storageAccounts', parameters('diagnosticsStorageAccountName')), '2015-06-15').primaryEndpoints['blob']]"
                                    }
                                },
                                "availabilitySet": {
                                    "id": "[resourceId('Microsoft.Compute/availabilitySets', parameters('availabilitySetName'))]"
                                }
                            }
                        },
                        {
                            "name": "[concat(parameters('virtualMachineName'),'/', variables('diagnosticsExtensionName'))]",
                            "type": "Microsoft.Compute/virtualMachines/extensions",
                            "apiVersion": "2017-03-30",
                            "location": "[parameters('location')]",
                            "dependsOn": [
                                "[concat('Microsoft.Compute/virtualMachines/', parameters('virtualMachineName'))]"
                            ],
                            "properties": {
                                "publisher": "Microsoft.OSTCExtensions",
                                "type": "LinuxDiagnostic",
                                "typeHandlerVersion": "2.3",
                                "autoUpgradeMinorVersion": true,
                                "settings": {
                                    "StorageAccount": "[parameters('diagnosticsStorageAccountName')]",
                                    "xmlCfg": "[base64(variables('wadcfgx'))]"
                                },
                                "protectedSettings": {
                                    "storageAccountName": "[parameters('diagnosticsStorageAccountName')]",
                                    "storageAccountKey": "[listKeys(parameters('diagnosticsStorageAccountId'),'2015-06-15').key1]",
                                    "storageAccountEndPoint": "https://core.windows.net/"
                                }
                            }
                        },
                        {
                            "name": "Acronis.acronis-backup-lin-20180305162104",
                            "apiVersion": "2015-01-01",
                            "type": "Microsoft.Resources/deployments",
                            "properties": {
                                "mode": "incremental",
                                "templateLink": {
                                    "uri": "https://gallery.azure.com/artifact/20161101/Acronis.acronis-backup-lin-arm.0.0.36/Artifacts/MainTemplate.json"
                                },
                                "parameters": {
                                    "vmName": {
                                        "value": "samplevm"
                                    },
                                    "location": {
                                        "value": "westus"
                                    },
                                    "absURL": {
                                        "value": "https://cloud.acronis.com"
                                    },
                                    "userLogin": {
                                        "value": "MyLogin"
                                    },
                                    "userPassword": {
                                        "value": "MyPassword!"
                                    }
                                }
                            },
                            "dependsOn": [
                                "[concat('Microsoft.Compute/virtualMachines/',parameters('virtualMachineName'),'/extensions/', variables('diagnosticsExtensionName'))]"
                            ]
                        },
                        {
                            "name": "[parameters('availabilitySetName')]",
                            "type": "Microsoft.Compute/availabilitySets",
                            "apiVersion": "2016-04-30-preview",
                            "location": "[parameters('location')]",
                            "properties": {
                                "platformFaultDomainCount": "[parameters('availabilitySetPlatformFaultDomainCount')]",
                                "platformUpdateDomainCount": "[parameters('availabilitySetPlatformUpdateDomainCount')]",
                                "managed": true
                            }
                        },
                        {
                            "name": "[concat('shutdown-computevm-', parameters('virtualMachineName'))]",
                            "type": "Microsoft.DevTestLab/schedules",
                            "apiVersion": "2017-04-26-preview",
                            "location": "[parameters('location')]",
                            "properties": {
                                "status": "[parameters('autoShutdownStatus')]",
                                "taskType": "ComputeVmShutdownTask",
                                "dailyRecurrence": {
                                    "time": "[parameters('autoShutdownTime')]"
                                },
                                "timeZoneId": "[parameters('autoShutdownTimeZone')]",
                                "targetResourceId": "[resourceId('Microsoft.Compute/virtualMachines', parameters('virtualMachineName'))]",
                                "notificationSettings": {
                                    "status": "[parameters('autoShutdownNotificationStatus')]",
                                    "timeInMinutes": "30"
                                }
                            },
                            "dependsOn": [
                                "[concat('Microsoft.Compute/virtualMachines/', parameters('virtualMachineName'))]"
                            ]
                        },
                        {
                            "name": "[parameters('diagnosticsStorageAccountName')]",
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "2015-06-15",
                            "location": "[parameters('location')]",
                            "properties": {
                                "accountType": "[parameters('diagnosticsStorageAccountType')]"
                            }
                        },
                        {
                            "apiVersion": "2017-05-10",
                            "name": "[concat('BackupVaultPolicy', '-', parameters('backupVaultName'), '-', parameters('backupPolicyName'))]",
                            "type": "Microsoft.Resources/deployments",
                            "resourceGroup": "[parameters('backupVaultRGName')]",
                            "properties": {
                                "mode": "Incremental",
                                "template": {
                                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                                    "contentVersion": "1.0.0.0",
                                    "resources": [
                                        {
                                            "name": "[parameters('backupVaultName')]",
                                            "type": "Microsoft.RecoveryServices/vaults",
                                            "apiVersion": "2016-06-01",
                                            "location": "[parameters('location')]",
                                            "sku": {
                                                "name": "RS0",
                                                "tier": "Standard"
                                            },
                                            "properties": {},
                                            "dependsOn": []
                                        },
                                        {
                                            "name": "[concat(parameters('backupVaultName'), '/', parameters('backupPolicyName'))]",
                                            "apiVersion": "2017-07-01",
                                            "type": "Microsoft.RecoveryServices/vaults/backupPolicies",
                                            "properties": {
                                                "backupManagementType": "AzureIaasVM",
                                                "schedulePolicy": "[parameters('backupPolicySchedule')]",
                                                "retentionPolicy": "[parameters('backupPolicyRetention')]",
                                                "timeZone": "[parameters('backupPolicyTimeZone')]"
                                            },
                                            "dependsOn": [
                                                "[resourceId(parameters('backupVaultRGName'), 'Microsoft.RecoveryServices/vaults', parameters('backupVaultName'))]"
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "apiVersion": "2017-05-10",
                            "name": "[concat(parameters('virtualMachineName'), '-' , 'BackupIntent')]",
                            "type": "Microsoft.Resources/deployments",
                            "resourceGroup": "[parameters('backupVaultRGName')]",
                            "properties": {
                                "mode": "Incremental",
                                "template": {
                                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                                    "contentVersion": "1.0.0.0",
                                    "resources": [
                                        {
                                            "name": "[concat(parameters('backupVaultName'), '/', parameters('backupFabricName'), '/', parameters('backupItemName'))]",
                                            "apiVersion": "2017-07-01",
                                            "type": "Microsoft.RecoveryServices/vaults/backupFabrics/backupProtectionIntent",
                                            "properties": {
                                                "friendlyName": "[concat(parameters('virtualMachineName'), 'BackupIntent')]",
                                                "protectionIntentItemType": "AzureResourceItem",
                                                "policyId": "[resourceId(parameters('backupVaultRGName'), 'Microsoft.RecoveryServices/vaults/backupPolicies', parameters('backupVaultName'), parameters('backupPolicyName'))]",
                                                "sourceResourceId": "[resourceId('newresourcegroup', 'Microsoft.Compute/virtualMachines', parameters('virtualMachineName'))]"
                                            }
                                        }
                                    ]
                                }
                            },
                            "dependsOn": [
                                "[resourceId('newresourcegroup', 'Microsoft.Compute/virtualMachines', parameters('virtualMachineName'))]",
                                "[concat('Microsoft.Resources/deployments', '/', 'BackupVaultPolicy', '-', parameters('backupVaultName'), '-', parameters('backupPolicyName'))]"
                            ]
                        },
                        {
                            "name": "[parameters('virtualNetworkName')]",
                            "type": "Microsoft.Network/virtualNetworks",
                            "apiVersion": "2017-08-01",
                            "location": "[parameters('location')]",
                            "properties": {
                                "addressSpace": {
                                    "addressPrefixes": [
                                        "[parameters('addressPrefix')]"
                                    ]
                                },
                                "subnets": [
                                    {
                                        "name": "[parameters('subnetName')]",
                                        "properties": {
                                            "addressPrefix": "[parameters('subnetPrefix')]"
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            "name": "[parameters('networkInterfaceName')]",
                            "type": "Microsoft.Network/networkInterfaces",
                            "apiVersion": "2016-09-01",
                            "location": "[parameters('location')]",
                            "dependsOn": [
                                "[concat('Microsoft.Network/virtualNetworks/', parameters('virtualNetworkName'))]",
                                "[concat('Microsoft.Network/publicIpAddresses/', parameters('publicIpAddressName'))]",
                                "[concat('Microsoft.Network/networkSecurityGroups/', parameters('networkSecurityGroupName'))]"
                            ],
                            "properties": {
                                "ipConfigurations": [
                                    {
                                        "name": "ipconfig1",
                                        "properties": {
                                            "subnet": {
                                                "id": "[variables('subnetRef')]"
                                            },
                                            "privateIPAllocationMethod": "Dynamic",
                                            "publicIpAddress": {
                                                "id": "[resourceId('newresourcegroup','Microsoft.Network/publicIpAddresses', parameters('publicIpAddressName'))]"
                                            }
                                        }
                                    }
                                ],
                                "networkSecurityGroup": {
                                    "id": "[resourceId('newresourcegroup', 'Microsoft.Network/networkSecurityGroups', parameters('networkSecurityGroupName'))]"
                                }
                            }
                        },
                        {
                            "name": "[parameters('publicIpAddressName')]",
                            "type": "Microsoft.Network/publicIpAddresses",
                            "apiVersion": "2017-08-01",
                            "location": "[parameters('location')]",
                            "properties": {
                                "publicIpAllocationMethod": "[parameters('publicIpAddressType')]"
                            },
                            "sku": {
                                "name": "[parameters('publicIpAddressSku')]"
                            }
                        },
                        {
                            "name": "[parameters('networkSecurityGroupName')]",
                            "type": "Microsoft.Network/networkSecurityGroups",
                            "apiVersion": "2017-06-01",
                            "location": "[parameters('location')]",
                            "properties": {
                                "securityRules": [
                                    {
                                        "name": "default-allow-ssh",
                                        "properties": {
                                            "priority": 1000,
                                            "protocol": "TCP",
                                            "access": "Allow",
                                            "direction": "Inbound",
                                            "sourceAddressPrefix": "*",
                                            "sourcePortRange": "*",
                                            "destinationAddressPrefix": "*",
                                            "destinationPortRange": "22"
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    "outputs": {
                        "adminUsername": {
                            "type": "string",
                            "value": "[parameters('adminUsername')]"
                        }
                    }
                }                        `;

            await testTree(templateNewVM,
                [
                    {
                        label: "$schema: http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                        collapsibleState: 0,
                        icon: "label.svg"
                    },
                    {
                        label: "contentVersion: 1.0.0.0",
                        collapsibleState: 0,
                        icon: "label.svg"
                    },
                    {
                        label: "parameters",
                        collapsibleState: 1,
                        icon: "parameters.svg",
                        children: [
                            {
                                label: "location",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "virtualMachineName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "virtualMachineSize",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "adminUsername",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "virtualNetworkName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "networkInterfaceName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupVaultName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupFabricName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupVaultRGName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupVaultRGIsNew",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: bool",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupPolicyName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupPolicySchedule",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: object",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupPolicyRetention",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: object",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupPolicyTimeZone",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupContainerName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "backupItemName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "networkSecurityGroupName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "adminPassword",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: securestring",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "availabilitySetName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "availabilitySetPlatformFaultDomainCount",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "availabilitySetPlatformUpdateDomainCount",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "diagnosticsStorageAccountName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "diagnosticsStorageAccountId",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "diagnosticsStorageAccountType",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "addressPrefix",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "subnetName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "subnetPrefix",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "publicIpAddressName",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "publicIpAddressType",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "publicIpAddressSku",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "autoShutdownStatus",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "autoShutdownTime",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "autoShutdownTimeZone",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "autoShutdownNotificationStatus",
                                collapsibleState: 1,
                                icon: "parameters.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        label: "variables",
                        collapsibleState: 1,
                        icon: "variables.svg",
                        children: [
                            {
                                label: "vnetId: [resourceId('newresourcegroup','Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            },
                            {
                                label: "subnetRef: [concat(variables('vnetId'), '/subnets/', parameters('subnetName'))]",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            },
                            {
                                label: "metricsresourceid: [concat('/subscriptions/', subscription().subscriptionId, '/resourceGroups/', resourceGroup().name, '/providers/', 'Microsoft.Compute/virtualMachines/', parameters('virtualMachineName'))]",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            },
                            {
                                label: "metricsclosing: [concat('<Metrics resourceId=",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            },
                            {
                                label: "metricscounters: <PerformanceCounters scheduledTransferPeriod=",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            },
                            {
                                label: "metricsstart: <WadCfg><DiagnosticMonitorConfiguration overallQuotaInMB=",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            },
                            {
                                label: "wadcfgx: [concat(variables('metricsstart'), variables('metricscounters'), variables('metricsclosing'))]",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            },
                            {
                                label: "diagnosticsExtensionName: Microsoft.Insights.VMDiagnosticsSettings",
                                collapsibleState: 0,
                                icon: "variables.svg"
                            }
                        ]
                    },
                    {
                        label: "resources",
                        collapsibleState: 1,
                        icon: "resources.svg",
                        children: [
                            {
                                label: "<virtualMachineName>",
                                collapsibleState: 1,
                                icon: "virtualmachines.svg",
                                children: [
                                    {
                                        label: "name: [parameters('virtualMachineName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Compute/virtualMachines",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2016-04-30-preview",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "dependsOn",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "osProfile",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "computerName: [parameters('virtualMachineName')]",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "adminUsername: [parameters('adminUsername')]",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "adminPassword: [parameters('adminPassword')]",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            },
                                            {
                                                label: "hardwareProfile",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "vmSize: [parameters('virtualMachineSize')]",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            },
                                            {
                                                label: "storageProfile",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "imageReference",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "publisher: RedHat",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "offer: RHEL",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "sku: 7-RAW",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "version: latest",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        label: "osDisk",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "createOption: fromImage",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "managedDisk",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "storageAccountType: Premium_LRS",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        label: "dataDisks",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            },
                                            {
                                                label: "networkProfile",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "networkInterfaces",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "{...}",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "id: [resourceId('Microsoft.Network/networkInterfaces', parameters('networkInterfaceName'))]",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                label: "diagnosticsProfile",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "bootDiagnostics",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "enabled: true",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "storageUri: [reference(resourceId('newresourcegroup', 'Microsoft.Storage/storageAccounts', parameters('diagnosticsStorageAccountName')), '2015-06-15').primaryEndpoints['blob']]",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                label: "availabilitySet",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "id: [resourceId('Microsoft.Compute/availabilitySets', parameters('availabilitySetName'))]",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "<virtualMachineName>,'/', <diagnosticsExtensionName>",
                                collapsibleState: 1,
                                icon: "extensions.svg",
                                children: [
                                    {
                                        label: "name: [concat(parameters('virtualMachineName'),'/', variables('diagnosticsExtensionName'))]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Compute/virtualMachines/extensions",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2017-03-30",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "dependsOn",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "publisher: Microsoft.OSTCExtensions",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "type: LinuxDiagnostic",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "typeHandlerVersion: 2.3",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "autoUpgradeMinorVersion: true",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "settings",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "StorageAccount: [parameters('diagnosticsStorageAccountName')]",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "xmlCfg: [base64(variables('wadcfgx'))]",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            },
                                            {
                                                label: "protectedSettings",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "storageAccountName: [parameters('diagnosticsStorageAccountName')]",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "storageAccountKey: [listKeys(parameters('diagnosticsStorageAccountId'),'2015-06-15').key1]",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "storageAccountEndPoint: https://core.windows.net/",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "Acronis.acronis-backup-lin-20180305162104",
                                collapsibleState: 1,
                                icon: "resources.svg",
                                children: [
                                    {
                                        label: "name: Acronis.acronis-backup-lin-20180305162104",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2015-01-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Resources/deployments",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "mode: incremental",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "templateLink",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "uri: https://gallery.azure.com/artifact/20161101/Acronis.acronis-backup-lin-arm.0.0.36/Artifacts/MainTemplate.json",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            },
                                            {
                                                label: "parameters",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "vmName",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "value: samplevm",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        label: "location",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "value: westus",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        label: "absURL",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "value: https://cloud.acronis.com",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        label: "userLogin",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "value: MyLogin",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    },
                                                    {
                                                        label: "userPassword",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "value: MyPassword!",
                                                                collapsibleState: 0
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    {
                                        label: "dependsOn",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "<availabilitySetName>",
                                collapsibleState: 1,
                                icon: "resources.svg",
                                children: [
                                    {
                                        label: "name: [parameters('availabilitySetName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Compute/availabilitySets",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2016-04-30-preview",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "platformFaultDomainCount: [parameters('availabilitySetPlatformFaultDomainCount')]",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "platformUpdateDomainCount: [parameters('availabilitySetPlatformUpdateDomainCount')]",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "managed: true",
                                                collapsibleState: 0
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "'shutdown-computevm-', <virtualMachineName>",
                                collapsibleState: 1,
                                icon: "resources.svg",
                                children: [
                                    {
                                        label: "name: [concat('shutdown-computevm-', parameters('virtualMachineName'))]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.DevTestLab/schedules",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2017-04-26-preview",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "status: [parameters('autoShutdownStatus')]",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "taskType: ComputeVmShutdownTask",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "dailyRecurrence",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "time: [parameters('autoShutdownTime')]",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            },
                                            {
                                                label: "timeZoneId: [parameters('autoShutdownTimeZone')]",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "targetResourceId: [resourceId('Microsoft.Compute/virtualMachines', parameters('virtualMachineName'))]",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "notificationSettings",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "status: [parameters('autoShutdownNotificationStatus')]",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "timeInMinutes: 30",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    {
                                        label: "dependsOn",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "<diagnosticsStorageAccountName>",
                                collapsibleState: 1,
                                icon: "storageaccounts.svg",
                                children: [
                                    {
                                        label: "name: [parameters('diagnosticsStorageAccountName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Storage/storageAccounts",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2015-06-15",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "accountType: [parameters('diagnosticsStorageAccountType')]",
                                                collapsibleState: 0
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "'BackupVaultPolicy', '-', <backupVaultName>, '-', <backupPolicyName>",
                                collapsibleState: 1,
                                icon: "resources.svg",
                                children: [
                                    {
                                        label: "apiVersion: 2017-05-10",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "name: [concat('BackupVaultPolicy', '-', parameters('backupVaultName'), '-', parameters('backupPolicyName'))]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Resources/deployments",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "resourceGroup: [parameters('backupVaultRGName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "mode: Incremental",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "template",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "$schema: https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "contentVersion: 1.0.0.0",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "resources",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "<backupVaultName>",
                                                                collapsibleState: 1,
                                                                icon: "resources.svg",
                                                                children: [
                                                                    {
                                                                        label: "name: [parameters('backupVaultName')]",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "type: Microsoft.RecoveryServices/vaults",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "apiVersion: 2016-06-01",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "location: [parameters('location')]",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "sku",
                                                                        collapsibleState: 1,
                                                                        children: [
                                                                            {
                                                                                label: "name: RS0",
                                                                                collapsibleState: 0
                                                                            },
                                                                            {
                                                                                label: "tier: Standard",
                                                                                collapsibleState: 0
                                                                            }
                                                                        ]
                                                                    },
                                                                    {
                                                                        label: "properties",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "dependsOn",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            },
                                                            {
                                                                label: "<backupVaultName>, '/', <backupPolicyName>",
                                                                collapsibleState: 1,
                                                                icon: "resources.svg",
                                                                children: [
                                                                    {
                                                                        label: "name: [concat(parameters('backupVaultName'), '/', parameters('backupPolicyName'))]",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "apiVersion: 2017-07-01",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "type: Microsoft.RecoveryServices/vaults/backupPolicies",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "properties",
                                                                        collapsibleState: 1,
                                                                        children: [
                                                                            {
                                                                                label: "backupManagementType: AzureIaasVM",
                                                                                collapsibleState: 0
                                                                            },
                                                                            {
                                                                                label: "schedulePolicy: [parameters('backupPolicySchedule')]",
                                                                                collapsibleState: 0
                                                                            },
                                                                            {
                                                                                label: "retentionPolicy: [parameters('backupPolicyRetention')]",
                                                                                collapsibleState: 0
                                                                            },
                                                                            {
                                                                                label: "timeZone: [parameters('backupPolicyTimeZone')]",
                                                                                collapsibleState: 0
                                                                            }
                                                                        ]
                                                                    },
                                                                    {
                                                                        label: "dependsOn",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "<virtualMachineName>, '-' , 'BackupIntent'",
                                collapsibleState: 1,
                                icon: "resources.svg",
                                children: [
                                    {
                                        label: "apiVersion: 2017-05-10",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "name: [concat(parameters('virtualMachineName'), '-' , 'BackupIntent')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Resources/deployments",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "resourceGroup: [parameters('backupVaultRGName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "mode: Incremental",
                                                collapsibleState: 0
                                            },
                                            {
                                                label: "template",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "$schema: https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "contentVersion: 1.0.0.0",
                                                        collapsibleState: 0
                                                    },
                                                    {
                                                        label: "resources",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "<backupVaultName>, '/', <backupFabricName>, '/', <backupItemName>",
                                                                collapsibleState: 1,
                                                                icon: "resources.svg",
                                                                children: [
                                                                    {
                                                                        label: "name: [concat(parameters('backupVaultName'), '/', parameters('backupFabricName'), '/', parameters('backupItemName'))]",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "apiVersion: 2017-07-01",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "type: Microsoft.RecoveryServices/vaults/backupFabrics/backupProtectionIntent",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "properties",
                                                                        collapsibleState: 1,
                                                                        children: [
                                                                            {
                                                                                label: "friendlyName: [concat(parameters('virtualMachineName'), 'BackupIntent')]",
                                                                                collapsibleState: 0
                                                                            },
                                                                            {
                                                                                label: "protectionIntentItemType: AzureResourceItem",
                                                                                collapsibleState: 0
                                                                            },
                                                                            {
                                                                                label: "policyId: [resourceId(parameters('backupVaultRGName'), 'Microsoft.RecoveryServices/vaults/backupPolicies', parameters('backupVaultName'), parameters('backupPolicyName'))]",
                                                                                collapsibleState: 0
                                                                            },
                                                                            {
                                                                                label: "sourceResourceId: [resourceId('newresourcegroup', 'Microsoft.Compute/virtualMachines', parameters('virtualMachineName'))]",
                                                                                collapsibleState: 0
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    {
                                        label: "dependsOn",
                                        collapsibleState: 0
                                    }
                                ]
                            },
                            {
                                label: "<virtualNetworkName>",
                                collapsibleState: 1,
                                icon: "virtualnetworks.svg",
                                children: [
                                    {
                                        label: "name: [parameters('virtualNetworkName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Network/virtualNetworks",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2017-08-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "addressSpace",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "addressPrefixes",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            },
                                            {
                                                label: "subnets",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "<subnetName>",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "name: [parameters('subnetName')]",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "properties",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "addressPrefix: [parameters('subnetPrefix')]",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "<networkInterfaceName>",
                                collapsibleState: 1,
                                icon: "nic.svg",
                                children: [
                                    {
                                        label: "name: [parameters('networkInterfaceName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Network/networkInterfaces",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2016-09-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "dependsOn",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "ipConfigurations",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "ipconfig1",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "name: ipconfig1",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "properties",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "subnet",
                                                                        collapsibleState: 1,
                                                                        children: [
                                                                            {
                                                                                label: "id: [variables('subnetRef')]",
                                                                                collapsibleState: 0
                                                                            }
                                                                        ]
                                                                    },
                                                                    {
                                                                        label: "privateIPAllocationMethod: Dynamic",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "publicIpAddress",
                                                                        collapsibleState: 1,
                                                                        children: [
                                                                            {
                                                                                label: "id: [resourceId('newresourcegroup','Microsoft.Network/publicIpAddresses', parameters('publicIpAddressName'))]",
                                                                                collapsibleState: 0
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                label: "networkSecurityGroup",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "id: [resourceId('newresourcegroup', 'Microsoft.Network/networkSecurityGroups', parameters('networkSecurityGroupName'))]",
                                                        collapsibleState: 0
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "<publicIpAddressName>",
                                collapsibleState: 1,
                                icon: "publicip.svg",
                                children: [
                                    {
                                        label: "name: [parameters('publicIpAddressName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Network/publicIpAddresses",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2017-08-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "publicIpAllocationMethod: [parameters('publicIpAddressType')]",
                                                collapsibleState: 0
                                            }
                                        ]
                                    },
                                    {
                                        label: "sku",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "name: [parameters('publicIpAddressSku')]",
                                                collapsibleState: 0
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                label: "<networkSecurityGroupName>",
                                collapsibleState: 1,
                                icon: "nsg.svg",
                                children: [
                                    {
                                        label: "name: [parameters('networkSecurityGroupName')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "type: Microsoft.Network/networkSecurityGroups",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "apiVersion: 2017-06-01",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "location: [parameters('location')]",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "properties",
                                        collapsibleState: 1,
                                        children: [
                                            {
                                                label: "securityRules",
                                                collapsibleState: 1,
                                                children: [
                                                    {
                                                        label: "default-allow-ssh",
                                                        collapsibleState: 1,
                                                        children: [
                                                            {
                                                                label: "name: default-allow-ssh",
                                                                collapsibleState: 0
                                                            },
                                                            {
                                                                label: "properties",
                                                                collapsibleState: 1,
                                                                children: [
                                                                    {
                                                                        label: "priority: 1000",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "protocol: TCP",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "access: Allow",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "direction: Inbound",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "sourceAddressPrefix: *",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "sourcePortRange: *",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "destinationAddressPrefix: *",
                                                                        collapsibleState: 0
                                                                    },
                                                                    {
                                                                        label: "destinationPortRange: 22",
                                                                        collapsibleState: 0
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        label: "outputs",
                        collapsibleState: 1,
                        icon: "outputs.svg",
                        children: [
                            {
                                label: "adminUsername",
                                collapsibleState: 1,
                                icon: "outputs.svg",
                                children: [
                                    {
                                        label: "type: string",
                                        collapsibleState: 0
                                    },
                                    {
                                        label: "value: [parameters('adminUsername')]",
                                        collapsibleState: 0
                                    }
                                ]
                            }
                        ]
                    }
                ]
            );
        });

        /////////////////////////

        test("getChildren: Errors: Bad key type", async () => {
            await testTree(`{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                true: false
            }`,
                [
                    {
                        label: "$schema: https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                        collapsibleState: 0,
                        icon: "label.svg"
                    }
                ]
            );
        });

        /////////////////////////

        test("getChildren: Errors: Missing end quote", async () => {
            await testTree(`{
                {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "true: false
                }
            }`,
                [
                    {
                        label: "$schema: https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                        collapsibleState: 0,
                        icon: "label.svg"
                    }
                ]
            );
        });

        ///////////////////////// end of JsonOutlineProvider tests

    });
});

type ITestTreeItem = {
    label?: string;
    collapsibleState?: vscode.TreeItemCollapsibleState;
    icon?: string;
    children?: ITestTreeItem[];
}

function toTestTreeItem(item: vscode.TreeItem): ITestTreeItem {
    let testItem: ITestTreeItem = {
        label: item.label,
        collapsibleState: item.collapsibleState
    };

    if (item.iconPath) {
        testItem.icon = path.basename(item.iconPath.toString());
    }

    return testItem;
}

function getTextAtSpan(span: Span): string {
    return templateAllParamDefaultTypes.substr(span.startIndex, span.length);
}

async function showNewTextDocument(text: string): Promise<vscode.TextEditor> {
    let textDocument = await vscode.workspace.openTextDocument({
        language: "jsonc",
        content: text
    });
    return await vscode.window.showTextDocument(textDocument);
}

async function writeToEditor(editor: vscode.TextEditor, data: string): Promise<void> {
    await editor.edit((editBuilder: vscode.TextEditorEdit) => {
        if (editor.document.lineCount > 0) {
            const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
            editBuilder.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine.range.start.line, lastLine.range.end.character)));
        }

        editBuilder.insert(new vscode.Position(0, 0), data);
    });
}

const templateAllParamDefaultTypes: string = `
            {
                "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                        "a": 1,
                            "parameters": {
                    "int": {
                        "type": "int",
                            "defaultValue": 1
                    },
                    "string": {
                        "type": "string",
                            "defaultValue": "hi"
                    },
                    "array": {
                        "type": "array",
                            "defaultValue": [
                                "hi",
                                "there",
                                1
                            ]
                    },
                    "object": {
                        "type": "object",
                            "defaultValue": {
                            "hi": "there",
                                "one": 1
                        }
                    },
                    "bool": {
                        "type": "bool",
                            "defaultValue": false
                    },
                    "null": {
                        "type": "bool",
                            "defaultValue": null
                    },
                    "undefined": {
                        "type": "string",
                            "defaultValue": "undefined"
                    },
                    "securestring": {
                        "type": "securestring",
                            "defaultValue": "string"
                    },
                    "secureObject": {
                        "type": "secureObject",
                            "defaultValue": {
                            "hi": "there"
                        }
                    },
                    "windowsOSVersion": {
                        "type": "string",
                            "defaultValue": "2016-Datacenter-with-Containers",
                                "allowedValues": [
                                    "2016-Datacenter-with-Containers",
                                    "Datacenter-Core-1709-with-Containers-smalldisk"
                                ],
                                    "metadata": {
                            "description": "The Windows version for the VM. This will pick a fully patched image of this given Windows version. Allowed values: 2008-R2-SP1, 2012-Datacenter, 2012-R2-Datacenter."
                        }
                    },
                    "hostVMprofile": {
                        "type": "object",
                            "defaultValue": {
                            "hostvmSku": {
                                "type": "string",
                                    "defaultValue": "Standard_A1",
                                        "metadata": {
                                    "description": "Size of VMs in the VM Scale Set hosting docker swarm hosts."
                                }
                            },
                            "windowsOSVersion": {
                                "type": "string",
                                    "defaultValue": "2016-Datacenter-with-Containers",
                                        "allowedValues": [
                                            "2016-Datacenter-with-Containers",
                                            "Datacenter-Core-1709-with-Containers-smalldisk"
                                        ],
                                            "metadata": {
                                    "description": "The Windows version for the host VMs, please note that if you choose SAC version then you need to choose SemiAnnual for offer"
                                }
                            },
                            "offer": {
                                "type": "string",
                                    "defaultValue": "WindowsServer",
                                        "allowedValues": [
                                            "WindowsServer",
                                            "WindowsServerSemiannual"
                                        ],
                                            "metadata": {
                                    "description": "Choose WindowsServerSemiannual for SAC channel"
                                }
                            }
                        }
                    }
                },
                "variables": {
                    "swarmhostimageReference": {
                        "publisher": "MicrosoftWindowsServer",
                            "offer": "[parameters('hostVMprofile').offer]",
                                "sku": "[parameters('hostVMprofile').windowsOSVersion]",
                                    "version": "latest"
                    },
                    "namingInfix": "[toLower(substring(concat(parameters('vmssName'), uniqueString(resourceGroup().id)), 0, 9))]",
                        "addressPrefix": "10.0.0.0/16"
                },
                "resources": [
                    {
                        "type": "Microsoft.Network/virtualNetworks",
                        "name": "[variables('virtualNetworkName')]",
                        "location": "[resourceGroup().location]",
                        "apiVersion": "2017-06-01",
                        "properties": {
                            "addressSpace": {
                                "addressPrefixes": [
                                    "[variables('addressPrefix')]"
                                ]
                            },
                            "subnets": [
                                {
                                    "name": "[variables('subnetName')]",
                                    "properties": {
                                        "addressPrefix": "[variables('subnetPrefix')]",
                                        "networkSecurityGroup": {
                                            "id": "[resourceId('Microsoft.Network/networkSecurityGroups', 'SwarmNSG')]"
                                        }
                                    }
                                },
                                {
                                    "name": "[variables('appGwSubnetName')]",
                                    "properties": {
                                        "addressPrefix": "[variables('appGwSubnetPrefix')]"
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "apiVersion": "2017-03-01",
                        "type": "Microsoft.Network/networkSecurityGroups",
                        "name": "SwarmNSG",
                        "location": "[resourceGroup().location]",
                        "tags": {
                            "any": "who there",
                            "displayName": "Swarm Display Name"
                        },
                        "properties": {
                            "securityRules": [
                                {
                                    "name": "rdp-rule",
                                    "properties": {
                                        "description": "Allow RDP",
                                        "protocol": "Tcp",
                                        "sourcePortRange": "*",
                                        "destinationPortRange": "3389",
                                        "sourceAddressPrefix": "Internet",
                                        "destinationAddressPrefix": "*",
                                        "access": "Allow",
                                        "priority": 100,
                                        "direction": "Inbound"
                                    }
                                },
                                {
                                    "name": "Docker-API",
                                    "properties": {
                                        "description": "Allow WEB",
                                        "protocol": "Tcp",
                                        "sourcePortRange": "*",
                                        "destinationPortRange": "2376",
                                        "sourceAddressPrefix": "Internet",
                                        "destinationAddressPrefix": "*",
                                        "access": "Allow",
                                        "priority": 101,
                                        "direction": "Inbound"
                                    }
                                }
                            ]
                        }
                    }
                ]
]
`;
