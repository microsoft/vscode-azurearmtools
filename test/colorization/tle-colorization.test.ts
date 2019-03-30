/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:max-func-body-length no-console
'use strict';

// Turn on to overwrite results files rather than creating new ".txt.actual" files when there are differences.
const OVERWRITE = true;

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commands, Uri } from 'vscode';

const tleGrammarSourcePath: string = path.join(__dirname, '../../../grammars/arm-expression-string.tmLanguage.json');
export interface IGrammar {
    preprocess?: {
        builtin: string;
        [key: string]: string;
    };
    [key: string]: unknown;
}

interface ITestcase {
    testString?: string;
    data: ITokenInfo[];
}

interface ITokenInfo {
    text: string;
    scopes: string;
    colors: { [key: string]: string }[];
}

const tabSize = 20;
let unpreprocess: [RegExp, string][];

// E.g., change keyword.other.expression.begin.arm-deployment => {{scope-expression-start}}, according to the preprocess section of the grammar
function unpreprocessScopes(scopes: string): string {
    if (!unpreprocess) {
        let source: string = fs.readFileSync(tleGrammarSourcePath).toString();
        let grammar = <IGrammar>JSON.parse(source);
        let preprocess = grammar.preprocess || {};
        unpreprocess = [];
        for (let key of Object.getOwnPropertyNames(preprocess)) {
            let value = preprocess[key];
            unpreprocess.push([new RegExp(value.replace('.', '\\.'), "g"), `{{${key}}}`]);
        }
    }

    unpreprocess.forEach(entry => {
        let [regex, replacement] = entry;
        scopes = scopes.replace(regex, replacement);
    });

    return scopes;
}

async function assertUnchangedTokens(testPath: string, resultPath: string): Promise<void> {
    let rawData = <{ c: string; t: string; r: unknown[] }[]>await commands.executeCommand('_workbench.captureSyntaxTokens', Uri.file(testPath));

    // Let's use more reasonable property names in our data
    let data: ITokenInfo[] = rawData.map(d => <ITokenInfo>{ text: d.c, scopes: d.t, colors: d.r });
    let testCases: ITestcase[];
    let allDataAsString = data.map((d, i) => `${i}: ${d.text} => ${d.scopes}`).join(os.EOL);

    // If the test filename contains ".invalid.", then all testcases in it should have at least one "invalid" token.
    // Otherwise they should contain none.
    let shouldHaveInvalidTokens = testPath.includes('.invalid.');

    // If the test filename contains ".not-arm.", then all testcases in it should not contain any arm-deployment tokens.
    // Otherwise they should have at least one.
    let shouldHaveArmTokens = !testPath.includes('.not-arm.');

    // If the test contains code like this:
    //
    //   "$TEST{xxx}": <test1-text>",
    //   "$TEST{yyy}": <test2-text>"
    //   ...
    // }
    // then only the data for <test1..n-text> will be put into the results file
    const testStartToken = /^\$TEST/;
    for (let iData = 0; iData < data.length; ++iData) {
        // Extract the tokens before the test string
        let nBegin = data.findIndex((t, i) => i >= iData && t.text.match(testStartToken) !== null);
        if (nBegin < 0) {
            break;
        }

        // Skip past the dictionary key
        let dictionaryNestingLevel = getDictionaryNestingLevel(data[nBegin].scopes);
        while (getDictionaryNestingLevel(data[nBegin].scopes) === dictionaryNestingLevel) {
            nBegin++;
        }
        // Skip past the ":" and any whitespace
        assert(data[nBegin].text === ':');
        nBegin++;
        if (data[nBegin].text === ' ') {
            nBegin++;
        }

        // Find the end of the test data - after the dictionary value
        let nEnd = data.findIndex((t, i) =>
            i >= nBegin &&
            // end of the dictionary value item
            getDictionaryNestingLevel(t.scopes) === dictionaryNestingLevel);
        if (nEnd < 0) {
            let { fullString, text } = getTestcaseResults([{ testString: '', data: data.slice(nBegin) }]);
            assert(false, `Couldn't find end of test string starting here:\\n${text}\n${fullString}`);
        }
        nEnd -= 1;

        // Remove the last item if it's comma or }
        if (data[nEnd].text === ',' || data[nEnd].text === '}') {
            --nEnd;
        }

        assert(nEnd >= nBegin);

        if (testCases === undefined) {
            testCases = [];
        }
        let testData = data.slice(nBegin, nEnd + 1);
        let testcase: ITestcase = { testString: `TEST STRING: ${testData.map(d => d.text).join("")}`, data: testData };
        testCases.push(testcase);

        // Skip to look for next set of data
        iData = nEnd;
    }

    // If no individual testcases found, the whole file is a single testcase
    testCases = testCases || [<ITestcase>{ data }];

    let { results: testcaseResults, fullString: resultsFullString } = getTestcaseResults(testCases);

    let actualResultPath = `${resultPath}.actual`;
    let resultPathToWriteTo = OVERWRITE ? resultPath : actualResultPath;
    let removeActualResultPath = false;
    if (fs.existsSync(resultPath)) {
        let previousResult = fs.readFileSync(resultPath).toString().trimRight().replace(/(\r\n)|\r/g, os.EOL);

        try {
            for (let testcaseResult of testcaseResults) {
                if (shouldHaveInvalidTokens) {
                    assert(
                        testcaseResult.includes('invalid.illegal'),
                        "This test's filename contains 'invalid', and so should have had at least one invalid token in each testcase result.");
                } else {
                    assert(
                        !testcaseResult.includes('invalid.illegal'),
                        "This test's filename does not contain 'invalid', but at least one testcase in it contains an invalid token.");
                }

                if (shouldHaveArmTokens) {
                    assert(
                        testcaseResult.includes('arm-deployment'),
                        // tslint:disable-next-line: max-line-length
                        "This test's filename does not contain 'not-arm', and so every testcase in it should contain at least one arm-deployment token.");
                } else {
                    assert(
                        !testcaseResult.includes('arm-deployment'),
                        "This test's filename contains 'not-arm', but at least one testcase in it contains an arm-deployment token.");
                }
            }

            assert.equal(resultsFullString.trimRight(), previousResult.trimRight());
            removeActualResultPath = true;
        } catch (e) {
            fs.writeFileSync(resultPathToWriteTo, resultsFullString, { flag: 'w' });

            console.log(e.message ? e.message : e.toString());

            if (OVERWRITE) {
                removeActualResultPath = true;
                // tslint:disable-next-line: max-line-length
                throw new Error(`*** MODIFIED THE RESULTS FILE (${resultPathToWriteTo}). VERIFY THE CHANGES BEFORE CHECKING IN!`);
            } else {
                fs.writeFileSync(resultPathToWriteTo, resultsFullString, { flag: 'w' });
                throw new Error(`*** ACTUAL RESULTS ARE IN (${resultPathToWriteTo}).`);
            }
        }
    } else {
        fs.writeFileSync(resultPathToWriteTo, resultsFullString);
        removeActualResultPath = true;
        throw new Error(`*** NEW RESULTS FILE ${resultPathToWriteTo}`);
    }

    if (removeActualResultPath && fs.existsSync(actualResultPath)) {
        fs.unlinkSync(actualResultPath);
    }
}

