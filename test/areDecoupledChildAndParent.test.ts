// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: prefer-template max-func-body-length

import * as assert from "assert";
import { areDecoupledChildAndParent, getResourcesInfo, IResourceInfo } from "../extension.bundle";
import { IDeploymentTemplateResource, IPartialDeploymentTemplate } from "./support/diagnostics";
import { parseTemplate } from "./support/parseTemplate";
import { testLog } from "./support/testLog";

suite("areDecoupledChildAndParent", () => {
    suite("areDecoupledChildAndParent", () => {
        function createChildParentTestFromArray(
            name: string,
            template: IPartialDeploymentTemplate,
            parentNameExpression: string,
            childNameExpression: string,
            expected: boolean,
            expectedReverse: boolean
        ): void {
            test(`${name ? name + ':' : ''}child=${childNameExpression}, parent=${parentNameExpression}`, async () => {
                const dt = parseTemplate(template, []);
                const infos = getResourcesInfo({ scope: dt.topLevelScope, recognizeDecoupledChildren: false });
                testLog.writeLine(`Resource Infos found:\n` + infos.map(i => `${i.getFullNameExpression()} (${i.getFullTypeExpression()})`).join('\n'));

                const child = infos.find(i => i.getFullNameExpression() === childNameExpression);
                assert(!!child, `Could not find resource with full name "${childNameExpression}"`);
                const parent = infos.find(i => i.getFullNameExpression() === parentNameExpression);
                assert(!!parent, `Could not find resource with full name "${parentNameExpression}"`);

                testAreDecoupledChildAndParent(child, parent, expected, expectedReverse);
            });
        }

        function createChildParentTest(
            name: string,
            parent: Partial<IDeploymentTemplateResource>,
            child: Partial<IDeploymentTemplateResource>,
            expected: boolean,
            expectedReverse: boolean
        ): void {
            test(`${name ? name + ': ' : ''}child=${child.name}, parent=${parent.name}`, async () => {
                let keepNameInClosure = name;
                keepNameInClosure = keepNameInClosure;
                const template: IPartialDeploymentTemplate = {
                    resources: [
                        child,
                        parent
                    ]
                };
                const dt = parseTemplate(template);
                const infos = getResourcesInfo({ scope: dt.topLevelScope, recognizeDecoupledChildren: true });
                testLog.writeLine(`Resource Infos found:\n` + infos.map(i => `${i.getFullNameExpression()} (${i.getFullTypeExpression()})`).join('\n'));

                testAreDecoupledChildAndParent(infos[0], infos[1], expected, expectedReverse);
            });
        }

        function testAreDecoupledChildAndParent(
            child: IResourceInfo,
            parent: IResourceInfo,
            expected: boolean,
            expectedReverse?: boolean
        ): void {
            const result = areDecoupledChildAndParent(child, parent);
            const reverseResult = areDecoupledChildAndParent(parent, child);

            assert.strictEqual(result, expected, `areChildAndParent: expected ${expected} but received ${result}`);
            if (typeof expectedReverse === 'boolean') {
                assert.strictEqual(reverseResult, expectedReverse, `reversed areChildAndParent: expected ${expectedReverse} but received ${reverseResult}`);
            }
        }

        suite("false for self", () => {
            const template: IPartialDeploymentTemplate = {
                resources: [
                    {
                        name: "self",
                        type: "microsoft.abc/def"
                    }
                ]
            };

            createChildParentTestFromArray(
                "",
                template,
                `'self'`,
                `'self'`,
                false,
                false);
        });

        suite("false for nested", () => {
            const template: IPartialDeploymentTemplate = {
                resources: [
                    {
                        name: "parent",
                        type: "microsoft.abc/def",
                        resources: [
                            {
                                name: "child",
                                type: "ghi"
                            }
                        ]
                    }
                ]
            };

            createChildParentTestFromArray(
                "",
                template,
                `'parent'`,
                `'parent/child'`,
                false,
                false);
        });

        suite("incorrect segment lenghs", () => {
            createChildParentTest(
                "incorrect name segments length - same",
                {
                    name: "resource1",
                    type: "microsoft.abc/def"
                },
                {
                    name: "resource2",
                    type: "microsoft.abc/def/ghi"
                },
                false,
                false);
            createChildParentTest(
                "incorrect name segments length -- too many",
                {
                    name: "resource1",
                    type: "microsoft.abc/def"
                },
                {
                    name: "resource1/resource2/resource3",
                    type: "microsoft.abc/def/ghi"
                },
                false,
                false);

            createChildParentTest(
                "incorrect type segments length - same",
                {
                    name: "resource1",
                    type: "microsoft.abc/def"
                },
                {
                    name: "resource1/resource2",
                    type: "microsoft.abc/def"
                },
                false,
                false);
            createChildParentTest(
                "incorrect type segments length - too many",
                {
                    name: "resource1",
                    type: "microsoft.abc/def"
                },
                {
                    name: "resource1/resource2",
                    type: "microsoft.abc/def/ghi/jkl"
                },
                false,
                false);
        });

        suite("string literals, one level", () => {
            createChildParentTest(
                "match",
                {
                    name: "resource1",
                    type: "Microsoft.abc/def"
                },
                {
                    name: "resource1/resource2",
                    type: "Microsoft.abc/def/ghi"
                },
                true,
                false);

            createChildParentTest(
                "match case insensitive",
                {
                    name: "resource1",
                    type: "microsoft.abc/DEF"
                },
                {
                    name: "RESOURCE1/resource2",
                    type: "MICROSOFT.abc/def/ghi"
                },
                true,
                false);

            createChildParentTest(
                "names don't match",
                {
                    name: "resource1",
                    type: "microsoft.abc/def"
                },
                {
                    name: "resource2/resource2",
                    type: "microsoft.abc/def/ghi"
                },
                false,
                false);

            createChildParentTest(
                "number of type segments doesn't match number of name segments",
                {
                    name: "resource1",
                    type: "microsoft.abc/def/ghi"
                },
                {
                    name: "resource1/resource2",
                    type: "microsoft.abc/def/ghi/lmn"
                },
                false,
                false);
        });

        suite("string literals, two levels", () => {
            createChildParentTest(
                "match",
                {
                    name: "resource1/RESOURCE2",
                    type: "microsoft.abc/def/ghi"
                },
                {
                    name: "resource1/resource2/resource3",
                    type: "microsoft.abc/def/ghi/jkl"
                },
                true,
                false);
        });

        suite("expressions", () => {

            suite("name expressions", () => {
                createChildParentTest(
                    "name expr 1",
                    {
                        name: "resource1",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[concat('RESOURCE1', '/resource2')]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "name expr 2",
                    {
                        name: "resource1",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[concat('RESOURCE1/', 'resource2')]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "name expr 3",
                    {
                        name: "resource1",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[concat('RESOURCE1', '/', 'resource2')]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "name expr 4",
                    {
                        name: "[variables('parent')]",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[concat(variables('parent'), '/', 'resource2')]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "name expr 5",
                    {
                        name: "[variables('parent')]",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[concat(variables('parent'), '/', add(1, 2))]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "name expr 6",
                    {
                        name: "parent",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[concat('parent/', add(1, 2))]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "match whitespace differs",
                    {
                        name: "[variables('parent')]",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[  concat(variables( 'parent'),'/',add(   1,  2) ) ]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "match case insensitive",
                    {
                        name: "[variables('PARENT')]",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[CONCAT(variables('parent'), '/',    ADD(1, 2))]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "name exprs don't match",
                    {
                        name: "[variables('PARENT')]",
                        type: "microsoft.abc/DEF"
                    },
                    {
                        name: "[CONCAT(variables('parent2'), '/', mul(1, 2))]",
                        type: "MICROSOFT.abc/def/ghi"
                    },
                    false,
                    false);
            });

            suite("type expressions", () => {
                createChildParentTest(
                    "type expr 1",
                    {
                        type: "microsoft.abc/DEF",
                        name: "resource1"
                    },
                    {
                        type: "[concat('MICROSOFT.abc/def', '/ghi')]",
                        name: "resource1/resource2"
                    },
                    true,
                    false);

                createChildParentTest(
                    "type expr 2",
                    {
                        type: "[variables('parent')]",
                        name: "resource1"
                    },
                    {
                        type: "[concat(variables('parent'), '/', 'type2')]",
                        name: "resource1/resource2"
                    },
                    true,
                    false);

                createChildParentTest(
                    "type expr 2b - expression shouldn't match against a string literal",
                    {
                        type: "variables('parent')",
                        name: "resource1"
                    },
                    {
                        type: "[concat(variables('parent'), '/', 'type2')]",
                        name: "resource1/resource2"
                    },
                    false,
                    false);

                createChildParentTest(
                    "type expr 3",
                    {
                        type: "[variables('parent')]",
                        name: "name1"
                    },
                    {
                        type: "[concat(variables('parent'), '/', add(1, 2))]",
                        name: "name1/ghi"
                    },
                    true,
                    false);

                createChildParentTest(
                    "match whitespace differs",
                    {
                        type: "[variables('parent')]",
                        name: "name1"
                    },
                    {
                        type: "[  concat(variables( 'parent'),'/',add(   1,  2) ) ]",
                        name: "name1/name2"
                    },
                    true,
                    false);

                createChildParentTest(
                    "match case insensitive",
                    {
                        type: "[variables('PARENT')]",
                        name: "name1"
                    },
                    {
                        type: "[CONCAT(variables('parent'), '/',    ADD(1, 2))]",
                        name: "NAME1/name2"
                    },
                    true,
                    false);

                createChildParentTest(
                    "type exprs don't match",
                    {
                        type: "[variables('PARENT')]",
                        name: "name1"
                    },
                    {
                        type: "[CONCAT(variables('parent2'), '/', mul(1, 2))]",
                        name: "name2"
                    },
                    false,
                    false);
            });

        });
    });
});
