/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:max-func-body-length no-console cyclomatic-complexity max-line-length prefer-template non-literal-fs-path

// Turn on to overwrite results files rather than creating new ".txt.actual" files when there are differences.
const OVERWRITE = false;

import * as assert from 'assert';
import * as fs from 'fs';
import { ISuiteCallbackContext, ITestCallbackContext } from 'mocha';
import * as os from 'os';
import * as path from 'path';
import { commands, Uri } from 'vscode';
import { parseError } from 'vscode-azureextensionui';
import { getTempFilePath } from '../support/getTempFilePath';
import { normalizeString } from '../support/normalizeString';
import { DISABLE_SLOW_TESTS } from '../testConstants';

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

// E.g., change keyword.other.expression.begin.tle.arm-template => {{scope-expression-start}}, according to the preprocess section of the grammar
const tabSize = 20;
let unpreprocess: [RegExp, string][] | undefined;
function unpreprocessScopes(scopes: string): string {
    if (!unpreprocess) {
        let source: string = fs.readFileSync(tleGrammarSourcePath).toString();
        let grammar = <IGrammar>JSON.parse(source);
        // tslint:disable-next-line: strict-boolean-expressions
        let preprocess = grammar.preprocess || <{ [key: string]: string }>{};
        unpreprocess = [];
        for (let key of Object.getOwnPropertyNames(preprocess)) {
            if (key.startsWith("scope-")) {
                let value = preprocess[key];
                unpreprocess.push([new RegExp(value.replace('.', '\\.'), "g"), `{{${key}}}`]);
            }
        }
    }

    unpreprocess.forEach(entry => {
        let [regex, replacement] = entry;
        scopes = scopes.replace(regex, replacement);
    });

    return scopes;
}

