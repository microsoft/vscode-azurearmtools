// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

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

        async function testGetChildren(template: string, expected: ITestTreeItem[]): Promise<void> {
            let editor = await showNewTextDocument(template);
            let children = provider.getChildren(null);
            let testChildren = children.map(child => {
                let treeItem = provider.getTreeItem(child);
                return toTestTreeItem(treeItem);
            });

            assert.deepStrictEqual(testChildren, expected);
        }

        test("getChildren: Full tree: all default param types", async () => {

            await testGetChildren(template, [
                {
                    label: "$schema: http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    collapsibleState: 0,
                    iconFile: "label.svg"
                }, {
                    label: "contentVersion: 1.0.0.0",
                    collapsibleState: 0,
                    iconFile: "label.svg"
                }, {
                    label: "a: undefined", // Until https://github.com/Microsoft/vscode-azurearmtools/issues is fixed
                    collapsibleState: 0,
                    iconFile: undefined
                }, {
                    label: "parameters",
                    collapsibleState: 1,
                    iconFile: "parameters.svg"
                }, {
                    label: "variables",
                    collapsibleState: 1,
                    iconFile: "variables.svg"
                }, {
                    label: "resources",
                    collapsibleState: 1,
                    iconFile: "resources.svg"
                }
            ]);
        });
    });
});

type ITestTreeItem = {
    label: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
    iconFile: string;
}

function toTestTreeItem(item: vscode.TreeItem): ITestTreeItem {
    return {
        label: item.label,
        collapsibleState: item.collapsibleState,
        iconFile: item.iconPath ? path.basename(item.iconPath.toString()) : undefined
    }
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
