/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:no-unsafe-any no-console prefer-template no-implicit-dependencies export-name

import * as assert from 'assert';
import * as cp from 'child_process';
import { File } from 'decompress';
import * as fse from 'fs-extra';
import * as glob from 'glob';
import * as gulp from 'gulp';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';
import * as recursiveReadDir from 'recursive-readdir';
import * as shelljs from 'shelljs';
import { Stream } from 'stream';
import { gulp_webpack } from 'vscode-azureextensiondev';
import { langServerDotnetVersion, languageServerFolderName } from './src/constants';
import { getTempFilePath } from './test/support/getTempFilePath';

// tslint:disable:no-require-imports
import decompress = require('gulp-decompress');
import download = require('gulp-download');
import rimraf = require('rimraf');
// tslint:enable:no-require-imports

const filesAndFoldersToPackage: string[] = [
    // NOTE: License.txt and languageServer folder are handled separately so should not be in this list
    'dist',
    'assets',
    'icons',
    'AzureRMTools128x128.png',
    'CHANGELOG.md',
    'main.js',
    'NOTICE.html',
    'node_modules', // Must be present for vsce package to work, but will be ignored during packaging
    'README.md',
    '.vscodeignore'
];

const env = process.env;

// If set, does not delete the staging folder after package (for debugging purposes)
const preserveStagingFolder = !!env.ARMTOOLS_PRESERVE_STAGING_FOLDER;

// Points to a local folder path to retrieve the language server from when packaging (for packaging private builds)
// e.g. export LANGUAGE_SERVER_PACKAGING_PATH=~/repos/ARM-LanguageServer/artifacts/bin/Microsoft.ArmLanguageServer/Debug/netcoreapp3.1
const languageServerPackagingPath = env.LANGUAGE_SERVER_PACKAGING_PATH;

// Official builds will download and include the language server bits (which are licensed differently than the code in the public repo)
const languageServerAvailable = !env.DISABLE_LANGUAGE_SERVER && (languageServerPackagingPath || (!!env.LANGSERVER_NUGET_USERNAME && !!env.LANGSERVER_NUGET_PASSWORD));

const publicLicenseFileName = 'LICENSE.md';
const languageServerLicenseFileName = 'License.txt';
const languageServerVersionEnv = 'npm_package_config_ARM_LANGUAGE_SERVER_NUGET_VERSION'; // Set the value in package.json's config section
const languageServerVersion = env[languageServerVersionEnv];
const languageServerNugetPackage = 'Microsoft.ArmLanguageServer';

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
    env.DEBUGTELEMETRY = 'verbose';
    env.CODE_TESTS_PATH = path.join(__dirname, 'dist/test');
    env.MOCHA_timeout = "120000";
    env.MOCHA_enableTimeouts = "1";
    return cp.spawn('node', ['./node_modules/vscode/bin/test'], { stdio: 'inherit', env });
}