let longestTestDuration = 0;
async function assertUnchangedTokens(testPath: string, resultPath: string): Promise<void> {
    let start = Date.now();
    try {
        // If the test filename contains ".invalid.", then all testcases in it should have at least one "invalid" token.
        // Otherwise they should contain none.
        let shouldHaveInvalidTokens = !!testPath.match(/\.INVALID\./i);

        // If the test filename contains ".not-arm.", then all testcases in it should not contain any source.json.arm-template tokens.
        // Otherwise they should have at least one.
        let shouldBeArmTemplate = !testPath.match(/\.NOT-ARM\./i);

        let shouldBeExpression = shouldBeArmTemplate && !testPath.match(/\.NOT-EXPR\./i);

        let filePathForReadingTokens = testPath;

        if (shouldBeArmTemplate) {
            // _workbench.captureSyntaxTokens always takes a URL (it can't use the current buffer).
            // If we use the standard .json{,c} extension for the file, it will start out with the
            // json{,c} language ID before we automatically switch it to arm-template. By the time
            // we switch it, it's too late. So we need to use an extension that's actually mapped
            // directly to arm-template.
            filePathForReadingTokens = getTempFilePath(path.basename(testPath), '.azrm');
            fs.writeFileSync(filePathForReadingTokens, fs.readFileSync(testPath));
        }

        let rawData: { c: string; t: string; r: unknown[] }[] | undefined = await commands.executeCommand('_workbench.captureSyntaxTokens', Uri.file(filePathForReadingTokens));
        if (!rawData) {
            throw new Error("_workbench.captureSyntaxTokens failed");
        }

        // Let's use more reasonable property names in our data
        let data: ITokenInfo[] = rawData.map(d => <ITokenInfo>{ text: d.c.trim(), scopes: d.t, colors: d.r })
            .filter(d => d.text !== "");

        // let doc = await workspace.openTextDocument(filePathForReadingTokens);
        // let editor = await window.showTextDocument(doc);

        // let languageId = doc.languageId;
        // let expectedLanguageId = shouldBeArmTemplate ? 'arm-template' : testPath.endsWith('.json') ? 'json' : 'jsonc';
        // if (languageId !== expectedLanguageId) {
        //     throw new Error(`File ${testPath} is getting opened in vscode using language ID '${languageId}' instead of the expected ID '${expectedLanguageId}'.`
        //         + ' Check if your user settings have modified the default file.associations setting.');
        // }

        //commands.executeCommand('workbench.action.closeActiveEditor');

        let testCases: ITestcase[] | undefined;

        // ------------- USAGE TIP ------------
        // If the test filename contains '.full-scope.', then the full scope will be output for each test, otherwise
        //   only the top of the scope stack will be output and compared (easier to compare changes that way).
        let shouldCompareFullScope = !!testPath.match(/\.FULL-SCOPE\./i);

        // ------------- USAGE TIP ------------
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
                let { fullScopeString, text } = getTestcaseResults([{ testString: '', data: data.slice(nBegin) }]);
                assert(false, `Couldn't find end of test string starting here:\\n${text}\n${fullScopeString}`);
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
        // tslint:disable-next-line: strict-boolean-expressions
        testCases = testCases || [<ITestcase>{ data }];

        let { results: testcaseResults, fullScopeString: resultsFullString, shortScopeString: resultsShortString } = getTestcaseResults(testCases);
        let resultsString = shouldCompareFullScope ? resultsFullString : resultsShortString;

        let actualResultPath = `${resultPath}.actual`;
        let resultPathToWriteTo = OVERWRITE ? resultPath : actualResultPath;
        let removeActualResultPath = false;
        if (fs.existsSync(resultPath)) {
            let previousResult = normalizeString(fs.readFileSync(resultPath).toString().trim());
            let isJustDiff = false;

            try {
                for (let testcaseResult of testcaseResults) {
                    if (shouldHaveInvalidTokens) {
                        assert(
                            testcaseResult.includes('invalid.illegal'),
                            "This test's filename contains '.INVALID.', and so should have had at least one invalid token in each testcase result.");
                    } else {
                        assert(
                            !testcaseResult.includes('invalid.illegal'),
                            "This test's filename does not contain '.INVALID.', but at least one testcase in it contains an invalid token (but shouldn't).");
                    }

                    if (shouldBeArmTemplate) {
                        assert(
                            testcaseResult.includes('source.json.arm-template'),
                            // tslint:disable-next-line: max-line-length
                            "This test's filename does not contain '.NOT-ARM.', and so every testcase in it should contain at least one source.json.arm-template token.");
                    } else {
                        assert(
                            !testcaseResult.includes('source.json.arm-template'),
                            "This test's filename contains '.NOT-ARM.', but at least one testcase in it contains an source.json.arm-template token (but shouldn't).");
                    }

                    let isExpression = testcaseResult.includes('meta.expression.tle.arm-template');
                    if (shouldBeExpression) {
                        assert(
                            isExpression,
                            // tslint:disable-next-line: max-line-length
                            "This test's filename does not contain '.NOT-EXPR.', and so every testcase in it should be an ARM expression.");
                    } else {
                        assert(
                            !isExpression,
                            "This test's filename contains '.NOT-EXPR.', but at least one testcase in it contains an ARM expression (but shouldn't).");
                    }
                }

                isJustDiff = true;
                assert.equal(resultsString, previousResult);
                removeActualResultPath = true;
            } catch (e) {
                let nonDiffError = isJustDiff ? "" : `${parseError(e).message}${os.EOL}`;
                writeToResultsFile(resultPathToWriteTo, resultsString, shouldCompareFullScope, resultsFullString);

                if (OVERWRITE) {
                    removeActualResultPath = true;
                    // tslint:disable-next-line: max-line-length
                    throw new Error(`${nonDiffError}*** MODIFIED THE RESULTS FILE (${resultPathToWriteTo}). VERIFY THE CHANGES BEFORE CHECKING IN!`);
                } else {
                    fs.writeFileSync(resultPathToWriteTo, resultsString);
                    throw new Error(`${nonDiffError}*** ACTUAL RESULTS ARE IN (${resultPathToWriteTo}).`);
                }
            }
        } else {
            writeToResultsFile(resultPathToWriteTo, resultsString, shouldCompareFullScope, resultsFullString);
            removeActualResultPath = true;
            throw new Error(`*** NEW RESULTS FILE ${resultPathToWriteTo}`);
        }

        if (removeActualResultPath && fs.existsSync(actualResultPath)) {
            fs.unlinkSync(actualResultPath);
        }
    } finally {
        let stop = Date.now();
        let duration = stop - start;
        console.log(`Test duration: ${duration}`);
        if (duration > longestTestDuration) {
            longestTestDuration = duration;
        }
    }

    function writeToResultsFile(resultPathToWriteTo: string, resultsString: string, shouldCompareFullScope: boolean, resultsFullString: string): void {
        fs.writeFileSync(resultPathToWriteTo, resultsString);
        if (!shouldCompareFullScope) {
            fs.writeFileSync(resultPathToWriteTo + ".full-scope-result.txt", resultsFullString);
        }
    }
}

