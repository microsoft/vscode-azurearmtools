// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable:max-func-body-length no-non-null-assertion

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
            ["self", "No parent", undefined],
            ["self", "No children", undefined]
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
                ["parent", "No parent", undefined],
                ["parent", "1 child: child (ghi)", [6]],
                ["child", "Parent: parent (def)", [2]],
                ["child", "No children", undefined],
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
                ["child2", "No children", undefined],
                ["parent", "No parent", undefined],
                ["parent", "2 children: child1 (jkl), child2 (ghi)", [10, 2]], // sorted by short name
                ["child1", "Parent: parent (def)", [6]],
                ["child1", "No children", undefined],
            ]);
    });

});
