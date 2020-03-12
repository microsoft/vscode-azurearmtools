// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

import * as os from 'os';
import { indentMultilineString } from "../../extension.bundle";
import { assert } from "../../src/fixed_assert";
import { removeIndentation } from '../../src/util/multilineStrings';

const EOL = os.EOL;

suite("multilineStrings", () => {
    suite("indentMultilineString", () => {
        function testIndent(testName: string, indent: number, input: string, expected: string): void {
            test(`${testName}, indent=${indent}}`, async () => {
                const indented = indentMultilineString(input, indent);
                assert.equal(indented, expected);
            });
        }

        suite(`empty`, () => {
            testIndent("empty", 0, "", "");
            testIndent("empty", 1, "", " ");
            testIndent("empty", 2, "", "  ");
        });

        suite(`blank lines`, () => {
            testIndent("blank lines 1", 0, `${EOL}`, `${EOL}`);
            testIndent("blank lines 2", 4, `${EOL}`, `    ${EOL}    `);
            testIndent("blank lines 3", 4, `a${EOL}${EOL}b${EOL}`, `    a${EOL}    ${EOL}    b${EOL}    `);
        });

        suite(`multiple lines`, () => {
            testIndent("multiple lines 1", 0, `a${EOL}b`, `a${EOL}b`);
            testIndent("multiple lines 2", 2, `a${EOL}b`, `  a${EOL}  b`);
        });

        suite(`multiple indents`, () => {
            testIndent("multiple indents 1", 0, `a${EOL}  b${EOL}    c`, `a${EOL}  b${EOL}    c`);
            testIndent("multiple indents 2", 2, `a${EOL}  b${EOL}    c`, `  a${EOL}    b${EOL}      c`);
        });
    });

    suite("removeIndentation", () => {
        function testRemoveIndent(testName: string, input: string, expected: string, ignoreFirstLine: boolean = false): void {
            test(`${testName}`, async () => {
                const indented = removeIndentation(input, ignoreFirstLine);
                assert.equal(indented, expected);
            });
        }

        testRemoveIndent("empty", "", "");
        testRemoveIndent("just spaces", "    ", "");
        testRemoveIndent("single line", "abc", "abc");
        testRemoveIndent("single line with spaces", "a b  c", "a b  c");
        testRemoveIndent("single line indented 1", " a b  c", "a b  c");
        testRemoveIndent("single line indented 5", "     a b  c", "a b  c");

        testRemoveIndent("two blank lines", `${EOL}`, `${EOL}`);
        testRemoveIndent("two lines just spaces", `   ${EOL}   `, `${EOL}`);
        testRemoveIndent("two lines just spaces #2", `   ${EOL} `, `  ${EOL}`);
        testRemoveIndent("two lines just spaces #3", ` ${EOL}   `, `${EOL}  `);

        testRemoveIndent("two lines no indentation", `a${EOL}a`, `a${EOL}a`);
        testRemoveIndent("two lines with indentation #1", `  a${EOL}  a`, `a${EOL}a`);
        testRemoveIndent("two lines with indentation #2", `      abc${EOL}  def`, `    abc${EOL}def`);
        testRemoveIndent("two lines with indentation #3", `  a b c${EOL}      def`, `a b c${EOL}    def`);

        testRemoveIndent("blank line in middle", `  a${EOL}${EOL}  b`, `  a${EOL}${EOL}  b`);
        testRemoveIndent("empty line in middle", `  a${EOL}  ${EOL}  b`, `a${EOL}${EOL}b`);

        testRemoveIndent(
            "multiple lines #1",
            `    {
        "abc": {
            "def": "ghi"
        }
    }`,
            `{
    "abc": {
        "def": "ghi"
    }
}`);

        testRemoveIndent(
            "multiple lines #2",
            `        {
            "abc": {
                "def": "ghi"
            }
        }`,
            `{
    "abc": {
        "def": "ghi"
    }
}`);

        testRemoveIndent(
            "ignore first line",
            `{
                "abc": "def"
            }`,
            `{
    "abc": "def"
}`,
            true);
    });
});
