// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

import * as assert from 'assert';
import * as os from 'os';
import { ext, indentMultilineString, unindentMultilineString } from "../../extension.bundle";

for (const eolIndex of [0, 1]) {
    const eolLabel = ['win32', 'Mac/Linux'][eolIndex];
    const EOL = ['\r\n', '\n'][eolIndex];

    suite(`multilineStrings (EOL=${eolLabel})`, () => {

        function escape(s: string): string {
            const phase1 = s.replace(/ /g, '·')
                .replace(/\r/g, '@CR@')
                .replace(/\n/g, '@LF@');
            const phase2 = phase1
                // tslint:disable-next-line: prefer-template
                .replace(/@CR@@LF@/g, '<CR><LF>' + EOL)
                // tslint:disable-next-line: prefer-template
                .replace(/@CR@/g, '<CR>' + EOL)
                // tslint:disable-next-line: prefer-template
                .replace(/@LF@/g, '<LF>' + EOL)
                ;
            return phase2;
        }

        suite("indentMultilineString", () => {
            function testIndent(testName: string, indent: number, input: string, expected: string): void {
                test(`${testName}, indent=${indent}}`, async () => {
                    try {
                        ext.EOL = EOL;

                        const indented = indentMultilineString(input, indent);

                        const indentedEscaped = escape(indented);
                        const expectedEscaped = escape(expected);

                        assert.equal(indentedEscaped, expectedEscaped);
                    } finally {
                        ext.EOL = os.EOL;
                    }
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

        suite("unindentMultilineString", () => {
            function testUnindentMultilineString(testName: string, input: string, expected: string, ignoreFirstLine: boolean = false): void {
                test(`${testName}`, async () => {
                    try {
                        ext.EOL = EOL;

                        const indented = unindentMultilineString(input, ignoreFirstLine);

                        const indentedEscaped = escape(indented);
                        const expectedEscaped = escape(expected);
                        assert.equal(indentedEscaped, expectedEscaped);
                    } finally {
                        ext.EOL = os.EOL;
                    }
                });
            }

            testUnindentMultilineString("empty", "", "");
            testUnindentMultilineString("just spaces", "    ", "");
            testUnindentMultilineString("single line", "abc", "abc");
            testUnindentMultilineString("single line with spaces", "a b  c", "a b  c");
            testUnindentMultilineString("single line indented 1", " a b  c", "a b  c");
            testUnindentMultilineString("single line indented 5", "     a b  c", "a b  c");

            testUnindentMultilineString("two blank lines", `${EOL}`, `${EOL}`);
            testUnindentMultilineString("two lines just spaces", `   ${EOL}   `, `${EOL}`);
            testUnindentMultilineString("two lines just spaces #2", `   ${EOL} `, `  ${EOL}`);
            testUnindentMultilineString("two lines just spaces #3", ` ${EOL}   `, `${EOL}  `);

            testUnindentMultilineString("two lines no indentation", `a${EOL}a`, `a${EOL}a`);
            testUnindentMultilineString("two lines with indentation #1", `  a${EOL}  a`, `a${EOL}a`);
            testUnindentMultilineString("two lines with indentation #2", `      abc${EOL}  def`, `    abc${EOL}def`);
            testUnindentMultilineString("two lines with indentation #3", `  a b c${EOL}      def`, `a b c${EOL}    def`);

            testUnindentMultilineString("blank line in middle", `  a${EOL}${EOL}  b`, `  a${EOL}${EOL}  b`);
            testUnindentMultilineString("empty line in middle", `  a${EOL}  ${EOL}  b`, `a${EOL}${EOL}b`);

            testUnindentMultilineString(
                "multiple lines #1",
                `    {${EOL}` +
                `        "abc": {${EOL}` +
                `            "def": "ghi"${EOL}` +
                `        }${EOL}` +
                `    }`,
                `{${EOL}` +
                `    "abc": {${EOL}` +
                `        "def": "ghi"${EOL}` +
                `    }${EOL}` +
                `}`);

            testUnindentMultilineString(
                "multiple lines #2",
                `        {${EOL}` +
                `            "abc": {${EOL}` +
                `                "def": "ghi"${EOL}` +
                `            }${EOL}` +
                `        }`,
                `{${EOL}` +
                `    "abc": {${EOL}` +
                `        "def": "ghi"${EOL}` +
                `    }${EOL}` +
                `}`);

            testUnindentMultilineString(
                "ignore first line",
                `{${EOL}` +
                `                "abc": "def"${EOL}` +
                `            }`,
                `{${EOL}` +
                `    "abc": "def"${EOL}` +
                `}`,
                true);
        });
    });

}
