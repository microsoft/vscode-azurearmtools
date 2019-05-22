/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:no-unsafe-any no-console

import * as cp from 'child_process';
import * as fs from 'fs';
import * as gulp from 'gulp';
import * as path from 'path';
import * as process from 'process';

import { gulp_installAzureAccount, gulp_webpack } from 'vscode-azureextensiondev';

const env = process.env;

export const detectionGrammarSourcePath: string = path.resolve('grammars/detect-arm.injection.tmLanguage.json');
export const detectionGrammarDestPath: string = path.resolve('dist/grammars/detect-arm.injection.tmLanguage.json');

export const jsonArmGrammarSourcePath: string = path.resolve('grammars/JSONC.arm.tmLanguage.json');
export const jsonArmGrammarDestPath: string = path.resolve('dist/grammars/JSONC.arm.tmLanguage.json');

export const tleGrammarSourcePath: string = path.resolve('grammars/arm-expression-string.tmLanguage.json');
export const tleGrammarBuiltPath: string = path.resolve('dist/grammars/arm-expression-string.tmLanguage.json');

export interface IGrammar {
    preprocess?: {
        builtin: string;
        [key: string]: string;
    };
    [key: string]: unknown;
}

interface IExpressionMetadata {
    functionSignatures: {
        name: string;
    }[];
}

function test(): cp.ChildProcess {
    env.DEBUGTELEMETRY = '1';
    env.CODE_TESTS_PATH = path.join(__dirname, 'dist/test');
    env.MOCHA_timeout = "4000";
    return cp.spawn('node', ['./node_modules/vscode/bin/test'], { stdio: 'inherit', env });
}

function buildTLEGrammar(): void {
    const sourceGrammar: string = fs.readFileSync(tleGrammarSourcePath).toString();
    let grammar: string = sourceGrammar;
    const expressionMetadataPath: string = path.resolve("assets/ExpressionMetadata.json");
    const expressionMetadata = <IExpressionMetadata>JSON.parse(fs.readFileSync(expressionMetadataPath).toString());

    // Add list of built-in functions from our metadata and place at beginning of grammar's preprocess section
    let builtinFunctions: string[] = expressionMetadata.functionSignatures.map(sig => sig.name);
    let grammarAsObject = <IGrammar>JSON.parse(grammar);
    grammarAsObject.preprocess = {
        builtin: `(?:(?i)${builtinFunctions.join('|')})`,
        ... (grammarAsObject.preprocess || {})
    };
    grammarAsObject = {
        $comment: `DO NOT EDIT - This file was built from ${path.relative(__dirname, tleGrammarBuiltPath)}`,
        ...grammarAsObject
    };
    grammar = JSON.stringify(grammarAsObject, null, 4);
    const replacementKeys = Object.getOwnPropertyNames((<IGrammar>JSON.parse(grammar)).preprocess);

    // Build grammar: Make replacements specified
    for (let key of replacementKeys) {
        let replacementKey = `{{${key}}}`;
        // Re-read value from current grammar contents because the replacement value might contain replacements, too
        let value = JSON.parse(grammar).preprocess[key];
        let valueString = JSON.stringify(value);
        // remove quotes
        valueString = valueString.slice(1, valueString.length - 1);
        if (!sourceGrammar.includes(replacementKey)) {
            console.log(`WARNING: Preprocess key ${replacementKey} not found in ${tleGrammarSourcePath}`);
        }
        grammar = grammar.replace(new RegExp(replacementKey, "g"), valueString);
    }

    fs.writeFileSync(tleGrammarBuiltPath, grammar);
    console.log(`Built ${tleGrammarBuiltPath}`);

    if (grammar.includes('{{')) {
        throw new Error("At least one replacement key could not be found in the grammar - '{{' was found in the final file");
    }
}

async function buildGrammars(): Promise<void> {
    if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist');
    }
    if (!fs.existsSync('dist/grammars')) {
        fs.mkdirSync('dist/grammars');
    }

    buildTLEGrammar();

    fs.copyFileSync(jsonArmGrammarSourcePath, jsonArmGrammarDestPath);
    console.log(`Copied ${jsonArmGrammarDestPath}`);
    fs.copyFileSync(detectionGrammarSourcePath, detectionGrammarDestPath);
    console.log(`Copied ${detectionGrammarDestPath}`);
}

exports['webpack-dev'] = gulp.series(() => gulp_webpack('development'), buildGrammars);
exports['webpack-prod'] = gulp.series(() => gulp_webpack('production'), buildGrammars);
exports.test = gulp.series(gulp_installAzureAccount, test);
exports['build-grammars'] = buildGrammars;
exports['watch-grammars'] = (): unknown => gulp.watch('grammars/**', buildGrammars);
