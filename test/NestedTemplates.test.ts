// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import * as assert from "assert";
import { ExpressionScopeKind, ReferenceList, TemplateScopeKind } from "../extension.bundle";
import { IPartialDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate, parseTemplateWithMarkers } from "./support/parseTemplate";
import { testWithRealFunctionMetadata } from "./TestData";

suite("Nested templates", () => {

    function getReferencesStartIndices(references: ReferenceList): number[] {
        return references.references.map(ref => ref.span.startIndex);
    }

    suite("detect scope", () => {
        function createDetectScopeTest(
            testName: string, properties: { [key: string]: unknown } | undefined,
            expectedScopeKind: ExpressionScopeKind | undefined
        ): void {
            test(testName, async () => {
                const template: IPartialDeploymentTemplate =
                    properties ?
                        {
                            "resources": [
                                {
                                    "type": "Microsoft.Resources/deployments",
                                    properties: {
                                        "template": {
                                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#"
                                        },
                                        ...properties
                                    }
                                }
                            ]
                        }
                        :
                        {
                            "resources": [
                                {
                                    "type": "Microsoft.Resources/deployments"
                                }
                            ]
                        };

                const dt = await parseTemplate(template);
                const child = dt.topLevelScope.resources[0].childDeployment;
                const actualScopeKind =
                    child?.scopeKind === TemplateScopeKind.NestedDeploymentWithInnerScope
                        ? ExpressionScopeKind.inner
                        : child?.scopeKind === TemplateScopeKind.NestedDeploymentWithOuterScope
                            ? ExpressionScopeKind.outer
                            : undefined;
                assert.equal(actualScopeKind, expectedScopeKind);
            });
        }

        createDetectScopeTest('no properties at all - no scope because it can\'t be a nested template', undefined, undefined);
        createDetectScopeTest('no expressionEvaluationOptions property', {}, ExpressionScopeKind.outer);
        createDetectScopeTest(
            'empty expressionEvaluationOptions property',
            {
                expressionEvaluationOptions: {

                }
            },
            ExpressionScopeKind.outer
        );
        createDetectScopeTest(
            'expressionEvaluationOptions with "inner" scope',
            {
                expressionEvaluationOptions: {
                    scope: "inner"
                }
            },
            ExpressionScopeKind.inner
        );
        createDetectScopeTest(
            'expressionEvaluationOptions with "INNER" scope',
            {
                expressionEvaluationOptions: {
                    scope: "INNER"
                }
            },
            ExpressionScopeKind.inner
        );
        createDetectScopeTest(
            'expressionEvaluationOptions with "outer" scope',
            {
                expressionEvaluationOptions: {
                    scope: "outer"
                }
            },
            ExpressionScopeKind.outer
        );
        createDetectScopeTest(
            'expressionEvaluationOptions with invalid scope',
            {
                expressionEvaluationOptions: {
                    scope: 123
                }
            },
            ExpressionScopeKind.outer
        );
    });

    suite("inner scope", () => {

        // inner scope variables

        test("inner scope variables", async () => {
            const template: IPartialDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "variables": {
                    "<!v1rootdef!>v1": "root v1",
                    "<!v2rootdef!>v2": "root v2"
                },
                "resources": [
                    {
                        "type": "Microsoft.Resources/deployments", // scope = inner
                        "name": "nested",
                        "apiVersion": "2017-05-10",
                        "location": "[variables('<!v1rootref1!>v1')]", // << references root
                        "properties": {
                            "mode": "[variables('<!v2rootref1!>v2')]", // << references root
                            "expressionEvaluationOptions": {
                                "scope": "inner"
                            },
                            "template": {
                                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                "contentVersion": "1.0.0.0",
                                "variables": {
                                    "<!v1innerdef!>v1": "inner v1",
                                    "<!v2innerdef!>v2": "[variables('<!v1innerref1!>v1')]" // << References inner v1
                                },
                                "resources": [
                                    {
                                        "type": "Microsoft.Network/virtualNetworks/subnets/providers/roleAssignments",
                                        "apiVersion": "2017-05-01",
                                        "name": "[variables('<!v1innerref2!>V1')]", // << References inner v1
                                        "location": "[variables('<!v2innerref1!>v2')]" // << References inner v2
                                    }
                                ]
                            }
                        }
                    }
                ]
            };

            const {
                dt,
                markers: { v1rootdef, v1rootref1,
                    v2rootdef, v2rootref1,
                    v1innerdef, v1innerref1, v1innerref2,
                    v2innerdef, v2innerref1
                }
            } = await parseTemplateWithMarkers(
                template,
                [
                    // testMessages.nestedTemplateNoValidation("nested"),
                ]);

            // v1 root
            const v1rootref1pc = dt.getContextFromDocumentCharacterIndex(v1rootref1.index, undefined);
            const v1rootref1References = v1rootref1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(v1rootref1References!), [
                v1rootdef.index,
                v1rootref1.index
            ],
                "v1 root");

            // v2 root
            const v2rootref1pc = dt.getContextFromDocumentCharacterIndex(v2rootdef.index, undefined);
            const v2rootref1References = v2rootref1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(v2rootref1References!), [
                v2rootdef.index,
                v2rootref1.index
            ],
                "v2 root");

            // v1 inner
            const v1innerdef1pc = dt.getContextFromDocumentCharacterIndex(v1innerdef.index, undefined);
            const v1innerdef1References = v1innerdef1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(v1innerdef1References!), [
                v1innerdef.index,
                v1innerref1.index,
                v1innerref2.index
            ],
                "v1 inner");

            // v2 inner
            const v2innerref1pc = dt.getContextFromDocumentCharacterIndex(v2innerref1.index, undefined);
            const v2innerref1References = v2innerref1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(v2innerref1References!), [
                v2innerdef.index,
                v2innerref1.index
            ],
                "v2 inner");
        });

        // inner scope parameters

        test("inner scope parameters", async () => {
            const template: IPartialDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "parameters": {
                    "<!p1rootdef!>p1": {
                        "type": "string"
                    }
                },
                "resources": [
                    {
                        "type": "Microsoft.Resources/deployments", // scope = inner
                        "name": "nested",
                        "apiVersion": "2017-05-10",
                        "location": "[parameters('<!p1rootref1!>p1')]", // << References root p1
                        "properties": {
                            "mode": "[parameters('<!p1rootref2!>p1')]", // << References root p1
                            "template": {
                                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                "contentVersion": "1.0.0.0",
                                "variables": {
                                    "v1": "[parameters('<!p1innerref1!>p1')]" // << References nested p1
                                },
                                "parameters": {
                                    "<!p1innerdef!>p1": {
                                        "type": "string",
                                        "defaultValue": "[parameters('<!p1innerref2!>p1')]" // << References nested p1 (self-referential, but doesn't matter for test)
                                    }
                                },
                                "resources": [
                                    {
                                        "type": "Microsoft.Network/virtualNetworks/subnets/providers/roleAssignments",
                                        "apiVersion": "2017-05-01",
                                        "name": "[parameters('<!p1innerref3!>P1')]" // << References nested p1
                                    }
                                ]
                            },
                            "expressionEvaluationOptions": {
                                "scope": "inner"
                            },
                            "parameters": {
                                "<!p1innerref4!>p1": { // << value for inner p1, therefore it's a reference to inner p1
                                    "value": "[parameters('<!p1rootref3!>p1')]" // << References root p1's value
                                }
                            }
                        }
                    }
                ]
            };

            const {
                dt,
                markers: { p1rootdef, p1rootref1, p1rootref2, p1rootref3, p1innerdef, p1innerref1, p1innerref2, p1innerref3 }
            } = await parseTemplateWithMarkers(template, [
                "Warning: The variable 'v1' is never used.",
                // testMessages.nestedTemplateNoValidation("nested"),
            ]);

            // root p1
            const p1rootref1pc = dt.getContextFromDocumentCharacterIndex(p1rootref1.index, undefined);
            const p1rootref1References = p1rootref1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(p1rootref1References!),
                [
                    p1rootdef.index,
                    p1rootref1.index,
                    p1rootref2.index,
                    p1rootref3.index
                ]);

            // inner p1
            const p1innerref1pc = dt.getContextFromDocumentCharacterIndex(p1innerref1.index, undefined);
            const p1innerref1References = p1innerref1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(p1innerref1References!),
                [
                    p1innerdef.index,
                    p1innerref1.index,
                    p1innerref2.index,
                    p1innerref3.index
                    // tslint:disable-next-line: no-suspicious-comment
                    // TODO: Recognize values specified for parameters for an inner-scoped nested template
                    // p1innerref4.index
                ]);
        });

        // inner scope user functions

        suite("inner scope functions", () => {
            const template: IPartialDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.2.3.4",
                "resources": [
                    {
                        // scope = inner
                        "type": "Microsoft.Resources/deployments",
                        "name": "nested",
                        "apiVersion": "2017-05-10",
                        "properties": {
                            "expressionEvaluationOptions": {
                                "scope": "inner"
                            },
                            "mode": "Incremental",
                            "template": {
                                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                "contentVersion": "1.0.0.0",
                                "resources": [
                                ],
                                "outputs": {
                                    "nestedOutput": {
                                        "type": "string",
                                        "value": "[inner.<!innerfunc1ref1!>func1('from nested')]"
                                    }
                                },
                                "functions": [
                                    {
                                        "namespace": "inner",
                                        "members": {
                                            "<!innerfunc1def!>func1": {
                                                "parameters": [
                                                    {
                                                        "name": "<!innerp1def!>innerp1",
                                                        "type": "string"
                                                    }
                                                ],
                                                "output": {
                                                    "type": "string",
                                                    "value": "[parameters('<!innerp1ref!>innerp1')]" // References inner func1's p1
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ],
                "outputs": {
                    "o1": {
                        "type": "string",
                        "value": "[reference('nested').outputs.nestedOutput.value]"
                    },
                    "o2": {
                        "type": "string",
                        "value": "[root.func1('from root')]"
                    }
                },
                "functions": [
                    {
                        "namespace": "root",
                        "members": {
                            "func1": {
                                "parameters": [
                                    {
                                        "name": "rootp1",
                                        "type": "string"
                                    }
                                ],
                                "output": {
                                    "type": "string",
                                    "value": "[parameters('rootp1')]"
                                }
                            }
                        }
                    }
                ]
            };

            test("no errors", async () => {
                await parseTemplateWithMarkers(template, [
                    // testMessages.nestedTemplateNoValidation("nested"),
                ]);
            });

            test("inner.func1", async () => {
                const { dt, markers: { innerfunc1def, innerfunc1ref1 } } = await parseTemplateWithMarkers(template);
                const innerfunc1defpc = dt.getContextFromDocumentCharacterIndex(innerfunc1def.index, undefined);
                const innerfunc1defRefs = innerfunc1defpc.getReferences();
                assert.deepEqual(
                    getReferencesStartIndices(innerfunc1defRefs!), [
                    innerfunc1def.index,
                    innerfunc1ref1.index
                ]);
            });

            test("inner.func1.innerp1", async () => {
                const {
                    dt, markers: { innerp1def, innerp1ref }
                } = await parseTemplateWithMarkers(template);
                const pc = dt.getContextFromDocumentCharacterIndex(innerp1def.index, undefined);
                const refs = pc.getReferences();
                assert.deepEqual(
                    getReferencesStartIndices(refs!), [
                    innerp1def.index,
                    innerp1ref.index
                ]);
            });
        });
    });

    // outer scope

    suite("outer scope", () => {

        // outer scope variables

        test("outer scope always accesses root-level variables", async () => {
            const template: IPartialDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "variables": {
                    "<!v1def!>v1": "root v1",
                    "<!v2def!>v2": "root v2"
                },
                "resources": [
                    {
                        "type": "Microsoft.Resources/deployments", // scope = outer
                        "name": "nested",
                        "apiVersion": "2017-05-10",
                        "location": "[variables('<!v1ref1!>v1')]",
                        "properties": {
                            "mode": "[variables('<!v1ref2!>v1')]",
                            "template": {
                                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                "contentVersion": "1.0.0.0",
                                "variables": {
                                    "v1": "inner v1", // << no way to reference this
                                    "v2": "[variables('<!v1ref3!>v1')]" // << References root v1
                                },
                                "resources": [
                                    {
                                        "type": "Microsoft.Network/virtualNetworks/subnets/providers/roleAssignments",
                                        "apiVersion": "2017-05-01",
                                        "name": "[variables('<!v1ref4!>V1')]", // << References root v1
                                        "location": "[variables('<!v2ref1!>v2')]" // << References root v2
                                    }
                                ]
                            }
                        }
                    }
                ]
            };

            const {
                dt,
                markers: { v1def, v1ref1, v1ref2, v1ref3, v1ref4, v2def, v2ref1 }
            } = await parseTemplateWithMarkers(
                template,
                [
                    "Warning: Variables, parameters and user functions of an outer-scoped nested template are inaccessible to any expressions. If you intended inner scope, set the deployment resource's properties.expressionEvaluationOptions.scope to 'inner'.",
                    // testMessages.nestedTemplateNoValidation("nested"),
                ]
            );

            // v1
            const v1ref1pc = dt.getContextFromDocumentCharacterIndex(v1ref1.index, undefined);
            const v1ref1References = v1ref1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(v1ref1References!), [
                v1def.index,
                v1ref1.index,
                v1ref2.index,
                v1ref3.index,
                v1ref4.index
            ]);

            // v2
            const v2ref1pc = dt.getContextFromDocumentCharacterIndex(v2ref1.index, undefined);
            const v2ref1References = v2ref1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(v2ref1References!), [
                v2def.index,
                v2ref1.index
            ]);
        });

        // outer scope parameters

        test("outer scope always accesses root-level parameters", async () => {
            const template: IPartialDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "parameters": {
                    "<!p1def!>p1": {
                        "type": "string"
                    }
                },
                "resources": [
                    {
                        "type": "Microsoft.Resources/deployments", // scope = outer
                        "name": "nested",
                        "apiVersion": "2017-05-10",
                        "location": "[parameters('<!p1ref1!>p1')]", // << References root p1
                        "properties": {
                            "mode": "[parameters('<!p1ref2!>p1')]", // << References root p1
                            "template": {
                                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                "contentVersion": "1.0.0.0",
                                "variables": {
                                    "v1": "[parameters('<!p1ref3!>p1')]" // << References root p1
                                },
                                "parameters": {
                                    "p1": { // No way to reference this
                                        "type": "string",
                                        "defaultValue": "[parameters('<!p1ref4!>p1')]" // << References root p1
                                    }
                                },
                                "resources": [
                                    {
                                        "type": "Microsoft.Network/virtualNetworks/subnets/providers/roleAssignments",
                                        "apiVersion": "2017-05-01",
                                        "name": "[parameters('<!p1ref5!>P1')]" // << References root p1
                                    }
                                ]
                            }
                        }
                    }
                ]
            };

            const {
                dt,
                markers: { p1def, p1ref1, p1ref2, p1ref3, p1ref4, p1ref5 }
            } = await parseTemplateWithMarkers(
                template,
                [
                    // `11: ${testMessages.nestedTemplateNoValidation("nested")}`,
                    "19: Warning: Variables, parameters and user functions of an outer-scoped nested template are inaccessible to any expressions. If you intended inner scope, set the deployment resource's properties.expressionEvaluationOptions.scope to 'inner'.",
                    "22: Warning: Variables, parameters and user functions of an outer-scoped nested template are inaccessible to any expressions. If you intended inner scope, set the deployment resource's properties.expressionEvaluationOptions.scope to 'inner'."
                ],
                {
                    includeDiagnosticLineNumbers: true
                });

            // p1
            const p1ref1pc = dt.getContextFromDocumentCharacterIndex(p1ref1.index, undefined);
            const p1ref1References = p1ref1pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(p1ref1References!), [
                p1def.index,
                p1ref1.index,
                p1ref2.index,
                p1ref3.index,
                p1ref4.index,
                p1ref5.index
            ]);
        });

        // outer scope user functions

        suite("outer scope always accesses root-level functions", async () => {
            const template: IPartialDeploymentTemplate = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.2.3.4",
                "resources": [
                    {
                        // scope = outer
                        "type": "Microsoft.Resources/deployments",
                        "name": "nested",
                        "apiVersion": "2017-05-10",
                        "properties": {
                            "mode": "Incremental",
                            "template": {
                                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                "contentVersion": "1.0.0.0",
                                "resources": [
                                ],
                                "outputs": {
                                    "nestedOutput1": {
                                        "type": "string",
                                        "value": "[root.<!rootfunc1ref1!>func1('from nested')]"
                                    }
                                }
                            }
                        }
                    }
                ],
                "outputs": {
                    "o1": {
                        "type": "string",
                        "value": "[reference('nested').outputs.nestedOutput.value]"
                    },
                    "o2": {
                        "type": "string",
                        "value": "[root.<!rootfunc1ref2!>func1('from root')]"
                    }
                },
                "functions": [
                    {
                        "namespace": "root",
                        "members": {
                            "<!rootfunc1def!>func1": {
                                "parameters": [
                                    {
                                        "name": "<!rootp1def!>rootp1",
                                        "type": "string"
                                    }
                                ],
                                "output": {
                                    "type": "string",
                                    "value": "[parameters('<!rootp1ref!>rootp1')]"
                                }
                            }
                        }
                    }
                ]
            };

            test("no errors", async () => {
                await parseTemplateWithMarkers(
                    template,
                    [
                        // testMessages.nestedTemplateNoValidation("nested"),
                    ]);
            });

            test("root.func1", async () => {
                const { dt, markers: { rootfunc1def, rootfunc1ref1, rootfunc1ref2 } } = await parseTemplateWithMarkers(template);
                const pc = dt.getContextFromDocumentCharacterIndex(rootfunc1def.index, undefined);
                const refs = pc.getReferences();
                assert.deepEqual(
                    getReferencesStartIndices(refs!), [
                    rootfunc1def.index,
                    rootfunc1ref1.index,
                    rootfunc1ref2.index
                ]);
            });

            test("root.func1.rootp1", async () => {
                const {
                    dt, markers: { rootp1def, rootp1ref }
                } = await parseTemplateWithMarkers(template);
                const pc = dt.getContextFromDocumentCharacterIndex(rootp1ref.index, undefined);
                const refs = pc.getReferences();
                assert.deepEqual(
                    getReferencesStartIndices(refs!), [
                    rootp1def.index,
                    rootp1ref.index
                ]);
            });
        });
    });

    test("errors/warnings", async () => {
        await parseTemplate(
            'templates/nestedTemplateScopesErrorsAndWarnings.json',
            [
                "8: Warning: The parameter 'p2' is never used.",
                "12: Warning: The parameter 'p4' is never used.",
                "17: Warning: The variable 'v1' is never used.",
                // `23: ${testMessages.nestedTemplateNoValidation("inner1")}`,
                "30: Error: The following parameters do not have values: \"p1\", \"p2\"",
                "35: Warning: The variable 'v2' is never used.",
                "53: Error: Undefined parameter reference: 'p4'",
                "60: Warning: The parameter 'p2' is never used.",
                "71: Warning: User-function parameter 'p1' is never used.",
                "80: Warning: The user-defined function 'udf.func2' is never used.",
                "97: Warning: The user-defined function 'udf2.func3' is never used.",
                // `112: ${testMessages.nestedTemplateNoValidation("outer1")}`,
                "121: Warning: Variables, parameters and user functions of an outer-scoped nested template are inaccessible to any expressions. If you intended inner scope, set the deployment resource's properties.expressionEvaluationOptions.scope to 'inner'.",
                "125: Warning: Variables, parameters and user functions of an outer-scoped nested template are inaccessible to any expressions. If you intended inner scope, set the deployment resource's properties.expressionEvaluationOptions.scope to 'inner'.",
                "130: Warning: Variables, parameters and user functions of an outer-scoped nested template are inaccessible to any expressions. If you intended inner scope, set the deployment resource's properties.expressionEvaluationOptions.scope to 'inner'.",
                "147: Error: Undefined parameter reference: 'p3'"
            ],
            {
                fromFile: true,
                includeDiagnosticLineNumbers: true
            });
    });
    test("No duplicate warnings from outer scoped nested template using same scope as parent", async () => {
        await parseTemplate(
            {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "p2": { // WARNING: unused
                        "type": "string",
                        "defaultValue": "abc"
                    },
                },
                "variables": {
                    "v1": "warning: unused"
                },
                "functions": [
                    {
                        "namespace": "udf",
                        "members": {
                            "notUsed": {
                            }
                        }
                    }
                ],
                "resources": [
                    {
                        "type": "Microsoft.Resources/deployments",
                        "apiVersion": "2015-01-01",
                        "name": "outer1",
                        "properties": {
                            "mode": "Incremental",
                            "template": {
                                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                                "contentVersion": "1.2.3.4",
                                "resources": []
                            }
                        }
                    }
                ]
            },
            [
                "Warning: The parameter 'p2' is never used.",
                "Warning: The variable 'v1' is never used.",
                "Warning: The user-defined function 'udf.notUsed' is never used.",
                // testMessages.nestedTemplateNoValidation("outer1"),
            ]
        );
    });

    suite("deeply nested", () => {
        const deeplyNestedTemplate = {
            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
            "contentVersion": "1.2.3.4",
            "resources": [
                {
                    // scope = inner
                    "type": "Microsoft.Resources/deployments",
                    "name": "inner1",
                    "apiVersion": "2017-05-10",
                    "properties": {
                        "expressionEvaluationOptions": {
                            "scope": "inner"
                        },
                        "mode": "Incremental",
                        "template": {
                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                            "contentVersion": "1.0.0.0",
                            "resources": [
                                {
                                    // scope = inner
                                    "type": "Microsoft.Resources/deployments",
                                    "name": "inner2",
                                    "apiVersion": "2017-05-10",
                                    "properties": {
                                        "expressionEvaluationOptions": {
                                            "scope": "inner"
                                        },
                                        "mode": "Incremental",
                                        "template": {
                                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                            "contentVersion": "1.0.0.0",
                                            "resources": [
                                                {
                                                    // scope = outer (inner2's scope, not the root scope)
                                                    "type": "Microsoft.Resources/deployments",
                                                    "name": "outer3",
                                                    "apiVersion": "2017-05-10",
                                                    "properties": {
                                                        "mode": "Incremental",
                                                        "template": {
                                                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                                            "contentVersion": "1.0.0.0",
                                                            "resources": [
                                                            ],
                                                            "outputs": {
                                                                "nestedOutput": {
                                                                    "type": "string",
                                                                    "value": "[inner2.<!inner2func1ref1!>func1('inner2.func1 from outer3')]"
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            ],
                                            "outputs": {
                                                "nestedOutput": {
                                                    "type": "string",
                                                    "value": "[inner2.<!inner2func1ref2!>func1('from inner.func1')]"
                                                }
                                            },
                                            "functions": [
                                                {
                                                    "namespace": "inner2",
                                                    "members": {
                                                        "<!inner2func1def!>func1": {
                                                            "parameters": [
                                                                {
                                                                    "name": "<!inner2func1innerp2def!>innerp2",
                                                                    "type": "string"
                                                                }
                                                            ],
                                                            "output": {
                                                                "type": "string",
                                                                "value": "[parameters('<!inner2func1innerp2ref1!>innerp2')]"
                                                            }
                                                        }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            ],
                            "outputs": {
                                "nestedOutput": {
                                    "type": "string",
                                    "value": "[inner1.func1('from inner.func1')]"
                                }
                            },
                            "functions": [
                                {
                                    "namespace": "inner1",
                                    "members": {
                                        "func1": {
                                            "parameters": [
                                                {
                                                    "name": "innerp1",
                                                    "type": "string"
                                                }
                                            ],
                                            "output": {
                                                "type": "string",
                                                "value": "[parameters('innerp1')]"
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    // scope = outer
                    "type": "Microsoft.Resources/deployments",
                    "name": "outer",
                    "apiVersion": "2017-05-10",
                    "properties": {
                        "mode": "Incremental",
                        "template": {
                            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                            "contentVersion": "1.0.0.0",
                            "resources": [
                            ],
                            "outputs": {
                                "nestedOutput": {
                                    "type": "string",
                                    "value": "[root.func1('root.func1 from outer')]"
                                }
                            }
                        }
                    }
                }
            ],
            "outputs": {
                /*

            "outputs": {
              "oInner1": {
                "type": "String",
                "value": "from inner.func1"
              },
              "oOuter": {
                "type": "String",
                "value": "root.func1 from outer"
              },
              "oRoot": {
                "type": "String",
                "value": "from root"
              }
            }

                */
                "oInner1": {
                    "type": "string",
                    "value": "[reference('inner1').outputs.nestedOutput.value]"
                },
                "oOuter": {
                    "type": "string",
                    "value": "[reference('outer').outputs.nestedOutput.value]"
                },
                "oRoot": {
                    "type": "string",
                    "value": "[root.func1('from root')]"
                }
            },
            "functions": [
                {
                    "namespace": "root",
                    "members": {
                        "func1": {
                            "parameters": [
                                {
                                    "name": "rootp1",
                                    "type": "string"
                                }
                            ],
                            "output": {
                                "type": "string",
                                "value": "[parameters('rootp1')]"
                            }
                        }
                    }
                }
            ]
        };

        test("no errors", async () => {
            await parseTemplateWithMarkers(
                deeplyNestedTemplate,
                [
                    // testMessages.nestedTemplateNoValidation("inner1"),
                    // testMessages.nestedTemplateNoValidation("inner2"),
                    // testMessages.nestedTemplateNoValidation("outer3"),
                    // testMessages.nestedTemplateNoValidation("outer"),
                ]);
        });

        test("outer3 references inner2.func1 from parent scope", async () => {
            const { dt, markers: { inner2func1def, inner2func1ref1, inner2func1ref2 } } = await parseTemplateWithMarkers(deeplyNestedTemplate);
            const pc = dt.getContextFromDocumentCharacterIndex(inner2func1def.index, undefined);
            const refs = pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(refs!), [
                inner2func1def.index,
                inner2func1ref1.index,
                inner2func1ref2.index
            ]);
        });

        test("inner2.innerp2", async () => {
            const { dt, markers: { inner2func1innerp2def, inner2func1innerp2ref1 } } = await parseTemplateWithMarkers(deeplyNestedTemplate);
            const pc = dt.getContextFromDocumentCharacterIndex(inner2func1innerp2def.index, undefined);
            const refs = pc.getReferences();
            assert.deepEqual(
                getReferencesStartIndices(refs!), [
                inner2func1innerp2def.index,
                inner2func1innerp2ref1.index
            ]);
        });
    });

    suite("real examples", () => {
        testWithRealFunctionMetadata("https://github.com/Azure/azure-resource-manager-schemas/issues/994", async () => {
            await parseTemplate(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "AgentManagementRG": {
                            "type": "string"
                        }
                    },
                    "functions": [
                    ],
                    "variables": {
                    },
                    "resources": [
                        {
                            "type": "Microsoft.Resources/deployments",
                            "apiVersion": "2019-08-01",
                            "name": "RoleBasedAccessDeployment",
                            "comments": "This adds the UAI to the management recourse group as a storage blob reader.",
                            "dependsOn": [
                                "uai-DevOps-AgentInstaller"
                            ],
                            "tags": {
                                "displayName": "Role Based Access Control Deployment"
                            },
                            "resourceGroup": "[parameters('AgentManagementRG')]",
                            "properties": {
                                "expressionEvaluationOptions": {
                                    "scope": "inner"
                                },
                                "mode": "Incremental",
                                "template": {
                                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                                    "contentVersion": "1.0.0.0",
                                    "parameters": {
                                        "principalId": {
                                            "type": "string"
                                        }
                                    },
                                    "variables": {
                                    },
                                    "resources": [
                                        {
                                            "name": "[guid(concat(resourceGroup().name, '-uai-DevOps-AgentInstaller'))]",
                                            "type": "Microsoft.Authorization/roleAssignments",
                                            "apiVersion": "2017-09-01",
                                            "properties": {
                                                "roleDefinitionId": "[concat(subscription().id, '/providers/Microsoft.Authorization/roleDefinitions/', 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')]",
                                                "principalId": "[parameters('principalId')]",
                                                "scope": "[resourceGroup().id]"
                                            }
                                        }
                                    ]
                                },
                                "parameters": {
                                    "principalId": {
                                        "value": "[reference('uai-DevOps-AgentInstaller', '2018-11-30').principalId]"
                                    }
                                }
                            }
                        }
                    ],
                    "outputs": {
                    }
                },
                [
                    // testMessages.nestedTemplateNoValidation("RoleBasedAccessDeployment"),
                ]);
        });
    });
});