function getDictionaryNestingLevel(scopes: string): number {
    let matches = scopes.match(/meta\.structure\.dictionary\.value/g);
    return matches ? matches.length : 0;
}

function getTestcaseResults(testCases: ITestcase[]): { text: string; results: string[]; fullScopeString: string; shortScopeString: string } {
    let results = testCases.map((testcase: ITestcase): { short: string; full: string } => {
        let prefix = testcase.testString ? `${testcase.testString}${os.EOL}` : "";

        function getLastScope(scopes: string): string {
            let lastSpaceIndex = scopes.lastIndexOf(" ");
            return lastSpaceIndex > 0 ? scopes.slice(lastSpaceIndex + 1) : scopes;
        }

        function getTestCaseString(full: boolean): string {
            return testcase.data.map(td => {
                let theText = td.text.trim();
                let padding = tabSize - theText.length;
                let scopes = unpreprocessScopes(full ? td.scopes : getLastScope(td.scopes));
                if (padding > 0) {
                    return `${theText}${" ".repeat(padding)}${scopes}`;
                } else {
                    return `${theText}${os.EOL}${" ".repeat(tabSize)}${scopes}`;
                }
            }).join(os.EOL);
        }

        let fullTestCaseString = getTestCaseString(true);
        let shortTestCaseString = getTestCaseString(false);

        return { short: prefix + shortTestCaseString, full: prefix + fullTestCaseString };
    });

    let fullScopeString = results.map(r => r.full).join(`${os.EOL}${os.EOL}`);
    fullScopeString = normalizeString(fullScopeString.trim());

    let shortScopeString = results.map(r => r.short).join(`${os.EOL}${os.EOL}`);
    shortScopeString = normalizeString(shortScopeString.trim());

    let text = normalizeString(testCases.map(tc => tc.data).map((tis: ITokenInfo[]) => tis.map(ti => ti.text).join('')).join(''));

    return { text, results: results.map(r => r.full), fullScopeString, shortScopeString };
}

suite('TLE colorization', function (this: ISuiteCallbackContext): void {
    this.timeout(50000); // I've seen as high as 32s on server (esp the first ARM one), although most are no more than a second or two

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
        if (resultFile.endsWith('.actual') || resultFile.endsWith('.full-scope-result.txt')) {
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
        // tslint:disable-next-line: no-suspicious-comment
        if (testFile.startsWith('TO' + 'DO')) {
            test(testFile);
        } else {
            test(testFile, async function (this: ITestCallbackContext): Promise<void> {
                if (DISABLE_SLOW_TESTS) {
                    this.skip();
                    return;
                }

                // tslint:disable-next-line:no-non-null-assertion
                await assertUnchangedTokens(path.join(testFolder, testFile), path.join(resultsFolder, testToResultFileMap.get(testFile)!));
            });
        }
    });

    test("Check longest test duration", () => {
        console.log(`Longest colorization test duration: ${longestTestDuration / 1000}s`);
    });
});
