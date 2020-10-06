// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length object-literal-key-quotes no-invalid-template-strings

import * as assert from "assert";
import { Completion } from '../extension.bundle';
import { assertEx } from './support/assertEx';
import { IPartialDeploymentTemplate } from './support/diagnostics';
import { parseTemplateWithMarkers } from './support/parseTemplate';

suite("dependsOn completions", () => {
    type PartialCompletionItem = Partial<Completion.Item & { replaceSpanStart: number; replaceSpanText: string }>;

    // <!replaceStart!> marks the start of the replace span
    // <!cursor!> marks the cursor
    function createDependsOnCompletionsTest(
        testName: string,
        options: {
            template: IPartialDeploymentTemplate | string;
            expected: PartialCompletionItem[];
            triggerCharacter?: string;
        }
    ): void {
        test(testName, async () => {
            const { dt, markers: { cursor, replaceStart } } = await parseTemplateWithMarkers(options.template);
            assert(cursor, "Missing <!cursor!> in testcase template");
            const pc = dt.getContextFromDocumentCharacterIndex(cursor.index, undefined);
            const { items: completions } = await pc.getCompletionItems(options.triggerCharacter);

            const actual: PartialCompletionItem[] = completions.map(filterActual);

            assertEx.deepEqual(
                actual,
                options.expected,
                {
                    ignorePropertiesNotInExpected: true
                });

            function filterActual(item: Completion.Item): PartialCompletionItem {
                // tslint:disable-next-line: strict-boolean-expressions
                if (!!replaceStart) {
                    return {
                        ...item,
                        replaceSpanStart: replaceStart.index,
                        replaceSpanText: dt.getDocumentText(item.span)
                    };
                } else {
                    return item;
                }
            }

        });
    }

    suite("completionKinds", () => {
        createDependsOnCompletionsTest(
            "completionKinds",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name1",
                            copy: {
                                name: "copy"
                            }
                        },
                        {
                            type: "microsoft.ghi/jkl",
                            name: "name2",
                            copy: {
                                name: "[concat(parameters('p1'), '/', variables('v1'))]"
                            }
                        }
                    ]
                },
                expected: [
                    {
                        "label": "name1",
                        "kind": Completion.CompletionKind.dependsOnResourceId
                    },
                    {
                        "label": "Loop copy",
                        "kind": Completion.CompletionKind.dependsOnResourceCopyLoop
                    },
                    {
                        "label": "name2",
                        "kind": Completion.CompletionKind.dependsOnResourceId
                    },
                    {
                        "label": "Loop ${p1}/${v1}",
                        "kind": Completion.CompletionKind.dependsOnResourceCopyLoop
                    }
                ]
            }
        );
    });

    suite("detail", () => {
        createDependsOnCompletionsTest(
            "detail matches friendy type name",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "Microsoft.abc/def",
                            name: "name1a"
                        },
                        {
                            type: "microsoft.123/456/789",
                            name: "name1b"
                        },
                        {
                            type: "singlesegment",
                            name: "name1c"
                        }
                    ]
                },
                expected: [
                    {
                        "label": "name1a",
                        "insertText": `"[resourceId('Microsoft.abc/def', 'name1a')]"`,
                        "detail": "def"
                    },
                    {
                        "label": "name1b",
                        "insertText": `"[resourceId('microsoft.123/456/789', 'name1b')]"`,
                        "detail": "789"
                    },
                    {
                        "label": "name1c",
                        "insertText": `"[resourceId('singlesegment', 'name1c')]"`,
                        "detail": "singlesegment"
                    }
                ]
            });

        createDependsOnCompletionsTest(
            "detail for copy loop is friendly type name",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "Microsoft.abc/def",
                            name: "name1",
                            copy: {
                                name: "copyname"
                            }
                        }
                    ]
                },
                expected: [
                    {
                        "label": "name1"
                    },
                    {
                        "label": "Loop copyname",
                        "detail": "def"
                    }
                ]
            });
    });

    suite("documentation", () => {
        createDependsOnCompletionsTest(
            "documentation",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name1a",
                            copy: {
                                name: "copyname"
                            }
                        }
                    ]
                },
                expected: [
                    {
                        // tslint:disable-next-line: no-any
                        "documention": <any>{
                            value:
                                // tslint:disable-next-line: prefer-template
                                "Inserts this resourceId reference:\n" +
                                "```arm-template\n" +
                                "\"[resourceId('microsoft.abc/def', 'name1a')]\"\n" +
                                "```\n<br/>"
                        }
                    },
                    {
                        // tslint:disable-next-line: no-any
                        "documention": <any>{
                            value:
                                `Inserts this COPY element reference:
\`\`\`arm-template
"copyname"
\`\`\`
from resource \`name1a\` of type \`def\``
                        }
                    }
                ]
            }
        );
    });

    suite("label", () => {
        createDependsOnCompletionsTest(
            "label is the last segment of the name - single segment",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name1a"
                        }
                    ]
                },
                expected: [
                    {
                        "label": `name1a`,
                        "insertText": `"[resourceId('microsoft.abc/def', 'name1a')]"`,
                        // tslint:disable-next-line: no-any
                        "documention": <any>{
                            value:
                                // tslint:disable-next-line: prefer-template
                                `Inserts this resourceId reference:\n` +
                                "```arm-template\n" +
                                `"[resourceId('microsoft.abc/def', 'name1a')]"\n` +
                                "```\n<br/>"
                        }
                    }
                ]
            }
        );

        createDependsOnCompletionsTest(
            "label is the last segment of the name - multiple segments",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "microsoft.abc/def/ghi",
                            name: "name1a/name1b"
                        }
                    ]
                },
                expected: [
                    {
                        "label": `name1b`
                    }
                ]
            }
        );

        createDependsOnCompletionsTest(
            "label for copy loop",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name1",
                            copy: {
                                name: "copynameliteral"
                            }
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name2",
                            copy: {
                                name: "[concat('copy', 'name1')]"
                            }
                        }
                    ]
                },
                expected: [
                    {
                        "label": `name1`
                    },
                    {
                        "label": `Loop copynameliteral`
                    },
                    {
                        "label": `name2`
                    },
                    {
                        "label": `Loop copyname1`
                    }
                ]
            }
        );
    });

    suite("expressions", () => {
        createDependsOnCompletionsTest(
            "type is expression",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "[variables('microsoft.abc/def')]",
                            name: "name1a"
                        }
                    ]
                },
                expected: [
                    {
                        "label": "name1a",
                        "insertText": `"[resourceId(variables('microsoft.abc/def'), 'name1a')]"`
                    }
                ]
            }
        );

        createDependsOnCompletionsTest(
            "name is expression that can't be separated",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "[add(parameters('name1a'), 'foo')]"
                        }
                    ]
                },
                expected: [
                    {
                        "label": "[add(${name1a}, 'foo')]",
                        "insertText": `"[resourceId('microsoft.abc/def', add(parameters('name1a'), 'foo'))]"`
                    }
                ]
            }
        );
    });

    createDependsOnCompletionsTest(
        "name is expressions that can be separated 1`",
        {
            template: {
                resources: [
                    {
                        dependsOn: [
                            "<!replaceStart!><!cursor!>"
                        ]
                    },
                    {
                        type: "microsoft.abc/def",
                        name: "[concat(parameters('name1a'), '/foo')]"
                    }
                ]
            },
            expected: [
                {
                    "label": "foo",
                    "insertText": `"[resourceId('microsoft.abc/def', parameters('name1a'), 'foo')]"`
                }
            ]
        }
    );

    createDependsOnCompletionsTest(
        "name is expressions that can be separated 2`",
        {
            template: {
                resources: [
                    {
                        dependsOn: [
                            "<!replaceStart!><!cursor!>"
                        ]
                    },
                    {
                        type: "microsoft.abc/def",
                        name: "[concat(parameters('name1a'), '/', 'foo')]"
                    }
                ]
            },
            expected: [
                {
                    "label": "foo",
                    "insertText": `"[resourceId('microsoft.abc/def', parameters('name1a'), 'foo')]"`
                }
            ]
        }
    );

    createDependsOnCompletionsTest(
        "insertionText for copy loop",
        {
            template: {
                resources: [
                    {
                        dependsOn: [
                            "<!replaceStart!><!cursor!>"
                        ]
                    },
                    {
                        type: "microsoft.abc/def",
                        name: "name1",
                        copy: {
                            name: "copynameliteral"
                        }
                    },
                    {
                        type: "microsoft.abc/def",
                        name: "name2",
                        copy: {
                            name: "[concat('copy', 'name1')]"
                        }
                    }
                ]
            },
            expected: [
                {
                    "label": `name1`
                },
                {
                    "insertText": `"copynameliteral"`
                },
                {
                    "label": `name2`
                },
                {
                    "insertText": `"[concat('copy', 'name1')]"`
                }
            ]
        }
    );

    createDependsOnCompletionsTest(
        "name is expression",
        {
            template: {
                resources: [
                    {
                        dependsOn: [
                            "<!replaceStart!><!cursor!>"
                        ]
                    },
                    {
                        type: "microsoft.abc/def",
                        name: "[sum(parameters('name1a'), 1)]"
                    }
                ]
            },
            expected: [
                {
                    "label": "[sum(${name1a}, 1)]",
                    "insertText": `"[resourceId('microsoft.abc/def', sum(parameters('name1a'), 1))]"`
                }
            ]
        }
    );

    suite("nested templates", () => {

        createDependsOnCompletionsTest(
            "Top level shouldn't find resources in nested scope",
            {
                template: {
                    "resources": [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "2019-06-01",
                            "name": "[concat(parameters('projectName'), 'stgdiag')]"
                        },
                        {
                            "type": "Microsoft.Resources/deployments",
                            "name": "[concat(parameters('projectName'),'dnsupdate')]",
                            "dependsOn": [
                                "[concat(parameters('projectName'),'lbwebgwpip')]"
                            ],
                            "properties": {
                                "template": {
                                    "resources": [
                                        {
                                            "name": "[parameters('DNSZone')]",
                                            "type": "Microsoft.Network/dnsZones"
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                },
                "expected": [
                    {
                        "insertText": `"[resourceId('Microsoft.Storage/storageAccounts', concat(parameters('projectName'), 'stgdiag'))]"`
                    },
                    {
                        "insertText": `"[resourceId('Microsoft.Resources/deployments', concat(parameters('projectName'),'dnsupdate'))]"`
                    }
                ]
            });

        createDependsOnCompletionsTest(
            "Inside nested scope shouldn't find top-level resources",
            {
                template: {
                    "resources": [
                        {
                            "type": "Microsoft.Storage/storageAccounts",
                            "apiVersion": "2019-06-01",
                            "name": "[concat(parameters('projectName'), 'stgdiag')]"
                        },
                        {
                            "type": "Microsoft.Resources/deployments",
                            "name": "[concat(parameters('projectName'),'dnsupdate')]",
                            "dependsOn": [
                                "[concat(parameters('projectName'),'lbwebgwpip')]"
                            ],
                            "properties": {
                                "template": {
                                    "resources": [
                                        {
                                            "name": "[parameters('DNSZone')]",
                                            "type": "Microsoft.Network/dnsZones"
                                        },
                                        {
                                            dependsOn: [
                                                "<!replaceStart!><!cursor!>"
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                },
                "expected": [
                    {
                        "insertText": `"[resourceId('Microsoft.Network/dnsZones', parameters('DNSZone'))]"`
                    }
                ]
            });
    });

    suite("completion triggering", () => {

        createDependsOnCompletionsTest(
            "ctrl+space without any quotes",
            {
                template: `{
                    "resources": [
                        {
                            "dependsOn": [
                                <!replaceStart!><!cursor!>
                            ]
                        },
                        {
                            "type": "microsoft.abc/def",
                            "name": "name1a"
                        }
                    ]
                }`,
                expected: [
                    {
                        "label": "name1a",
                        "insertText": `"[resourceId('microsoft.abc/def', 'name1a')]"`,
                        replaceSpanText: ``
                    }
                ]
            }
        );

        createDependsOnCompletionsTest(
            "ctrl+space just inside existing quotes",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name1a"
                        }
                    ]
                },
                expected: [
                    {
                        "label": "name1a",
                        "insertText": `"[resourceId('microsoft.abc/def', 'name1a')]"`,
                        replaceSpanText: `""`
                    }
                ]
            }
        );

        createDependsOnCompletionsTest(
            "typing double quote to string new string",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name1a"
                        }
                    ]
                },
                expected: [
                    {
                        "label": "name1a",
                        "insertText": `"[resourceId('microsoft.abc/def', 'name1a')]"`,
                        replaceSpanText: `""`
                    }
                ],
                triggerCharacter: '"'
            }
        );

        createDependsOnCompletionsTest(
            "replacement includes entire string",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!><!cursor!>name2a"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name1a"
                        }
                    ]
                },
                expected: [
                    {
                        "label": "name1a",
                        "insertText": `"[resourceId('microsoft.abc/def', 'name1a')]"`,
                        replaceSpanText: `"name2a"`
                    }
                ]
            }
        );

        createDependsOnCompletionsTest(
            "no dependsOn completions except at the start of the string (#1008)",
            {
                template: {
                    resources: [
                        {
                            dependsOn: [
                                "<!replaceStart!>name<!cursor!>2a"
                            ]
                        },
                        {
                            type: "microsoft.abc/def",
                            name: "name1a"
                        }
                    ]
                },
                expected: [
                ]
            }
        );
    });

    createDependsOnCompletionsTest(
        "case insensitive dependsOn",
        {
            template: {
                resources: [
                    {
                        DEPENDSON: [
                            "<!replaceStart!><!cursor!>name2a"
                        ]
                    },
                    {
                        type: "microsoft.abc/def",
                        name: "name1a"
                    }
                ]
            },
            expected: [
                {
                    "label": "name1a",
                    "insertText": `"[resourceId('microsoft.abc/def', 'name1a')]"`,
                    replaceSpanText: `"name2a"`
                }
            ]
        }
    );

    createDependsOnCompletionsTest(
        "multiple resources",
        {
            template: {
                resources: [
                    {
                        dependsOn: [
                            "<!replaceStart!><!cursor!>"
                        ]
                    },
                    {
                        type: "microsoft.abc/def",
                        name: "name1a"
                    },
                    {
                        type: "microsoft.abc/def",
                        name: "name1b"
                    },
                    {
                        type: "type2",
                        name: "name2"
                    }
                ]
            },
            expected: [
                {
                    "label": "name1a",
                    "insertText": `"[resourceId('microsoft.abc/def', 'name1a')]"`,
                    replaceSpanText: `""`
                },
                {
                    "label": "name1b",
                    "insertText": `"[resourceId('microsoft.abc/def', 'name1b')]"`,
                    replaceSpanText: `""`
                },
                {
                    "label": "name2",
                    "insertText": `"[resourceId('type2', 'name2')]"`,
                    replaceSpanText: `""`
                }
            ]
        }
    );

    createDependsOnCompletionsTest(
        "No dependsOn completion for the resource to itself",
        {
            template: {
                "resources": [
                    {
                        "name": "[variables('sqlServer')]",
                        "type": "Microsoft.Sql/servers",
                        "dependsOn": [
                            "<!cursor!>'"
                        ]
                    }
                ]
            },
            expected: [
            ]
        }
    );

    suite("Child resources", () => {

        suite("Decoupled parent/child", () => {

            createDependsOnCompletionsTest(
                "multiple segments in name as string literal",
                {
                    template: {
                        resources: [
                            {
                                dependsOn: [
                                    "<!replaceStart!><!cursor!>"
                                ]
                            },
                            {
                                type: "microsoft.abc/def/ghi",
                                name: "name1a/name1b"
                            }
                        ]
                    },
                    expected: [
                        {
                            "insertText": `"[resourceId('microsoft.abc/def/ghi', 'name1a', 'name1b')]"`
                        }
                    ]
                }
            );

            createDependsOnCompletionsTest(
                "Reference parent from child",
                {
                    template: {
                        "resources": [
                            {
                                // Parent
                                "name": "[variables('sqlServer')]",
                                "type": "Microsoft.Sql/servers"
                            },
                            {
                                // Child (decoupled).  Requires the parent as part of the name
                                "name": "[concat(variables('sqlServer'), '/' , variables('firewallRuleName'))]",
                                "type": "Microsoft.Sql/servers/firewallRules",
                                "dependsOn": [
                                    "<!cursor!>'"
                                ]
                            }
                        ]
                    },
                    expected: [
                        {
                            label: "Parent (${sqlServer})",
                            detail: "servers",
                            insertText: `"[resourceId('Microsoft.Sql/servers', variables('sqlServer'))]"`
                        }
                    ]
                }
            );

            // tslint:disable-next-line: no-suspicious-comment
            /* TODO: recognized decoupled children (https://github.com/microsoft/vscode-azurearmtools/issues/492)
            createDependsOnCompletionsTest(
                "Don't show completion to reference descendents from parent",
                {
                    template: {
                        "resources": [
                            {
                                // Sibling
                                "name": "[concat(variables('sqlServer'), '/' , variables('firewallRuleName2'))]",
                                "type": "Microsoft.Sql/servers/firewallRules",
                                "resources": [
                                    {
                                        "name": "siblingchild",
                                        "type": "Microsoft.Sql/servers/firewallRules/whatever"
                                    }
                                ]
                            },
                            {
                                // Parent
                                "name": "[variables('sqlServer')]",
                                "type": "Microsoft.Sql/servers",
                                "dependsOn": [
                                    "<!cursor!>'"
                                ]
                            },
                            {
                                // Child (decoupled).  Requires the parent as part of the name
                                "name": "[concat(variables('sqlServer'), '/' , variables('firewallRuleName'))]",
                                "type": "Microsoft.Sql/servers/firewallRules",
                                "resources": [
                                    {
                                        "name": "grandchild",
                                        "type": "Microsoft.Sql/servers/firewallRules/whatever"
                                    }
                                ]
                            }
                        ]
                    },
                    expected: [
                        {
                            label: "variables('firewallRuleName2')"
                        },
                        {
                            label: "siblingchild"
                        }
                    ]
                }
            );*/

        });

        suite("nested parent/child", () => {

            createDependsOnCompletionsTest(
                "Two ways to name nested children",
                {
                    template: {
                        "resources": [
                            {
                                // sibling
                                name: "sibling",
                                type: "a.b/c",
                                "dependsOn": [
                                    "<!cursor!>"
                                ]
                            },
                            {
                                // Parent
                                "name": "[variables('sqlServer')]",
                                "type": "Microsoft.Sql/servers",
                                "resources": [
                                    {
                                        // Child (nested) - Name/type don't include parent name/type (this is the normal and documented case)
                                        "name": "[variables('firewallRuleName')]",
                                        "type": "firewallRules"
                                    },
                                    {
                                        // Child (nested) - But name/type *can* include parent name/type (as long as both name and type do)
                                        "name": "[concat(variables('sqlServer'), '/', variables('firewallRuleName2'))]",
                                        "type": "Microsoft.Sql/servers/firewallRules"
                                    }
                                ]
                            }
                        ]
                    },
                    expected: [
                        {
                            label: "${sqlServer}"
                        },
                        {
                            label: "${firewallRuleName}",
                            insertText: `"[resourceId('Microsoft.Sql/servers/firewallRules', variables('sqlServer'), variables('firewallRuleName'))]"`
                        },
                        {
                            label: "${firewallRuleName2}",
                            insertText: `"[resourceId('Microsoft.Sql/servers/firewallRules', variables('sqlServer'), variables('firewallRuleName2'))]"`
                        }
                    ]
                }
            );

            createDependsOnCompletionsTest(
                "Reference parent and siblings from nested child",
                {
                    template: {
                        "resources": [
                            {
                                // sibling
                                name: "sibling",
                                type: "a.b/c"
                            },
                            {
                                // Parent
                                "name": "[variables('sqlServer')]",
                                "type": "Microsoft.Sql/servers",
                                "resources": [
                                    {
                                        // Child (nested) - Name/type don't include parent name/type (this is the normal and documented case)
                                        "name": "[variables('firewallRuleName')]",
                                        "type": "firewallRules",
                                        "dependsOn": [
                                            "<!cursor!>"
                                        ]
                                    },
                                    {
                                        // Child (nested) - But name/type *can* include parent name/type (as long as both name and type do)
                                        "name": "[concat(variables('sqlServer'), '/', variables('firewallRuleName2'))]",
                                        "type": "Microsoft.Sql/servers/firewallRules"
                                    }
                                ]
                            }
                        ]
                    },
                    expected: [
                        {
                            // another top-level resource
                            label: "sibling"
                        },
                        {
                            // parent
                            label: "Parent (${sqlServer})"
                        },
                        {
                            // sibling child
                            label: "${firewallRuleName2}"
                        }
                    ]
                }
            );

            createDependsOnCompletionsTest(
                "Don't reference nested child or descendents from parent",
                {
                    template: {
                        "resources": [
                            {
                                // Parent
                                "name": "[variables('sqlServer')]",
                                "type": "Microsoft.Sql/servers",
                                "resources": [
                                    {
                                        // Child (nested) - Name must not include parent name
                                        "name": "[variables('firewallRuleName')]",
                                        "type": "firewallRules",
                                        "resources": [
                                            {
                                                "name": "grandchild",
                                                "type": "subrule"
                                            }
                                        ]
                                    }
                                ],
                                "dependsOn": [
                                    "<!cursor!>"
                                ]
                            },
                            {
                                "name": "sibling",
                                "type": "abc.def/ghi"
                            }
                        ]
                    },
                    expected: [
                        {
                            insertText: `"[resourceId('abc.def/ghi', 'sibling')]"`
                        }
                    ]
                }
            );

        });

        suite("nested vnet", () => {

            createDependsOnCompletionsTest(
                "Don't reference child subnet from parent vnet",
                {
                    template: {
                        "resources": [
                            {
                                "type": "Microsoft.Network/virtualNetworks",
                                "name": "vnet1",
                                "properties": {
                                    "subnets": [
                                        // These are considered children, with type Microsoft.Network/virtualNetworks/subnets
                                        {
                                            "name": "subnet1",
                                            "type": "subnets"
                                        }
                                    ]
                                },
                                "dependsOn": [
                                    "<!cursor!>"
                                ]
                            }
                        ]
                    },
                    expected: [
                    ]
                }
            );

            createDependsOnCompletionsTest(
                "Reference parent vnet from child subnet",
                {
                    template: {
                        "resources": [
                            {
                                "type": "Microsoft.Network/virtualNetworks",
                                "name": "vnet1",
                                "properties": {
                                    "subnets": [
                                        // These are considered children, with type Microsoft.Network/virtualNetworks/subnets
                                        {
                                            "name": "subnet1",
                                            "type": "subnets",
                                            "dependsOn": [
                                                "<!cursor!>"
                                            ]
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    expected: [
                        {
                            insertText: `"[resourceId('Microsoft.Network/virtualNetworks', 'vnet1')]"`
                        }
                    ]
                }
            );

        });

    });

    suite("Multiple levels of children", () => {
        createDependsOnCompletionsTest(
            "Reference any resource's children except for direct descendents",
            {
                template: {
                    "resources": [
                        {
                            // Parent1
                            "name": "[variables('parent1')]",
                            "type": "Microsoft.Sql/servers",
                            "resources": [
                                {
                                    // Child1a (nested) - should not be in completions
                                    "name": "[variables('child1a')]",
                                    "type": "firewallRules",
                                    "dependsOn": [
                                        "<!cursor!>"
                                    ],
                                    "resources": [
                                        {
                                            // grandchild1 (nested) - should not be in completions
                                            "name": "grandchild1",
                                            "type": "rulechild"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            // Child1b (decoupled)
                            "name": "parent1/child1b",
                            "type": "Microsoft.Sql/servers/firewallRules"
                        },
                        {
                            // Sibling1
                            "name": "sibling1",
                            "type": "Microsoft.Sql/servers",
                            "resources": [
                                {
                                    // Child2a (nested)
                                    "name": "child2a",
                                    "type": "firewallRules",
                                    "resources": [
                                        {
                                            // grandchild2 (nested)
                                            "name": "grandchild2",
                                            "type": "rulechild"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            // Child2b of sibling1 (decoupled)
                            "name": "[concat('sibling1', '/', variables('child2b'))]",
                            "type": "Microsoft.Sql/servers/firewallRules"
                        }
                    ]
                },
                expected: [
                    {
                        label: "Parent (${parent1})"
                    },
                    {
                        label: "child1b"
                    },
                    {
                        label: "sibling1"
                    },
                    {
                        label: "child2a"
                    },
                    {
                        label: "grandchild2"
                    },
                    {
                        label: "${child2b}"
                    }
                ]
            }
        );
    });
});
