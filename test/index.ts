/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is our custom "test runner script" (https://code.visualstudio.com/api/working-with-extensions/testing-extension#advanced-setup-your-own-runner)
// TODO: Is this still needed?  Can we just use the built-in test runner and add this code to runTest.ts?

import * as glob from 'glob-promise';
import * as Mocha from 'mocha';
import * as path from 'path';

export const isWebpack: boolean = !!/^(false|0)?$/i.test(process.env.AZCODE_ARM_IGNORE_BUNDLE ?? '');

// tslint:disable-next-line: export-name
export async function run(): Promise<void> {
    const options: Mocha.MochaOptions = {
        ui: 'tdd',
        color: true,
        reporter: 'mocha-multi-reporters',
        reporterOptions: {
            reporterEnabled: 'spec, mocha-junit-reporter',
            mochaJunitReporterReporterOptions: {
                mochaFile: path.resolve(__dirname, '..', '..', 'test-results.xml')
            }
        }
    };

    addEnvVarsToMochaOptions(options);
    console.log(`Mocha options: ${JSON.stringify(options, undefined, 2)}`);

    const mocha = new Mocha(options);

    let files: string[] = await glob('**/**.test.js', { cwd: __dirname });
    files.forEach(f => mocha.addFile(path.resolve(__dirname, f)));

    const failures = await new Promise<number>((resolve): Mocha.Runner => mocha.run(resolve));
    if (failures > 0) {
        throw new Error(`${failures} tests failed.`);
    }
}

function addEnvVarsToMochaOptions(options: Mocha.MochaOptions): void {
    for (const envVar of Object.keys(process.env)) {
        const match: RegExpMatchArray | null = envVar.match(/^mocha_(.+)/i);
        if (match) {
            const [, option] = match;
            let value: string | number = process.env[envVar] ?? '';
            if (typeof value === 'string' && !isNaN(parseInt(value))) {
                value = parseInt(value);
            }

            if (envVar.toLowerCase() === 'mocha_grep' && typeof value === 'string') {
                if (value !== '' && value[0] !== '/') {
                    value = `/${value}/i`;
                }
            }

            (<{ [key: string]: unknown }>options)[option] = value;
        }
    }
}

if (isWebpack) {
    const originalRequire = module.constructor.prototype.require;
    module.constructor.prototype.require = function (path: string) {
        testPath(path);
        try {
            var path = require.resolve(path);
            testPath(path);
        } catch (e) {
        }
        return originalRequire.apply(this, arguments);

        function testPath(path: string): void {
            if (/vscode-azurearmtools[/\\]out[/\\]/.test(path)) {
                throw new Error("Trying to run code outside of the webpack bundle: " + path + ".  See comments in extension.bundle.ts for more information.");
            }
        }
    }
}
