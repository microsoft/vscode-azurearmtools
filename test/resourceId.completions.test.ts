// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template no-http-string

import * as assert from 'assert';
import { AzureRMAssets, looksLikeResourceTypeStringLiteral, splitResourceNameIntoSegments } from '../extension.bundle';
import { template_101_acsengine_swarmmode, template_101_app_service_regional_vnet_integration, template_201_time_series_insights_environment_with_eventhub } from './resourceId.completions.templates';
import { createExpressionCompletionsTest } from './support/createCompletionsTest';
import { IDeploymentTemplate, IPartialDeploymentTemplate } from './support/diagnostics';
import { stringify } from './support/stringify';
import { allTestDataExpectedCompletions, UseRealFunctionMetadata } from './TestData';

suite("ResourceId completions", () => {
    function createResourceIdCompletionsTest(
        template: IPartialDeploymentTemplate,
        expressionWithBang: string,
        // Can either be an array of completion names, or an array of
        //   [completion name, insert text] tuples
        expectedCompletions: string[],
        addFunctionCompletions: boolean = true
    ): void {
        createResourceIdCompletionsTest2(undefined, template, expressionWithBang, expectedCompletions, addFunctionCompletions);
    }

    function createResourceIdCompletionsTest2(
        name: string | undefined,
        template: IPartialDeploymentTemplate,
        expressionWithBang: string,
        // Can either be an array of completion names, or an array of
        //   [completion name, insert text] tuples
        expectedCompletions: string[],
        addFunctionCompletions: boolean = true
    ): void {
        if (!("outputs" in template)) {
            template.outputs = {};
        }

        if (!stringify(template).includes('<context>')) {
            // Add a default test output to place test expressions into if not already there
            template.outputs!.testOutput = {
                value: "[<context>]"
            };
        }

        if (addFunctionCompletions) {
            // Add default completions for built-in functions
            expectedCompletions = [...expectedCompletions, ...defaultCompletions];
        }

        createExpressionCompletionsTest(
            expressionWithBang,
            expectedCompletions,
            template,
            {
                name,
                preps: [new UseRealFunctionMetadata()]
            });
    }

    const defaultCompletions = AzureRMAssets.getFunctionsMetadata().functionMetadata.map(c => c.unqualifiedName);
    allTestDataExpectedCompletions(0, 0).map(c => c.label);

    suite("looksLikeResourceTypeStringLiteral", () => {
        function createTest(expected: boolean, text: string): void {
            test(`looksLikeResourceTypeStringLiteral: ${expected}: ${text}`, () => {
                const result = looksLikeResourceTypeStringLiteral(text);
                assert.equal(result, expected);
            });
        }

        createTest(true, "'a.b/c'");
        createTest(true, "'a.b/c/d'");
        createTest(true, "'a.b/c/d/e'");
        createTest(true, "'ab.bc/cd/de/ef'");
        createTest(true, "'Microsoft.Network/publicIPAddresses'");
        createTest(true, "'Microsoft.Compute/virtualMachineScaleSets'");
        createTest(true, "'Microsoft.Network/virtualNetworks'");
        createTest(true, "'Microsoft.Compute/availabilitySets'");
        createTest(true, "'Microsoft.Network/publicIPAddresses'");
        createTest(true, "'Microsoft.Network/loadBalancers'");
        createTest(true, "'Microsoft.Network/loadBalancers/inboundNatRules'");

        createTest(false, "a.b/c");
        createTest(false, "'a./c'");
        createTest(false, "'a/c'");
        createTest(false, "'a.B'");
        createTest(true, "'a.b/c/d/'");
        createTest(false, "[variables('agentLbName')]");
    });

    suite("No resources section - empty completions", () => {
        const template: Partial<IDeploymentTemplate> = {
        };
        createResourceIdCompletionsTest2("1st arg", template, `resourceId(!)`, []);
        createResourceIdCompletionsTest2("2nd arg", template, `resourceId('',!)`, []);
    });

    suite("Empty resources section - empty completions", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: []
        };
        createResourceIdCompletionsTest2("1st arg", template, `resourceId(!)`, []);
        createResourceIdCompletionsTest2("2nd arg", template, `resourceId('',!)`, []);
    });

    suite("Single resource completions", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name1",
                    type: "type1"
                }
            ]
        };

        suite("First arg completions - resource type", () => {
            createResourceIdCompletionsTest(template, `resourceId(!)`, [`'type1'`]);
            createResourceIdCompletionsTest(template, `resourceId( !)`, [`'type1'`]);
            createResourceIdCompletionsTest(template, `resourceId( ! )`, [`'type1'`]);
        });

        suite("Second arg completions - resource name", () => {
            createResourceIdCompletionsTest(template, `resourceId('type1',!)`, [`'name1'`]);
            createResourceIdCompletionsTest(template, `resourceId('type1', !)`, [`'name1'`]);
            createResourceIdCompletionsTest(template, `resourceId('type1', ! )`, [`'name1'`]);
        });

        suite("Third arg completions - nothing", () => {
            createResourceIdCompletionsTest(template, `resourceId('type1','name1',!)`, []);
        });

        suite("resourceId case insensitive", () => {
            createResourceIdCompletionsTest(template, `RESOURCEid(!)`, [`'type1'`]);
        });
    });

    suite("Multiple resource completions", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name2",
                    type: "type2"
                },
                {
                    name: "name1",
                    type: "type1"
                }
            ]
        };

        createResourceIdCompletionsTest(template, `resourceId(!)`, [`'type1'`, `'type2'`]);
        createResourceIdCompletionsTest(template, `resourceId('type1',!)`, [`'name1'`]);
        createResourceIdCompletionsTest(template, `resourceId('type2',!)`, [`'name2'`]);
    });

    suite("Multiple resource completions - deduped types", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name1",
                    type: "type"
                },
                {
                    name: "name2",
                    type: "type"
                }
            ]
        };

        createResourceIdCompletionsTest(template, `resourceId(!)`, [`'type'`]);
    });

    suite("Multiple resource completions - deduped names", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name",
                    type: "type"
                },
                {
                    name: "name",
                    type: "type"
                }
            ]
        };

        createResourceIdCompletionsTest(template, `resourceId('type',!)`, [`'name'`]);
    });

    suite("Multiple resource completions - deduped types, case insensitive", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name1",
                    type: "type"
                },
                {
                    name: "name2",
                    type: "TYPE"
                }
            ]
        };

        createResourceIdCompletionsTest(template, `resourceId(!)`, [`'type'`]);
    });

    suite("Multiple resource completions - deduped names, case insensitive", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "NAME",
                    type: "type"
                },
                {
                    name: "name",
                    type: "type"
                }
            ]
        };

        createResourceIdCompletionsTest(template, `resourceId('type',!)`, [`'NAME'`]);
    });

    suite("Multiple resource completions - names completions, with types matched case-insensitively", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name1",
                    type: "type"
                },
                {
                    name: "name2",
                    type: "TYPE"
                }
            ]
        };

        createResourceIdCompletionsTest(template, `resourceId('tyPE',!)`, [`'name1'`, `'name2'`]);
    });

    suite("No type, not in completions list", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    type: "type1",
                    name: "name1",
                },
                {
                    name: "name2"
                }
            ]
        };
        createResourceIdCompletionsTest(template, `resourceId(!)`, [`'type1'`]);
    });

    suite("No type, not in completions list", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    type: "type1",
                    name: "name1",
                },
                {
                    name: "name2"
                }
            ]
        };
        createResourceIdCompletionsTest(template, `resourceId(!)`, [`'type1'`]);
    });

    suite("Only show resource names that match the type in the first arg", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    type: "type1",
                    name: "name1a",
                },
                {
                    type: "type1",
                    name: "name1b"
                },
                {
                    type: "type2",
                    name: "name2"
                }
            ]
        };
        createResourceIdCompletionsTest(template, `resourceId('type1',!)`, [`'name1a'`, `'name1b'`]);

        // Missing quotes around 'type1'
        createResourceIdCompletionsTest(template, `resourceId(type1,!)`, []);
    });

    suite("Type is not a string", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    type: <string><unknown>1,
                    name: "name1",
                }
            ]
        };
        createResourceIdCompletionsTest(template, `resourceId(!)`, []);
    });

    suite("Name is not a string", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    type: "type1",
                    name: <string><unknown>{}
                }
            ]
        };
        createResourceIdCompletionsTest(template, `resourceId('',!)`, []);
    });

    suite("Type is an expression", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    type: "[variables('type')]",
                    name: "name1",
                }
            ]
        };
        createResourceIdCompletionsTest(template, `resourceId(!)`, [`variables('type')`]);
        createResourceIdCompletionsTest(template, `resourceId(variables('type'),!)`, [`'name1'`]);
    });

    suite("Name is an expression", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    type: "type",
                    name: "[variables('name')]",
                }
            ]
        };
        createResourceIdCompletionsTest(template, `resourceId('type',!)`, [`variables('name')`]);
    });

    suite("subscriptionResourceId", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name2",
                    type: "type2"
                },
                {
                    name: "name1",
                    type: "type1"
                }
            ]
        };

        createResourceIdCompletionsTest(template, `SUBSCRIPTIONRESOURCEID(!)`, [`'type1'`, `'type2'`]);
        createResourceIdCompletionsTest(template, `subscriptionResourceId('type1',!)`, [`'name1'`]);
        createResourceIdCompletionsTest(template, `subscriptionResourceId('type2',!)`, [`'name2'`]);
    });

    suite("other names, no dice", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name2",
                    type: "type2"
                },
                {
                    name: "name1",
                    type: "type1"
                }
            ]
        };

        createResourceIdCompletionsTest(template, `extensionResourceId2(!)`, []);
        createResourceIdCompletionsTest(template, `udf1.resourceId('type1',!)`, []);
        createResourceIdCompletionsTest(template, `concat(!)`, []);
    });

    suite("101_acsengine_swarmmode", () => {

        /* the template contains the following resource type/name pairs:

        "name": "[variables('agentIPAddressName')]",
        "type": "Microsoft.Network/publicIPAddresses"

        "type": "Microsoft.Network/loadBalancers",
        "name": "[variables('agentLbName')]",

        "type": "Microsoft.Compute/virtualMachineScaleSets",
        "name": "[concat(variables('agentVMNamePrefix'), '-vmss')]",

        "name": "[variables('virtualNetworkName')]",
        "type": "Microsoft.Network/virtualNetworks"

        "type": "Microsoft.Compute/availabilitySets",
        "name": "[variables('masterAvailabilitySet')]",

        "name": "[variables('masterPublicIPAddressName')]",
        "type": "Microsoft.Network/publicIPAddresses"

        "name": "[variables('masterLbName')]",
        "type": "Microsoft.Network/loadBalancers"

        "name": "[concat(variables('masterLbName'), '/', 'SSH-', variables('masterVMNamePrefix'), copyIndex())]",
        "type": "Microsoft.Network/loadBalancers/inboundNatRules"

        "name": "[concat(variables('masterSshPort22InboundNatRuleNamePrefix'), '0')]",
        "type": "Microsoft.Network/loadBalancers/inboundNatRules"

        "name": "[concat(variables('masterVMNamePrefix'), 'nic-', copyIndex())]",
        "type": "Microsoft.Network/networkInterfaces"

        "type": "Microsoft.Compute/virtualMachines",
        "name": "[concat(variables('masterVMNamePrefix'), copyIndex())]",

        "type": "Microsoft.Compute/virtualMachines/extensions",
        "name": "[concat(variables('masterVMNamePrefix'), copyIndex(), '/configuremaster')]",
        */

        createResourceIdCompletionsTest(
            template_101_acsengine_swarmmode,
            'resourceId(!)',
            [
                "'Microsoft.Network/publicIPAddresses'",
                "'Microsoft.Compute/virtualMachineScaleSets'",
                "'Microsoft.Network/virtualNetworks'",
                "'Microsoft.Network/virtualNetworks/subnets'",
                "'Microsoft.Compute/availabilitySets'",
                "'Microsoft.Network/loadBalancers'",
                "'Microsoft.Network/loadBalancers/inboundNatRules'",
                "'Microsoft.Network/networkInterfaces'",
                "'Microsoft.Compute/virtualMachines'",
                "'Microsoft.Compute/virtualMachines/extensions'",
            ]);

        createResourceIdCompletionsTest(
            template_101_acsengine_swarmmode,
            `resourceId('Microsoft.COMPUTE/VIRTUALMachineScaleSets',!)`,
            [
                `concat(variables('agentVMNamePrefix'), '-vmss')`
            ]);
        createResourceIdCompletionsTest(
            template_101_acsengine_swarmmode,
            `resourceId('Microsoft.Network/publicIPAddresses',!)`,
            [
                `variables('agentIPAddressName')`,
                `variables('masterPublicIPAddressName')`
            ]);
        createResourceIdCompletionsTest(
            template_101_acsengine_swarmmode,
            `resourceId('Microsoft.Network/loadBalancers',!)`,
            [
                `variables('agentLbName')`,
                `variables('masterLbName')`,
            ]);
        createResourceIdCompletionsTest(
            template_101_acsengine_swarmmode,
            `resourceId('Microsoft.Network/loadBalancers/inboundNatRules',!)`,
            [
                `variables('masterLbName')`,
                `concat(variables('masterSshPort22InboundNatRuleNamePrefix'), '0')`
            ]);
        createResourceIdCompletionsTest(
            template_101_acsengine_swarmmode,
            `resourceId('Microsoft.Network/loadBalancers/inboundNatRules',variables('masterLbName'),!)`,
            [
                `concat('SSH-', variables('masterVMNamePrefix'), copyIndex())`
            ]);
        createResourceIdCompletionsTest(
            template_101_acsengine_swarmmode,
            `resourceId('Microsoft.Storage/accounts',!)`,
            [
            ]);

        suite("subnets special case - subnet children are located in properties, not resources", () => {
            suite("simple", () => {
                const nestedSubnetsTemplate = {
                    "resources": [
                        {
                            "type": "Microsoft.Network/virtualNetworks",
                            "name": "vnet1",
                            "properties": {
                                "subnets": [
                                    // These are considered children, with type Microsoft.Network/virtualNetworks/subnets
                                    {
                                        "name": "subnet1",
                                    },
                                    {
                                        "name": "subnet2",
                                    }
                                ]
                            }
                        }
                    ]
                };

                createResourceIdCompletionsTest2(
                    "1st arg",
                    nestedSubnetsTemplate,
                    `resourceId(!)`,
                    [`'Microsoft.Network/virtualNetworks'`, `'Microsoft.Network/virtualNetworks/subnets'`]
                );
                createResourceIdCompletionsTest2(
                    "2nd arg",
                    nestedSubnetsTemplate,
                    `resourceId('Microsoft.Network/virtualNetworks/subnets', !)`,
                    [`'vnet1'`]
                );
                createResourceIdCompletionsTest2(
                    "2nd arg",
                    nestedSubnetsTemplate,
                    `resourceId('Microsoft.Network/virtualNetworks/subnets', 'vnet1', !)`,
                    [`'subnet1'`, `'subnet2'`]
                );
            });

            suite("template_101_app_service_regional_vnet_integration", () => {
                // "subnetResourceId": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('vnetName'), variables('subnetName'))]",
                createResourceIdCompletionsTest2(
                    "1st arg",
                    template_101_app_service_regional_vnet_integration,
                    `resourceId(!)`,
                    [
                        `'Microsoft.Network/virtualNetworks'`,
                        `'Microsoft.Network/virtualNetworks/subnets'`,
                        `'Microsoft.Web/serverfarms'`,
                        `'Microsoft.Web/sites'`,
                        `'Microsoft.Web/sites/networkConfig'`
                    ]
                );
                createResourceIdCompletionsTest2(
                    "2nd arg",
                    template_101_app_service_regional_vnet_integration,
                    `resourceId('Microsoft.Network/virtualNetworks/subnets',!)`,
                    [
                        `variables('vnetName')`
                    ]
                );
                createResourceIdCompletionsTest2(
                    "3rd arg",
                    template_101_app_service_regional_vnet_integration,
                    `resourceId('Microsoft.Network/virtualNetworks/subnets', variables('vnetName'), !)`,
                    [`variables('subnetName')`]
                );

                createResourceIdCompletionsTest2(
                    "3rd arg, networkConfig",
                    template_101_app_service_regional_vnet_integration,
                    `resourceId('Microsoft.Web/sites/networkConfig',parameters('appName'),!)`,
                    [`'virtualNetwork'`]
                );
            });

            suite("template_101_acsengine_swarmmode", () => {
                // "agentVnetSubnetID": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('virtualNetworkName'), variables('agentSubnetName'))]",
                createResourceIdCompletionsTest(
                    template_101_acsengine_swarmmode,
                    `resourceId('Microsoft.Network/virtualNetworks/subnets', !)`,
                    [`variables('virtualNetworkName')`]);
                createResourceIdCompletionsTest(
                    template_101_acsengine_swarmmode,
                    `resourceId('Microsoft.Network/virtualNetworks/subnets', variables('virtualNetworkName'),!)`,
                    [`variables('masterSubnetName')`, `variables('agentSubnetName')`]);
                createResourceIdCompletionsTest(
                    template_101_acsengine_swarmmode,
                    `resourceId('Microsoft.Network/virtualNetworks/subnets', variables('virtualNetworkName'), variables('agentSubnetName'),!)`,
                    []);
            });
        });

        suite("Microsoft.Compute/virtualMachines/extensions", () => {
            createResourceIdCompletionsTest(
                template_101_acsengine_swarmmode,
                `resourceId('Microsoft.Compute/virtualMachines/extensions', !)`,
                [`concat(variables('masterVMNamePrefix'), copyIndex())`]);
            createResourceIdCompletionsTest(
                template_101_acsengine_swarmmode,
                `resourceId('Microsoft.Compute/virtualMachines/extensions', concat(variables('masterVMNamePrefix'), copyIndex()), !)`,
                [`'configuremaster'`]);
            createResourceIdCompletionsTest(
                template_101_acsengine_swarmmode,
                `resourceId('Microsoft.Compute/virtualMachines/extensions', concat(variables('masterVMNamePrefix'), copyIndex()), 'configuremaster'), !)`,
                []);
        });
    });

    suite("child resources", () => {
        const nestedTemplate: IPartialDeploymentTemplate = {
            "resources": [
                {
                    "name": "networkSecurityGroup1",
                    "type": "Microsoft.Network/networkSecurityGroups",
                    "resources": [
                        {
                            "name": "networkSecurityGroupRule1a",
                            "type": "securityRules",
                            "dependson": [
                                "[resourceId('Microsoft.Network/networkSecurityGroups', 'networkSecurityGroup1')]"
                            ]
                        },
                        {
                            // It is possible though not common to specify the full type like is done here
                            "name": "networkSecurityGroup1/networkSecurityGroupRule1b",
                            "type": "Microsoft.Network/networkSecurityGroups/securityRules",
                            "dependson": [
                                "[resourceId('Microsoft.Network/networkSecurityGroups', 'networkSecurityGroup1')]"
                            ]
                        }
                    ]
                },
                {
                    "name": "networkSecurityGroup2",
                    "type": "Microsoft.Network/networkSecurityGroups",
                    "resources": [
                        {
                            "name": "networkSecurityGroupRule2",
                            "type": "securityRules",
                            "dependson": [
                                "[resourceId('Microsoft.Network/networkSecurityGroups', 'networkSecurityGroup1')]"
                            ],
                            "resources": [
                                {
                                    "name": "grandchild",
                                    "type": "fakeGrandchildType"
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const decoupledTemplate: IPartialDeploymentTemplate = {
            "resources": [
                {
                    "name": "networkSecurityGroup1",
                    "type": "Microsoft.Network/networkSecurityGroups",
                },
                {
                    "name": "networkSecurityGroup2",
                    "type": "Microsoft.Network/networkSecurityGroups",
                },
                {
                    "name": "networkSecurityGroup1/networkSecurityGroupRule1a",
                    "type": "Microsoft.Network/networkSecurityGroups/securityRules",
                },
                {
                    "name": "networkSecurityGroup1/networkSecurityGroupRule1b",
                    "type": "Microsoft.Network/networkSecurityGroups/securityRules",
                },
                {
                    "name": "networkSecurityGroup2/networkSecurityGroupRule2",
                    "type": "Microsoft.Network/networkSecurityGroups/securityRules",
                },
                {
                    "name": "networkSecurityGroup2/networkSecurityGroupRule2/grandchild",
                    "type": "Microsoft.Network/networkSecurityGroups/securityRules/fakeGrandchildType"
                }
            ]
        };

        function createTestsForChildResources(template: IPartialDeploymentTemplate): void {
            // For info on child resources, see https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/child-resource-name-type

            const allResourceTypeCompletions = [
                `'Microsoft.Network/networkSecurityGroups'`,
                `'Microsoft.Network/networkSecurityGroups/securityRules'`,
                `'Microsoft.Network/networkSecurityGroups/securityRules/fakeGrandchildType'`
            ];

            suite("1st arg - should sugggest parent and child types", () => {
                createResourceIdCompletionsTest(
                    template,
                    `resourceId(!)`,
                    allResourceTypeCompletions);
            });
            suite("Referencing the parent", () => {
                // Valid: "[resourceId('Microsoft.Network/networkSecurityGroups', 'networkSecurityGroup1')]"
                createResourceIdCompletionsTest(template, `resourceId('Microsoft.Network/networkSecurityGroups', !)`, [`'networkSecurityGroup1'`, `'networkSecurityGroup2'`]);
                createResourceIdCompletionsTest(template, `resourceId('Microsoft.Network/networkSecurityGroups', 'networkSecurityGroup1', !)`, []);
            });
            suite("Referencing the nested children", () => {
                // Valid: resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'networkSecurityGroup1', 'networkSecurityGroupRule1a')
                createResourceIdCompletionsTest2("2nd arg (1st part of name)", template, `resourceId('Microsoft.Network/networkSecurityGroups/securityRULES', !)`, [`'networkSecurityGroup1'`, `'networkSecurityGroup2'`]);
                createResourceIdCompletionsTest2("3rd arg (2nd part of name)", template, `resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'NETWORKSecurityGroup1', !)`, [`'networkSecurityGroupRule1a'`, `'networkSecurityGroupRule1b'`]);
                createResourceIdCompletionsTest2("4th arg (not valid)", template, `resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'NETWORKSecurityGroup1', 'networkSecurityGroupRule2', !)`, []);

                createResourceIdCompletionsTest2("3rd arg #2", template, `resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'NETWORKSecurityGroup2', !)`, [`'networkSecurityGroupRule2'`]);

                suite("not matched or invalid but doesn't look like a type - returns match of all resource types", () => {
                    createResourceIdCompletionsTest2("type doesn't match", template, `resourceId(variables('a'), !)`, allResourceTypeCompletions);
                });

                // Invalid: "[resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'networkSecurityGroupRule1a')]"
            });
        }

        suite("nested child resources", () => {
            createTestsForChildResources(nestedTemplate);
        });

        suite("decoupled child resources", () => {
            createTestsForChildResources(decoupledTemplate);

            suite("Name is an expression with concat - resourceId completion should split the expression", () => {
                const template: IPartialDeploymentTemplate = {
                    "resources": [
                        {
                            "name": "[variables('sqlServer')]",
                            "type": "Microsoft.Sql/servers"
                        },
                        {
                            "name": "[concat(variables('sqlServer'), '/' , variables('firewallRuleName'))]",
                            "type": "Microsoft.Sql/servers/firewallRules"
                        }
                    ]
                };

                // resourceId('Microsoft.Sql/servers/firewallRules',variables('sqlServer'),variables('firewallRuleName'))
                createResourceIdCompletionsTest2("1st arg", template, `resourceId(,!)`, [`'Microsoft.Sql/servers/firewallRules'`, `'Microsoft.Sql/servers'`]);
                createResourceIdCompletionsTest2("2nd arg", template, `resourceId('Microsoft.Sql/servers/firewallRules',!)`, [`variables('sqlServer')`]);
                createResourceIdCompletionsTest2("3rd arg", template, `resourceId('Microsoft.Sql/servers/firewallRules',variables('sqlServer'), !)`, [`variables('firewallRuleName')`]);
                createResourceIdCompletionsTest2("4th arg", template, `resourceId('Microsoft.Sql/servers/firewallRules',variables('sqlServer'), variables('firewallRuleName'),!)`, []);

                suite("Whitespace ignored when looking at previous args", () => {
                    createResourceIdCompletionsTest2("ignore whitespace, 3rd arg", template, `resourceId('Microsoft.Sql/servers/firewallRules',variables( 'sqlServer' ) , !)`, [`variables('firewallRuleName')`]);
                });

                suite("splitResourceNameIntoSegments", () => {
                    function createSplitResourceNameTest(testName: string, resourceName: string, expected?: string[]): void {
                        if (!expected) {
                            // If no expected, we're expecting the original input minus the brackets ('[]') because
                            //   the code does't know how to split the resource name properly
                            expected = [resourceName.slice(1, resourceName.length - 1)];
                            testName += " - do not know how to split, expecting original expression minus brackets";
                        }
                        test(testName, async () => {
                            const actual = splitResourceNameIntoSegments(resourceName);
                            assert.deepStrictEqual(actual, expected);
                        });
                    }

                    createSplitResourceNameTest(
                        "not an expression",
                        `name1/name2/name3`,
                        [`'name1'`, `'name2'`, `'name3'`]);

                    createSplitResourceNameTest(
                        "not enough segments #1",
                        `[concat('a', '/')]`);
                    createSplitResourceNameTest(
                        "not enough segments #2",
                        `[concat('a', 'b')]`);

                    createSplitResourceNameTest(
                        "simple split with string literals",
                        `[concat('a', '/', 'b')]`,
                        [`'a'`, `'b'`]);

                    createSplitResourceNameTest(
                        "multiple split with string literals",
                        `[concat('a', '/', 'b', '/', 'c')]`,
                        [`'a'`, `'b'`, `'c'`]);
                    createSplitResourceNameTest(
                        "multiple split with expression",
                        `[concat('a', '/', concat('b1', 'b2'), '/', 'c')]`,
                        [`'a'`, `concat('b1', 'b2')`, `'c'`]);

                    createSplitResourceNameTest(
                        "groups need concat #1",
                        `[concat('a', 'b', '/', 'c')]`,
                        [`concat('a', 'b')`, `'c'`]);
                    createSplitResourceNameTest(
                        "groups need concat #2",
                        `[concat('a', 'b', '/', 'c', 'd')]`,
                        [`concat('a', 'b')`, `concat('c', 'd')`]);
                    createSplitResourceNameTest(
                        "groups need concat #3",
                        `[concat('a', 'b', '/', concat('c', '1'), 'd')]`,
                        [`concat('a', 'b')`, `concat(concat('c', '1'), 'd')`]);

                    createSplitResourceNameTest(
                        "'/' is at beginning or end of argument #1",
                        `[concat('a/', 'b')]`,
                        [`'a'`, `'b'`]);
                    createSplitResourceNameTest(
                        "'/' is at beginning or end of argument #2",
                        `[concat('a', '/b')]`,
                        [`'a'`, `'b'`]);

                    createSplitResourceNameTest(
                        "'/' is in middle of argument #1",
                        `[concat('a/b')]`,
                        [`'a'`, `'b'`]);
                    createSplitResourceNameTest(
                        "'/' is in middle of argument #2",
                        `[concat('a', 'b/c', add(1))]`,
                        [`concat('a', 'b')`, `concat('c', add(1))`]);

                    createSplitResourceNameTest(
                        "groups need concat #2",
                        `[concat('a', 'b', '/', 'c', 'd')]`,
                        [`concat('a', 'b')`, `concat('c', 'd')`]);

                    createSplitResourceNameTest(
                        "realistic #1",
                        `[concat(variables('sqlServer'), '/', variables('firewallRuleName'))]`,
                        [`variables('sqlServer')`, `variables('firewallRuleName')`]);
                    createSplitResourceNameTest(
                        "realistic #2",
                        `[concat(variables('sqlServer'), '/', variables('firewallRuleName'), '/', 'whatever')]`,
                        [`variables('sqlServer')`, `variables('firewallRuleName')`, `'whatever'`]);
                    createSplitResourceNameTest(
                        "realistic #3",
                        `[concat(variables('masterLbName'), '/', 'SSH-', variables('masterVMNamePrefix'), copyIndex())]`,
                        [`variables('masterLbName')`, `concat('SSH-', variables('masterVMNamePrefix'), copyIndex())`]
                    );
                    createSplitResourceNameTest(
                        "realistic #4",
                        `[concat(parameters('vmNameChefServer'),'/', 'chefServerSetup')]`,
                        [`parameters('vmNameChefServer')`, `'chefServerSetup'`]
                    );
                    createSplitResourceNameTest(
                        "realistic #5",
                        `[concat(parameters('chefprefix'), parameters('vmNameDSAgent'),copyIndex(),'/', variables('vmExtensionName'))]`,
                        [`concat(parameters('chefprefix'), parameters('vmNameDSAgent'), copyIndex())`, `variables('vmExtensionName')`]
                    );
                    createSplitResourceNameTest(
                        "realistic #6",
                        `[concat(parameters('omsLogAnalyticsWorkspaceName'), '/', tolower(variables('alertMetricArray')[copyIndex()].searchCategory), '|', toLower(variables('alertMetricArray')[copyIndex()].searchName), '/','schedule-',uniqueString(resourceGroup().id, deployment().name,parameters('omsLogAnalyticsWorkspaceName'), '/', variables('alertMetricArray')[copyIndex()].searchCategory, '|', variables('alertMetricArray')[copyIndex()].searchName))]`,
                        [
                            `parameters('omsLogAnalyticsWorkspaceName')`,
                            `concat(tolower(variables('alertMetricArray')[copyIndex()].searchCategory), '|', toLower(variables('alertMetricArray')[copyIndex()].searchName))`,
                            `concat('schedule-', uniqueString(resourceGroup().id, deployment().name,parameters('omsLogAnalyticsWorkspaceName'), '/', variables('alertMetricArray')[copyIndex()].searchCategory, '|', variables('alertMetricArray')[copyIndex()].searchName))`
                        ]
                    );
                    createSplitResourceNameTest(
                        "realistic #7",
                        `[concat(parameters('omsLogAnalyticsWorkspaceName'), '/', tolower(variables('alertMetricArray')[copyIndex()].searchCategory), '|', toLower(variables('alertMetricArray')[copyIndex()].searchName), '/','schedule-',uniqueString(resourceGroup().id, deployment().name,parameters('omsLogAnalyticsWorkspaceName'), '/', variables('alertMetricArray')[copyIndex()].searchCategory, '|', variables('alertMetricArray')[copyIndex()].searchName), '/', 'alert-',uniqueString(resourceGroup().id, deployment().name,parameters('omsLogAnalyticsWorkspaceName'), '/', variables('alertMetricArray')[copyIndex()].searchCategory, '|', variables('alertMetricArray')[copyIndex()].searchName))]`,
                        [
                            `parameters('omsLogAnalyticsWorkspaceName')`,
                            `concat(tolower(variables('alertMetricArray')[copyIndex()].searchCategory), '|', toLower(variables('alertMetricArray')[copyIndex()].searchName))`,
                            `concat('schedule-', uniqueString(resourceGroup().id, deployment().name,parameters('omsLogAnalyticsWorkspaceName'), '/', variables('alertMetricArray')[copyIndex()].searchCategory, '|', variables('alertMetricArray')[copyIndex()].searchName))`,
                            `concat('alert-', uniqueString(resourceGroup().id, deployment().name,parameters('omsLogAnalyticsWorkspaceName'), '/', variables('alertMetricArray')[copyIndex()].searchCategory, '|', variables('alertMetricArray')[copyIndex()].searchName))`
                        ]);
                    createSplitResourceNameTest(
                        "realistic #8",
                        `[concat(parameters('serverName'), '/', variables('firewallrules').batch.rules[copyIndex()].Name)]`,
                        [`parameters('serverName')`, `variables('firewallrules').batch.rules[copyIndex()].Name`]
                    );
                });
            });
        });

        suite("optional arguments", () => {
            suite("If first arg is not a recognized type name, complete with all resource types, up to the 3rd arg", () => {
                const template: Partial<IPartialDeploymentTemplate> = {
                    resources: [
                        {
                            type: "type1",
                            name: "name1a",
                        },
                        {
                            type: "type1",
                            name: "name1b"
                        },
                        {
                            type: "type2",
                            name: "name2"
                        }
                    ]
                };
                createResourceIdCompletionsTest2("1st arg", template, `resourceId(, !)`, [`'type1'`, `'type2'`]);
                createResourceIdCompletionsTest2("2nd arg", template, `resourceId(1, !)`, [`'type1'`, `'type2'`]);
                createResourceIdCompletionsTest2("3rd arg", template, `resourceId(1, resourceGroup().id, !)`, [`'type1'`, `'type2'`]);
                createResourceIdCompletionsTest2("4th arg - no type more completions", template, `resourceId(1, resourceGroup().id, 'nothing', !)`, []);
            });

            const template1: IPartialDeploymentTemplate = {
                "resources": [
                    {
                        "name": "name1",
                        "type": "ns.type1",
                        "resources": [
                            {
                                "name": "name2",
                                "type": "type2",
                                "resources": [
                                    {
                                        "name": "name3",
                                        "type": "type3"
                                    }
                                ]
                            }
                        ]
                    },
                ]
            };

            suite("resourceId using optional subscriptionId as first arg", () => {
                createResourceIdCompletionsTest2(
                    "1st arg - returns all types as usual",
                    template1,
                    `resourceId(!)`,
                    [`'ns.type1'`, `'ns.type1/type2'`, `'ns.type1/type2/type3'`]
                );
                createResourceIdCompletionsTest2(
                    "2nd arg - still returns all types since 1st arg not recognized",
                    template1,
                    `resourceId(subscription().id, !)`,
                    [`'ns.type1'`, `'ns.type1/type2'`, `'ns.type1/type2/type3'`]
                );
                createResourceIdCompletionsTest2(
                    "3rd arg - recognizes type in 2nd arg, returns first part of name",
                    template1,
                    `resourceId(subscription().id, 'ns.type1/type2/type3', !)`,
                    [`'name1'`]
                );
                createResourceIdCompletionsTest2(
                    "4th arg - returns second part of name",
                    template1,
                    `resourceId(subscription().id, 'ns.type1/type2/type3', 'name1', !)`,
                    [`'name2'`]
                );
                createResourceIdCompletionsTest2(
                    "5th arg - third part of name",
                    template1,
                    `resourceId(subscription().id, 'ns.type1/type2/type3', 'name1', 'name2', !)`,
                    [`'name3'`]
                );
            });

            suite("stop adding resource type completions once an argument looks like a type", () => {
                createResourceIdCompletionsTest2(
                    "2nd arg doesn't look like type",
                    template1,
                    `resourceId('hi, mom', !)`,
                    [`'ns.type1'`, `'ns.type1/type2'`, `'ns.type1/type2/type3'`]
                );
                createResourceIdCompletionsTest2(
                    "2nd arg looks like type",
                    template1,
                    `resourceId('Microsoft.Hello/Mom', !)`,
                    []
                );
            });
        });

        suite("template_201_time_series_insights_environment_with_eventhub - grandchild resources", () => {
            // "[resourceId('Microsoft.EventHub/namespaces/eventhubs/authorizationRules',parameters('eventHubNamespaceName'),parameters('eventHubName'),parameters('eventSourceKeyName'))]"
            createResourceIdCompletionsTest2(
                "1st arg",
                template_201_time_series_insights_environment_with_eventhub,
                `resourceId(!)`,
                [
                    `'Microsoft.EventHub/namespaces'`,
                    `'Microsoft.EventHub/namespaces/eventhubs'`,
                    `'Microsoft.EventHub/namespaces/eventhubs/authorizationRules'`,
                    `'Microsoft.EventHub/namespaces/eventhubs/consumergroups'`,
                    `'Microsoft.TimeSeriesInsights/environments'`,
                    `'Microsoft.TimeSeriesInsights/environments/eventsources'`,
                    `'Microsoft.TimeSeriesInsights/environments/accessPolicies'`
                ]
            );
            createResourceIdCompletionsTest2(
                "2nd arg",
                template_201_time_series_insights_environment_with_eventhub,
                `resourceId('Microsoft.EventHub/namespaces/eventhubs/authorizationRules', !)`,
                [`parameters('eventHubNamespaceName')`]
            );
            createResourceIdCompletionsTest2(
                "3rd arg",
                template_201_time_series_insights_environment_with_eventhub,
                `resourceId('Microsoft.EventHub/namespaces/eventhubs/authorizationRules', parameters('eventHubNamespaceName'), !)`,
                [`parameters('eventHubName')`]
            );
            createResourceIdCompletionsTest2(
                "4th arg",
                template_201_time_series_insights_environment_with_eventhub,
                `resourceId('Microsoft.EventHub/namespaces/eventhubs/authorizationRules', parameters('eventHubNamespaceName'), parameters('eventHubName'), !)`,
                [`parameters('eventSourceKeyName')`]
            );
            createResourceIdCompletionsTest2(
                "5th arg",
                template_201_time_series_insights_environment_with_eventhub,
                `resourceId('Microsoft.EventHub/namespaces/eventhubs/authorizationRules', parameters('eventHubNamespaceName'), parameters('eventHubName'), parameters('eventSourceKeyName'), !)`,
                []
            );
            createResourceIdCompletionsTest2(
                "6th arg with two optional params",
                template_201_time_series_insights_environment_with_eventhub,
                `resourceId('look', 'ma', 'Microsoft.EventHub/namespaces/eventhubs/authorizationRules', parameters('eventHubNamespaceName'), parameters('eventHubName'), !)`,
                [`parameters('eventSourceKeyName')`]
            );
        });
    });

    /////////////////

    suite("Completions within an existing argument", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: [
                {
                    name: "name1a",
                    type: "type1"
                },
                {
                    name: "name1b",
                    type: "type1"
                },
                {
                    name: "name2",
                    type: "type2"
                }
            ]
        };

        suite("First arg completions - existing resource type", () => {
            createResourceIdCompletionsTest(
                template,
                `resourceId('!','name1')`,
                [`'type1'`, `'type2'`],
                false);
            createResourceIdCompletionsTest(
                template,
                `resourceId('tp!e1','nam!')`,
                [`'type1'`, `'type2'`],
                false);
        });

        suite("Second arg completions - existing resource name", () => {
            createResourceIdCompletionsTest(
                template,
                `resourceId('type1','!')`,
                [`'name1a'`, `'name1b'`],
                false);
            createResourceIdCompletionsTest(
                template,
                `resourceId('type1','nam!')`,
                [`'name1a'`, `'name1b'`],
                false);
            createResourceIdCompletionsTest(
                template,
                `resourceId('type1','nam!e1a')`,
                [`'name1a'`, `'name1b'`],
                false);
        });
    });
});
