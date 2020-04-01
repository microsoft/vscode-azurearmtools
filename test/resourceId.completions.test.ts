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
        createExpressionCompletionsTest(expressionWithBang, expectedCompletions, template);
    }

    const defaultCompletions = allTestDataExpectedCompletions(0, 0).map(c => c.label);

    suite("No resources section - empty completions", () => {
        const template: Partial<IDeploymentTemplate> = {
        };
        createResourceIdCompletionsTest(template, `resourceId(!)`, []);
        createResourceIdCompletionsTest(template, `resourceId('',!)`, []);
    });

    suite("Empty resources section - empty completions", () => {
        const template: Partial<IPartialDeploymentTemplate> = {
            resources: []
        };
        createResourceIdCompletionsTest(template, `resourceId(!)`, []);
        createResourceIdCompletionsTest(template, `resourceId('',!)`, []);
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
});
