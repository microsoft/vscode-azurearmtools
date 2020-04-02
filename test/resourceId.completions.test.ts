// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template no-http-string

import { template_101_acsengine_swarmmode } from './resourceId.completions.templates';
import { createExpressionCompletionsTest } from './support/createCompletionsTest';
import { IDeploymentTemplate, IPartialDeploymentTemplate } from './support/diagnostics';
import { allTestDataExpectedCompletions } from './TestData';

suite("ResourceId completions", () => {
    function createResourceIdCompletionsTest(
        template: IPartialDeploymentTemplate,
        expressionWithBang: string,
        // Can either be an array of completion names, or an array of
        //   [completion name, insert text] tuples
        expectedCompletions: string[]
    ): void {
        createResourceIdCompletionsTest2(undefined, template, expressionWithBang, expectedCompletions);
    }

    function createResourceIdCompletionsTest2(
        name: string | undefined,
        template: IPartialDeploymentTemplate,
        expressionWithBang: string,
        // Can either be an array of completion names, or an array of
        //   [completion name, insert text] tuples
        expectedCompletions: string[]
    ): void {
        if (!("outputs" in template)) {
            // Add default outputs section to place test expressions into
            template = {
                ...template,
                outputs: {
                    "testOutput": {
                        value: "[<context>]"
                    }
                }
            };
        }

        // Always add default completions
        expectedCompletions = [...expectedCompletions, ...defaultCompletions];
        createExpressionCompletionsTest(expressionWithBang, expectedCompletions, template, { name });
    }

    const defaultCompletions = allTestDataExpectedCompletions(0, 0).map(c => c.label);

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
            createResourceIdCompletionsTest(template, `resourceId('type','name1',!)`, []);
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

    suite("If first arg is not non-empty string literal, match no names", () => {
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
        createResourceIdCompletionsTest(template, `resourceId(,!)`, []);
        createResourceIdCompletionsTest(template, `resourceId(1,!)`, []);
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

    // Note: tenantResourceId and extensionResourceId aren't in the test function metadata, so we won't specifically test them here
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
                `concat(variables('masterLbName'), '/', 'SSH-', variables('masterVMNamePrefix'), copyIndex())`,
                `concat(variables('masterSshPort22InboundNatRuleNamePrefix'), '0')`
            ]);
        createResourceIdCompletionsTest(
            template_101_acsengine_swarmmode,
            `resourceId('Microsoft.Storage/accounts',!)`,
            [
            ]);
    });

    suite("child resources", () => {
        const templateasdf: IDeploymentTemplate = {
            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {},
            "functions": [],
            "variables": {},
            "resources": [
                {
                    "name": "networkSecurityGroup1",
                    "type": "Microsoft.Network/networkSecurityGroups",
                    "apiVersion": "2019-11-01",
                    "location": "[resourceGroup().location]",
                    "properties": {},
                    "resources": [
                        {
                            "name": "networkSecurityGroupRule1a",
                            "type": "securityRules",
                            "apiVersion": "2019-11-01",
                            "dependson": [
                                "[resourceId('Microsoft.Network/networkSecurityGroups', 'networkSecurityGroup1')]"
                            ],
                            "properties": {
                                "description": "nsgRuleDescription",
                                "protocol": "*",
                                "sourcePortRange": "*",
                                "destinationPortRange": "*",
                                "sourceAddressPrefix": "*",
                                "destinationAddressPrefix": "*",
                                "access": "Allow",
                                "priority": 100,
                                "direction": "Inbound"
                            }
                        }
                    ]
                }
            ],
            "outputs": {
                "ruleResourceId": {
                    "type": "string",
                    "value": "[resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'networkSecurityGroup1', 'networkSecurityGroupRule1a')]"
                },
                // This resourceId call is not valid
                "invalidRuleResourceId2": {
                    "type": "string",
                    "value": "[resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'networkSecurityGroupRule1a')]"
                }
            }
        };

        const nestedTemplate: IPartialDeploymentTemplate = {
            "resources": [
                {
                    "name": "networkSecurityGroup1",
                    "type": "Microsoft.Network/networkSecurityGroups",
                    "resources": [
                        {
                            "name": "networkSecurityGroupRule1a",
                            "type": "securityRules", // It is possible though not common to specify the full type here asdf
                            "dependson": [
                                "[resourceId('Microsoft.Network/networkSecurityGroups', 'networkSecurityGroup1')]"
                            ]
                        },
                        {
                            "name": "networkSecurityGroupRule1b",
                            "type": "securityRules",
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
                    "name": "networkSecurityGroup1/networkSecurityGroupRule1a",
                    "type": "Microsoft.Network/networkSecurityGroups/securityRules",
                },
                {
                    "name": "networkSecurityGroup1/networkSecurityGroupRule1b",
                    "type": "Microsoft.Network/networkSecurityGroups/securityRules",
                },
                {
                    "name": "networkSecurityGroup1/networkSecurityGroupRule1b/grandchild",
                    "type": "Microsoft.Network/networkSecurityGroups/securityRules/fakeGrandchildType"
                }
            ]
        };

        function createTestsForChildResources(template: IPartialDeploymentTemplate): void {
            // For info on child resources, see https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/child-resource-name-type

            suite("1st arg - should sugggest parent and child types", () => {
                createResourceIdCompletionsTest(
                    template,
                    `resourceId(!)`,
                    [
                        `'Microsoft.Network/networkSecurityGroups'`,
                        `'Microsoft.Network/networkSecurityGroups/securityRules'`,
                        `'Microsoft.Network/networkSecurityGroups/securityRules/fakeGrandchildType'`
                    ]);
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

                suite("not matched or invalid - no completions", () => {
                    createResourceIdCompletionsTest2("type doesn't match", template, `resourceId('Microsoft.Network/networkSecurityGroups2/securityRULES', !)`, []);
                    createResourceIdCompletionsTest2("type doesn't match 2", template, `resourceId('Microsoft.Network/networkSecurityGroups/securityRULES2', !)`, []);
                    createResourceIdCompletionsTest2("expression", template, `resourceId(concat('Microsoft.Network/networkSecurityGroups/', 'securityRules'), !)`, []);

                    createResourceIdCompletionsTest(template, `resourceId('Microsoft.Network/networkSecurityGroups/securityRules2', 'NETWORKSecurityGroup1', !)`, []);
                    createResourceIdCompletionsTest2("1st part of name doesn't match", template, `resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'NETWORKSecurityGroup3', !)`, []);
                    createResourceIdCompletionsTest2("there is no 3rd part of name", template, `resourceId(concat('Microsoft.Network/networkSecurityGroups/', 'securityRules'), 'networkSecurityGroup1', !)`, []);
                });

                // Invalid: "[resourceId('Microsoft.Network/networkSecurityGroups/securityRules', 'networkSecurityGroupRule1a')]"
            });
        }

        suite("nested child resources", () => {
            createTestsForChildResources(nestedTemplate);
        });

        suite("decoupled child resources", () => {
            //asdf createTestsForChildResources(decoupledTemplate);
        });

        suite("doubly nested child resources", () => {
            test("doubly nested child resource"); //asdf
        });
    });
});
