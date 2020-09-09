// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: max-func-body-length no-invalid-template-strings

import * as assert from "assert";
import { getResourceInfo } from "../extension.bundle";
import { IDeploymentTemplateResource } from "./support/diagnostics";
import { parseTemplate } from "./support/parseTemplate";

suite("getFriendlyNameForResource", () => {
    // see also ResourceInfo.test.ts

    function createFriendlyNameTest(testName: string, resource: Partial<IDeploymentTemplateResource>, expectedWithShortName: string, expectedWithLongName: string): void {
        test(`${testName} (short name)`, async () => {
            let keepTestNameInClosure = testName;
            keepTestNameInClosure = keepTestNameInClosure;

            const dt = await parseTemplate({
                resources: [
                    resource
                ]
            });
            // tslint:disable-next-line: no-non-null-assertion
            const info = getResourceInfo(dt.topLevelScope.rootObject!.getPropertyValue('resources')!.asArrayValue!.elements[0]!.asObjectValue!)!;
            const actual = info.getFriendlyName({ fullResourceName: false });
            assert.strictEqual(actual, expectedWithShortName);
        });
        test(`${testName} (long name)`, async () => {
            let keepTestNameInClosure = testName;
            keepTestNameInClosure = keepTestNameInClosure;

            const dt = await parseTemplate({
                resources: [
                    resource
                ]
            });
            // tslint:disable-next-line: no-non-null-assertion
            const info = getResourceInfo(dt.topLevelScope.rootObject!.getPropertyValue('resources')!.asArrayValue!.elements[0]!.asObjectValue!)!;
            const actual = info.getFriendlyName({ fullResourceName: true });
            assert.strictEqual(actual, expectedWithLongName);
        });
    }

    suite("displayName", () => {

        createFriendlyNameTest(
            "use displayName if exists",
            {
                name: 'resource1',
                type: 'Microsoft.abc/def',
                tags: {
                    displayName: 'my display name'
                }
            },
            'my display name (def)',
            'my display name (def)'
        );

        createFriendlyNameTest(
            "bad displayname - don't use",
            {
                name: 'resource1',
                type: 'Microsoft.abc/def',
                // tslint:disable-next-line: no-any
                tags: <any>{
                    displayName: []
                }
            },
            'resource1 (def)',
            'resource1 (def)'
        );

        createFriendlyNameTest(
            "bad tags - don't use",
            {
                name: 'resource1',
                type: 'Microsoft.abc/def',
                // tslint:disable-next-line: no-any
                tags: <any>[
                    {
                        displayName: 'my display name'
                    }]
            },
            'resource1 (def)',
            'resource1 (def)'
        );
    });

    createFriendlyNameTest(
        "expressions",
        {
            name: "[concat(variables('a'), '/', variables('b'))]",
            type: "[concat(variables('c'), '/', variables('d'))]"
        },
        "${b} (${d})",
        "${a}/${b} (${d})"
    );

    createFriendlyNameTest(
        "invalid expressions - will just do simple var/param replacements",
        {
            name: "[concat(variables('a'), '/', parameters('b')]", // missing ")"
            type: "[variables('c'), '/', parameters('d')]" // no func call
        },
        "[concat(${a}, '/', ${b}] ([${c}, '/', ${d}])",
        "[concat(${a}, '/', ${b}] ([${c}, '/', ${d}])"
    );

    createFriendlyNameTest(
        "not built-in concat",
        {
            name: "[concat2(variables('a'), '/', variables('b')]",
            type: "[udf.concat(variables('c'), '/', variables('d'))]"
        },
        "[concat2(${a}, '/', ${b}] ([udf.concat(${c}, '/', ${d})])",
        "[concat2(${a}, '/', ${b}] ([udf.concat(${c}, '/', ${d})])"
    );
});
