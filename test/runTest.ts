// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// This is our "test script" (https://code.visualstudio.com/api/working-with-extensions/testing-extension#advanced-setup-your-own-runner)

// https://code.visualstudio.com/api/working-with-extensions/testing-extension#migrating-from-vscode
// https://github.com/microsoft/vscode-extension-samples/blob/main/helloworld-test-sample/src/test/runTest.ts
// https://github.com/microsoft/vscode-extension-samples/tree/main/helloworld-test-sample

import { runTests } from '@vscode/test-electron';
import * as path from 'path';

async function main(): Promise<void> {
    try {
        // The folder containing the extension manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        console.warn(`extensionDevelopmentPath: ${extensionDevelopmentPath}`);

        // The path to the custom extension test runner script
        // Passed to --extensionTestsPath
        // Relative to this file
        const extensionTestsPath = path.resolve(__dirname, 'index');
        console.warn(`extensionTestsPath: ${extensionTestsPath}`);

        // Download VS Code, unzip it and run the integration test
        // This will call in to our custom test runner (index.ts)
        await runTests({ extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('Tests failed');
        process.exit(1);
    }
}

// tslint:disable-next-line: no-floating-promises
main();