function getDictionaryNestingLevel(scopes: string): number {
    let matches = scopes.match(/meta\.structure\.dictionary\.value/g);
    return matches ? matches.length : 0;
}

function getTestcaseResults(testCases: ITestcase[]): { text: string; results: string[]; fullString: string } {
    let results = testCases.map((testcase: ITestcase) => {
        let prefix = testcase.testString ? `${testcase.testString}${os.EOL}` : "";

        let testCaseString = testcase.data.map(td => {
            let padding = tabSize - td.text.length;
            let scopes = unpreprocessScopes(td.scopes);
            if (padding > 0) {
                return `${td.text}${" ".repeat(padding)}${scopes}`;
            } else {
                return `${td.text}${os.EOL}${" ".repeat(tabSize)}${scopes}`;
            }
        }).join(os.EOL);
        return prefix + testCaseString;
    });

    let fullString = results.join(`${os.EOL}${os.EOL}`);
    fullString = `${fullString.trimRight()}${os.EOL}`;

    let text = testCases.map(tc => tc.data).map((tis: ITokenInfo[]) => tis.map(ti => ti.text).join('')).join('');

    return { text, results, fullString };
}
suite('TLE colorization', () => {
    let testFolder = path.join(__dirname, '..', '..', '..', 'test', 'colorization', 'inputs');
    let resultsFolder = path.join(__dirname, '..', '..', '..', 'test', 'colorization', 'results');

    let testFiles: string[];
    let resultFiles: string[];

    if (!fs.existsSync(testFolder)) {
        throw new Error(`Can't find colorization tests folder ${testFolder}`);
    }
    if (!fs.existsSync(resultsFolder)) {
        fs.mkdirSync(resultsFolder);
    }

    testFiles = fs.readdirSync(testFolder);
    assert(testFiles.length, `Couldn't find any test files in ${testFolder}`);

    resultFiles = fs.readdirSync(resultsFolder);
    for (let resultFile of resultFiles) {
        if (resultFile.endsWith('.actual')) {
            fs.unlinkSync(path.join(resultsFolder, resultFile));
        }
    }
    resultFiles = fs.readdirSync(resultsFolder);

    let testToResultFileMap = new Map<string, string>();
    let orphanedResultFiles = new Set<string>(resultFiles);
    testFiles.forEach(testFile => {
        let resultFile = `${path.basename(testFile)}.txt`;
        testToResultFileMap.set(testFile, resultFile);
        orphanedResultFiles.delete(resultFile);
    });

    orphanedResultFiles.forEach(orphanedFile => {
        test(`ORPHANED: ${orphanedFile}`, () => { throw new Error(`Orphaned result file ${orphanedFile}`); });
    });

    testFiles.forEach(testFile => {
        if (testFile.startsWith('TODO')) {
            test(testFile);
        } else {
            test(testFile, async (): Promise<void> => {
                await assertUnchangedTokens(path.join(testFolder, testFile), path.join(resultsFolder, testToResultFileMap.get(testFile)));
            });
        }
    });
});
