// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: object-literal-key-quotes

import * as assert from 'assert';
import { IPartialDeploymentTemplate } from "./support/diagnostics";
import { replaceInTemplate } from "./support/parseTemplate";
import { stringify } from "./support/stringify";

suite("replaceInTemplate", () => {
    suite("$REPLACE_PROP_LINE$", () => {
        function createTest(
            testName: string,
            template: string | IPartialDeploymentTemplate,
            replacements: { [key: string]: string | { [key: string]: unknown } }, expected: string | IPartialDeploymentTemplate
        ): void {
            test(testName, () => {
                const output: IPartialDeploymentTemplate = replaceInTemplate(template, replacements);
                const outputString = stringify(output);
                const expectedString = stringify(expected);
                assert.equal(outputString, expectedString);
            });
        }

        createTest(
            "replace with empty line",
            {
                "resources": [{
                    "$REPLACE_PROP_LINE$": "abc",
                }]
            },
            {
                abc: ""
            },
            {
                "resources": [{
                }]
            });

        createTest(
            "replace with string",
            {
                "resources": [{
                    "$REPLACE_PROP_LINE$": "abc",
                }]
            },
            {
                abc: '"prop": "value"'
            },
            {
                "resources": [{
                    prop: "value"
                }]
            });

        createTest(
            "replace with single property",
            {
                "resources": [{
                    "$REPLACE_PROP_LINE$": "abc"
                }]
            },
            {
                abc: { "prop1": "value1" }
            },
            {
                "resources": [{
                    prop1: "value1"
                }]
            });

        createTest(
            "replace with two properties, no comma needed",
            {
                "resources": [{
                    "$REPLACE_PROP_LINE$": "abc"
                }]
            },
            {
                abc: { "prop1": "value1", "prop2": ["hi"] }
            },
            {
                "resources": [{
                    prop1: "value1",
                    prop2: ["hi"]
                }]
            });

        createTest(
            "replace with two properties, comma needed",
            {
                "resources": [{
                    "$REPLACE_PROP_LINE$": "abc",
                    "another": "property"
                }]
            },
            {
                abc: { "prop1": "value1", "prop2": ["hi"] }
            },
            {
                "resources": [{
                    prop1: "value1",
                    prop2: ["hi"],
                    "another": "property"
                }]
            });
    });
});
