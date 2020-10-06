// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable:max-func-body-length no-non-null-assertion no-invalid-template-strings

import * as assert from "assert";
import { getResourcesInfo, IJsonResourceInfo, IPeekResourcesArgs, ParentOrChildCodeLens } from "../extension.bundle";
import { IPartialDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate } from "./support/parseTemplate";

suite("ParentAndChildCodeLenses", () => {
    type Expected = [/*resourceName:*/ string, /*lensTitle:*/ string, /*targetStartLines:*/ number[] | undefined];

    function createTest(
        name: string,
        template: IPartialDeploymentTemplate,
        expected: Expected[]
    ): void {
        test(name, async () => {
            const dt = await parseTemplate(template, []);
            const lenses: ParentOrChildCodeLens[] = dt.getCodeLenses(undefined).filter(cl => cl instanceof ParentOrChildCodeLens) as ParentOrChildCodeLens[];

            const allInfos: IJsonResourceInfo[] = [];
            for (const scope of dt.allScopes) {
                const infos = getResourcesInfo({ scope, recognizeDecoupledChildren: false });
                allInfos.push(...infos);
            }

            const actual: Expected[] = [];
            for (const lens of lenses) {
                await lens.resolve();
                // Find the resource the lens is inside
                const res = allInfos.find(info => info.resourceObject.span.startIndex === lens.span.startIndex);
                assert(res, "Could not find a resource at the location of the code lens");
                const targetStartLines = lens.command?.arguments ?
                    (<IPeekResourcesArgs>lens.command.arguments[0]).targets.map(loc => loc.range.start.line) :
                    undefined;
                actual.push(
                    [
                        res.getFriendlyNameExpression({}) ?? '',
                        lens.command?.title ?? '',
                        targetStartLines
                    ]);
            }

            assert.deepStrictEqual(actual, expected);
        });
    }

    createTest(
        "single resource",
        {
            resources: [
                {
                    name: "self",
                    type: "microsoft.abc/def"
                }
            ]
        },
        [
            // Not showing if not applicable (#1009) ["self", "No parent", undefined],
            // Not showing if not applicable (#1009) ["self", "No children", undefined]
        ]);

    suite("nested children", () => {
        createTest(
            "single nested child",
            {
                resources: [
                    {
                        name: "parent",
                        type: "microsoft.abc/def",
                        resources: [
                            {
                                name: "parent/child",
                                type: "microsoft.abc/def/ghi"
                            }
                        ]
                    }
                ]
            },
            [
                // Not showing if not applicable (#1009) ["parent", "No parent", undefined],
                ["parent", "1 child: child (ghi)", [6]],
                ["child", "Parent: parent (def)", [2]],
                // Not showing if not applicable (#1009) ["child", "No children", undefined],
            ]);

        createTest(
            "nested and decoupled child",
            {
                resources: [
                    {
                        name: "parent/child2",
                        type: "microsoft.abc/def/ghi"
                    },
                    {
                        name: "parent",
                        type: "microsoft.abc/def",
                        resources: [
                            {
                                name: "parent/child1",
                                type: "microsoft.abc/def/jkl"
                            }
                        ]
                    }
                ]
            },
            [
                ["child2", "Parent: parent (def)", [6]],
                // Not showing if not applicable (#1009) ["child2", "No children", undefined],
                // Not showing if not applicable (#1009) ["parent", "No parent", undefined],
                ["parent", "2 children: child1 (jkl), child2 (ghi)", [10, 2]], // sorted by short name
                ["child1", "Parent: parent (def)", [6]],
                // Not showing if not applicable (#1009) ["child1", "No children", undefined],
            ]);
    });

    createTest(
        "nested template",
        {
            resources: [
                {
                    type: "Microsoft.Resources/deployments",
                    apiVersion: "2019-10-01",
                    name: "inner1",
                    properties: {
                        expressionEvaluationOptions: {
                            scope: "inner"
                        },
                        mode: "Incremental",
                        template: {
                            resources: [
                                {
                                    name: "virtualNetwork1",
                                    type: "Microsoft.Network/virtualNetworks",
                                    tags: {
                                        displayName: "virtualNetwork1"
                                    },
                                    properties: {
                                        subnets: [
                                            {
                                                name: "Subnet-1"
                                            },
                                            {
                                                name: "Subnet-2"
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    type: "Microsoft.Resources/deployments",
                    apiVersion: "2019-10-01",
                    name: "outer1",
                    properties: {
                        expressionEvaluationOptions: {
                            scope: "outer"
                        },
                        mode: "Incremental",
                        template: {
                            resources: [
                                {
                                    name: "virtualNetwork1",
                                    type: "Microsoft.Network/virtualNetworks",
                                    tags: {
                                        displayName: "virtualNetwork1"
                                    },
                                    properties: {
                                        subnets: [
                                            {
                                                name: "Subnet-1"
                                            },
                                            {
                                                name: "Subnet-2"
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    condition: "[equals(parameters('vnet-new-or-existing'), 'existing')]",
                    apiVersion: "2019-11-01",
                    type: "Microsoft.Network/virtualNetworks/subnets",
                    name: "[concat(parameters('vnet-name'), '/', variables('bastion-subnet-name'))]",
                },
                {
                    condition: "[equals(parameters('vnet-new-or-existing'), 'new')]",
                    apiVersion: "2019-11-01",
                    name: "[parameters('vnet-name')]",
                    type: "Microsoft.Network/virtualNetworks",
                    properties: {
                        subnets: [
                            {
                                name: "[variables('bastion-subnet-name')]"
                            }
                        ]
                    }
                }
            ],
            parameters: {
                "vnet-new-or-existing": {
                },
                "vnet-name": {

                }
            },
            variables: {
                "bastion-subnet-name": ""
            }
        },
        [
            /* Not showing if not applicable (#1009)
            [ "inner1", "No parent", undefined],
            [
                "inner1",
                "No children",
                undefined
            ],
            [
                "outer1",
                "No parent",
                undefined
            ],
            [
                "outer1",
                "No children",
                undefined
            ],*/
            [
                "${bastion-subnet-name}",
                "Parent: ${vnet-name} (virtualNetworks)",
                [
                    72
                ]
            ],
            /* Not showing if not applicable (#1009)
            [
                "${bastion-subnet-name}",
                "No children",
                undefined
            ],
            [
                "${vnet-name}",
                "No parent",
                undefined
            ],*/
            [
                "${vnet-name}",
                "2 children: ${bastion-subnet-name} (subnets), ${bastion-subnet-name} (subnets)",
                [
                    79,
                    66
                ]
            ],
            [
                "${bastion-subnet-name}",
                "Parent: ${vnet-name} (virtualNetworks)",
                [
                    72
                ]
            ],
            /* Not showing if not applicable (#1009)
            [
                "${bastion-subnet-name}",
                "No children",
                undefined
            ],
            [
                "virtualNetwork1",
                "No parent",
                undefined
            ],*/
            [
                "virtualNetwork1",
                "2 children: Subnet-1 (subnets), Subnet-2 (subnets)",
                [
                    21,
                    24
                ]
            ],
            [
                "Subnet-1",
                "Parent: virtualNetwork1 (virtualNetworks)",
                [
                    13
                ]
            ],
            /* Not showing if not applicable (#1009)
            [
                "Subnet-1",
                "No children",
                undefined
            ],*/
            [
                "Subnet-2",
                "Parent: virtualNetwork1 (virtualNetworks)",
                [
                    13
                ]
            ],
            /* Not showing if not applicable (#1009)
            [
                "Subnet-2",
                "No children",
                undefined
            ],
            [
                "virtualNetwork1",
                "No parent",
                undefined
            ],*/
            [
                "virtualNetwork1",
                "2 children: Subnet-1 (subnets), Subnet-2 (subnets)",
                [
                    53,
                    56
                ]
            ],
            [
                "Subnet-1",
                "Parent: virtualNetwork1 (virtualNetworks)",
                [
                    45
                ]
            ],
            /* Not showing if not applicable (#1009)
            [
                "Subnet-1",
                "No children",
                undefined
            ],*/
            [
                "Subnet-2",
                "Parent: virtualNetwork1 (virtualNetworks)",
                [
                    45
                ]
            ]
            /* Not showing if not applicable (#1009)
            [
                "Subnet-2",
                "No children",
                undefined
            ]*/
        ]);
});
