// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// https://code.visualstudio.com/api/working-with-extensions/testing-extension#migrating-from-vscode
// https://github.com/microsoft/vscode-extension-samples/blob/main/helloworld-test-sample/src/test/runTest.ts
// https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-test-sample

import { runTests } from '@vscode/test-electron';
import * as path from 'path';

async function main(): Promise<void> {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './index');

        // Download VS Code, unzip it and run the integration test
        await runTests({ extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('Tests failed');
        process.exit(1);
    }
}

// tslint:disable-next-line: no-floating-promises
main();
