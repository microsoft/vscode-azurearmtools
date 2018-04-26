// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length

import * as assert from "assert";
import * as vscode from "vscode";
import * as Json from "../src/JSON";
import * as path from "path";

import { ext } from "../src/extensionVariables"
import { JsonOutlineProvider, IElementInfo } from "../src/Treeview";
import { Span } from "../src/Language";

suite("TreeView", async (): Promise<void> => {
    suite("JsonOutlineProvider", async (): Promise<void> => {
        let provider: JsonOutlineProvider;

        setup(function (this: Mocha.IHookCallbackContext, done: MochaDone): void {
            this.timeout(10000);

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

        async function testTree(template: string, expected: ITestTreeItem[]): Promise<void> {
            let editor = await showNewTextDocument(template);
            let testChildren = getTree(null);
            assert.deepStrictEqual(testChildren, expected);
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

        test("getChildren: Top level: all default param types", async () => {

            await testChildren(template, [
                {
                    label: "$schema: http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    collapsibleState: 0,
                    icon: "label.svg"
                }, {
                    label: "contentVersion: 1.0.0.0",
                    collapsibleState: 0,
                    icon: "label.svg"
                }, {
                    label: "a: undefined", // Until https://github.com/Microsoft/vscode-azurearmtools/issues is fixed
                    collapsibleState: 0,
                    icon: undefined
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

        test("getChildren: Full tree: all default param types", async () => {

            await testTree(template,
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
                        label: "a: undefined",
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
                                        label: "defaultValue: undefined",
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
                                                label: "one: undefined",
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
                                        label: "defaultValue: undefined",
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
                                label: "[variables('virtualNetworkName')]",
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
                                                        label: "[variables('subnetName')]",
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
                                                        label: "[variables('appGwSubnetName')]",
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
                                label: "SwarmNSG",
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
                                                label: "displayName: NSG - Swarm",
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
                                                                        label: "priority: undefined",
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
                                                                        label: "priority: undefined",
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
    });
});

type ITestTreeItem = {
    label: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
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
    return template.substr(span.startIndex, span.length);
}

async function showNewTextDocument(text: string): Promise<vscode.TextEditor> {
    let textDocument = await vscode.workspace.openTextDocument({
        language: "jsonc",
        content: template
    });
    let editor = await vscode.window.showTextDocument(textDocument);
    await writeToEditor(editor, template);
    return editor;
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

const template: string = `
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
                            "displayName": "NSG - Swarm"
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
