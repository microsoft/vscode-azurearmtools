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

const jsonArmGrammarSourcePath: string = path.resolve('grammars', 'JSONC.arm.tmLanguage.json');
const jsonArmGrammarDestPath: string = path.resolve('dist', 'grammars', 'JSONC.arm.tmLanguage.json');

const tleGrammarSourcePath: string = path.resolve('grammars', 'arm-expression-string.tmLanguage.json');
const tleGrammarBuiltPath: string = path.resolve('dist', 'grammars', 'arm-expression-string.tmLanguage.json');

const armConfigurationSourcePath: string = path.resolve('grammars', 'jsonc.arm.language-configuration.json');
const armConfigurationDestPath: string = path.resolve('dist', 'grammars', 'jsonc.arm.language-configuration.json');

interface IGrammar {
    preprocess?: {
        "builtin-functions": string;
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
        "builtin-functions": `(?:(?i)${builtinFunctions.join('|')})`,
        ... (grammarAsObject.preprocess || {})
    };

    grammarAsObject = {
        $comment: `DO NOT EDIT - This file was built from ${path.relative(__dirname, tleGrammarSourcePath)}`,
        ...grammarAsObject
    };

    grammar = JSON.stringify(grammarAsObject, null, 4);

    // Get the replacement keys from the preprocess section (ignore those that start with "$")
    const replacementKeys = Object.getOwnPropertyNames((<IGrammar>JSON.parse(grammar)).preprocess).filter(key => !key.startsWith("$"));

    // Build grammar: Make replacements specified
    for (let key of replacementKeys) {
        let replacementKey = `{{${key}}}`;
        // Re-read value from current grammar contents because the replacement value might contain replacements, too
        let value = JSON.parse(grammar).preprocess[key];
        let valueString = JSON.stringify(value);
        // remove quotes
        valueString = valueString.slice(1, valueString.length - 1);
        if (!sourceGrammar.includes(replacementKey)) {
            console.log(`WARNING: Preprocess key ${replacementKey} is never referenced in ${tleGrammarSourcePath}`);
        }
        grammar = grammar.replace(new RegExp(replacementKey, "g"), valueString);
    }

    // Remove preprocess section from the output grammar file
    let outputGrammarAsObject = (<IGrammar>JSON.parse(grammar));
    delete outputGrammarAsObject.preprocess;
    grammar = JSON.stringify(outputGrammarAsObject, null, 4);

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
    fs.copyFileSync(armConfigurationSourcePath, armConfigurationDestPath);
    console.log(`Copied ${armConfigurationDestPath}`);
}

// tslint:disable-next-line:no-suspicious-comment
// TODO: This is temporary - retrieves binaries from an internal location to package with the extension
async function updateLanguageServer(): Promise<void> {
    // tslint:disable-next-line: max-line-length
    // let armServerBin = path.join(env.ExtensionsBin, '..', '..', 'ARM-LanguageServer', 'Microsoft.ArmLanguageServer', 'bin', 'Debug', 'netcoreapp2.2', 'publish');
    let armServerBin = '\\\\scratch2\\scratch\\stephwe\\ARM\\Dev Assemblies\\Current';
    let updateDest = path.join(__dirname, 'LanguageServerBin');
    if (!fs.existsSync(updateDest)) {
        fs.mkdirSync(updateDest);
    }

    fs.readdirSync(armServerBin).forEach(fn => {
        if (fs.statSync(path.join(armServerBin, fn)).isFile) {
            let src = path.join(armServerBin, fn);
            let dest = path.join(updateDest, fn);
            console.log(`${src} -> ${dest}`);
            fs.copyFileSync(src, dest);
        }
    });
}

exports['webpack-dev'] = gulp.series(() => gulp_webpack('development'), buildGrammars);
exports['webpack-prod'] = gulp.series(() => gulp_webpack('production'), buildGrammars);
exports.test = gulp.series(gulp_installAzureAccount, test);
exports['build-grammars'] = buildGrammars;
exports['watch-grammars'] = (): unknown => gulp.watch('grammars/**', buildGrammars);
exports['update-language-server'] = updateLanguageServer;