function buildTLEGrammar(): void {
    const sourceGrammar: string = fse.readFileSync(tleGrammarSourcePath).toString();
    let grammar: string = sourceGrammar;
    const expressionMetadataPath: string = path.resolve("assets/ExpressionMetadata.json");
    const expressionMetadata = <IExpressionMetadata>JSON.parse(fse.readFileSync(expressionMetadataPath).toString());

    // Add list of built-in functions from our metadata and place at beginning of grammar's preprocess section
    let builtinFunctions: string[] = expressionMetadata.functionSignatures.map(sig => sig.name);
    let grammarAsObject = <IGrammar>JSON.parse(grammar);
    grammarAsObject.preprocess = {
        "builtin-functions": `(?:(?i)${builtinFunctions.join('|')})`,
        // tslint:disable-next-line: strict-boolean-expressions
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

    fse.writeFileSync(tleGrammarBuiltPath, grammar);
    console.log(`Built ${tleGrammarBuiltPath}`);

    if (grammar.includes('{{')) {
        throw new Error("At least one replacement key could not be found in the grammar - '{{' was found in the final file");
    }
}

async function buildGrammars(): Promise<void> {
    fse.ensureDirSync('dist');
    fse.ensureDirSync('dist/grammars');

    buildTLEGrammar();

    fse.copyFileSync(jsonArmGrammarSourcePath, jsonArmGrammarDestPath);
    console.log(`Copied ${jsonArmGrammarDestPath}`);
    fse.copyFileSync(armConfigurationSourcePath, armConfigurationDestPath);
    console.log(`Copied ${armConfigurationDestPath}`);
}

function executeInShell(command: string): void {
    console.log(command);
    const result = shelljs.exec(command);
    console.log(result.stdout);
    console.log(result.stderr);
    if (result.code !== 0) {
        throw new Error(`Error executing ${command}`);
    }
}

async function getLanguageServer(): Promise<void> {
    if (languageServerAvailable) {
        const pkgsPath = path.join(__dirname, 'pkgs');

        const destPath = path.join(__dirname, languageServerFolderName);

        console.log(`Retrieving language server ${languageServerNugetPackage}@${languageServerVersion}`);

        // Create temporary config file with credentials
        const config = fse.readFileSync(path.join(__dirname, 'NuGet.Config')).toString();
        const withCreds = config.
            // tslint:disable-next-line: strict-boolean-expressions
            replace('$LANGSERVER_NUGET_USERNAME', env.LANGSERVER_NUGET_USERNAME || '').
            // tslint:disable-next-line: strict-boolean-expressions
            replace('$LANGSERVER_NUGET_PASSWORD', env.LANGSERVER_NUGET_PASSWORD || '');
        const configPath = getTempFilePath('nuget', '.config');
        fse.writeFileSync(configPath, withCreds);

        // Nuget install to pkgs folder
        let app = 'nuget';
        const args = [
            'install',
            languageServerNugetPackage,
            '-Version', languageServerVersion,
            '-Framework', `netcoreapp${langServerDotnetVersion}`,
            '-OutputDirectory', 'pkgs',
            //'-Verbosity', 'detailed',
            '-ExcludeVersion', // Keeps the package version from being included in the output folder name
            '-NonInteractive',
            '-ConfigFile', configPath
        ];
        if (os.platform() === 'linux') {
            app = 'mono';
            args.unshift('nuget.exe');
        }
        const command = `${app} ${args.join(' ')}`;
        executeInShell(command);
        fse.unlinkSync(configPath);

        // Copy binaries and license into dist\languageServer
        console.log(`Removing ${languageServerFolderName}`);
        rimraf.sync(languageServerFolderName);

        console.log(`Copying language server binaries to ${languageServerFolderName}`);
        const langServerSourcePath = path.join(pkgsPath, languageServerNugetPackage, 'lib', `netcoreapp${langServerDotnetVersion}`);
        const licenseSourcePath = path.join(pkgsPath, languageServerNugetPackage, languageServerLicenseFileName);

        fse.mkdirpSync(destPath);
        copyFolder(langServerSourcePath, destPath);

        const licenseDest = path.join(languageServerFolderName, languageServerLicenseFileName);
        console.log(`Copying language server license ${licenseSourcePath} to ${licenseDest}`);
        fse.copyFileSync(licenseSourcePath, licenseDest);

        console.log(`Language server binaries and license are in ${languageServerFolderName}`);
    } else {
        console.warn(`Language server not available, skipping packaging of language server binaries.`);
    }
}

function copyFolder(sourceFolder: string, destFolder: string, sourceRoot: string = sourceFolder): void {
    fse.ensureDirSync(destFolder);

    fse.readdirSync(sourceFolder).forEach(fn => {
        let src = path.join(sourceFolder, fn);
        let dest = path.join(destFolder, fn);
        if (fse.statSync(src).isFile()) {
            // console.log(`Copying file ${src} to ${dest}`);
            fse.copyFileSync(src, dest);
        } else if (fse.statSync(src).isDirectory()) {
            copyFolder(src, dest, sourceRoot);
        } else {
            assert("Unexpected path type");
        }
    });
}

async function packageVsix(): Promise<void> {
    // We use a staging folder so we have more control over exactly what goes into the .vsix
    function copyToStagingFolder(relativeOrAbsSource: string, relativeDest: string): void {
        const absSource = path.resolve(__dirname, relativeOrAbsSource);
        const absDest = path.join(stagingFolder, relativeDest);

        if (fse.statSync(absSource).isDirectory()) {
            console.log(`Copying folder ${absSource} to staging folder`);
            copyFolder(absSource, absDest);
        } else {
            console.log(`Copying file ${absSource} to staging folder`);
            fse.copyFileSync(absSource, absDest);
        }
    }

    let stagingFolder = getTempFilePath('staging', '');
    console.log(`Staging folder: ${stagingFolder}`);
    fse.mkdirpSync(stagingFolder);

    // Copy files/folders to staging
    for (let p of filesAndFoldersToPackage) {
        copyToStagingFolder(p, p);
    }
    let filesInStaging = fse.readdirSync(stagingFolder);
    filesInStaging.forEach(fn => assert(!/license/i.test(fn), `Should not have copied the original license file into staging: ${fn}`));

    let expectedLicenseFileName: string;
    if (languageServerAvailable) {
        let languageServerSourcePath: string;
        let licenseSourcePath: string;

        if (languageServerPackagingPath) {
            console.warn(`========== WARNING ==========: Packaging language server from local path instead of NuGet location`);
            languageServerSourcePath = languageServerPackagingPath;
            licenseSourcePath = path.join(languageServerPackagingPath, '../../../../..', languageServerLicenseFileName);
        } else {
            languageServerSourcePath = path.join(__dirname, languageServerFolderName);
            licenseSourcePath = path.join(__dirname, languageServerFolderName, languageServerLicenseFileName);
        }
        console.warn(`  Language server source path: ${languageServerSourcePath}`);
        console.warn(`  License source path: ${licenseSourcePath}`);

        // Copy language server bits
        copyToStagingFolder(languageServerSourcePath, languageServerFolderName);

        // Copy license to staging main folder
        copyToStagingFolder(licenseSourcePath, languageServerLicenseFileName);
        expectedLicenseFileName = languageServerLicenseFileName;
    } else {
        // No language server available - jusy copy license.md to staging main folder
        copyToStagingFolder(publicLicenseFileName, languageServerFolderName);
        expectedLicenseFileName = publicLicenseFileName;
    }

    // Copy package.json to staging
    let packageContents = fse.readJsonSync(path.join(__dirname, 'package.json'));
    assert(packageContents.license, "package.json doesn't contain a license field?");
    // ... modify package.json to point to language server license
    packageContents.license = `SEE LICENSE IN ${expectedLicenseFileName}`;
    // ... remove vscode:prepublish script from package, since everything's already built
    delete packageContents.scripts['vscode:prepublish'];
    fse.writeFileSync(path.join(stagingFolder, 'package.json'), JSON.stringify(packageContents, null, 2));
    assert(fse.readFileSync(path.join(stagingFolder, 'package.json')).toString().includes(`"license": "SEE LICENSE IN ${expectedLicenseFileName}"`), "Language server license not correctly installed into staged package.json");

    try {
        console.log(`Running vsce package in staging folder ${stagingFolder}`);
        shelljs.cd(stagingFolder);
        executeInShell('vsce package --githubBranch main');
    } finally {
        shelljs.cd(__dirname);
    }

    // Copy vsix to current folder
    let vsixName = fse.readdirSync(stagingFolder).find(fn => /\.vsix$/.test(fn));
    if (!vsixName) {
        throw new Error("Couldn't find a .vsix file");
    }
    let vsixDestPath = path.join(__dirname, vsixName);
    if (!languageServerAvailable) {
        vsixDestPath = vsixDestPath.replace('.vsix', '-no-languageserver.vsix');
    }
    if (fse.existsSync(vsixDestPath)) {
        fse.unlinkSync(vsixDestPath);
    }
    fse.copyFileSync(path.join(stagingFolder, vsixName), vsixDestPath);

    // Remove staging folder since packaging was a success
    if (!preserveStagingFolder) {
        rimraf.sync(stagingFolder);
    }

    console.log(`Packaged successfully to ${vsixDestPath}`);
}

// When webpacked, the tests cannot touch any code under src/, or it will end up getting loaded
// twice (because it's also in the bundle), which causes problems with objects that are supposed to
// be singletons.  The test errors are somewhat mysterious, so verify that condition here during build.
async function verifyTestsReferenceOnlyExtensionBundle(testFolder: string): Promise<void> {
    const errors: string[] = [];

    for (let filePath of await recursiveReadDir(testFolder)) {
        await verifyFile(filePath);
    }

    async function verifyFile(file: string): Promise<void> {
        const regex = /import .*['"]\.\.\/(\.\.\/)?src\/.*['"]/mg;
        if (path.extname(file) === ".ts") {
            const contents: string = (await fse.readFile(file)).toString();
            const matches = contents.match(regex);
            if (matches) {
                for (let match of matches) {
                    errors.push(
                        os.EOL +
                        `${path.relative(__dirname, file)}: error: Test code may not import from the src folder, it should import from '../extension.bundle'${os.EOL}` +
                        `  Error is here: ===> ${match}${os.EOL}`
                    );
                    console.error(match);
                }
            }
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }
}

export function gulp_installDotNetExtension(): Promise<void> | Stream {
    const extensionName = '.NET Install Tool for Extension Authors';
    console.log(`Installing ${extensionName}`);
    const version: string = '0.1.0';
    const extensionPath: string = path.join(os.homedir(), `.vscode/extensions/ms-dotnettools.vscode-dotnet-runtime-${version}`);
    console.log(extensionPath);
    const existingExtensions: string[] = glob.sync(extensionPath.replace(version, '*'));
    if (existingExtensions.length === 0) {
        // tslint:disable-next-line:no-http-string
        return download(`http://ms-vscode.gallery.vsassets.io/_apis/public/gallery/publisher/ms-dotnettools/extension/vscode-dotnet-runtime/${version}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`)
            .pipe(decompress({
                filter: (file: File): boolean => file.path.startsWith('extension/'),
                map: (file: File): File => {
                    file.path = file.path.slice(10);
                    return file;
                }
            }))
            .pipe(gulp.dest(extensionPath));
    } else {
        console.log(`${extensionName} already installed.`);
        // We need to signal to gulp that we've completed this async task
        return Promise.resolve();
    }
}

exports['webpack-dev'] = gulp.series(() => gulp_webpack('development'), buildGrammars);
exports['webpack-prod'] = gulp.series(() => gulp_webpack('production'), buildGrammars);
exports.test = gulp.series(gulp_installDotNetExtension, test);
exports['build-grammars'] = buildGrammars;
exports['watch-grammars'] = (): unknown => gulp.watch('grammars/**', buildGrammars);
exports['get-language-server'] = getLanguageServer;
exports.package = packageVsix;
exports['error-vsce-package'] = (): never => { throw new Error(`Please do not run vsce package, instead use 'npm run package`); };
exports['verify-test-uses-extension-bundle'] = (): Promise<void> => verifyTestsReferenceOnlyExtensionBundle(path.resolve("test"));
