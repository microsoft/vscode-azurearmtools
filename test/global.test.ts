/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import mocha = require("mocha");
import * as path from "path";
import { AzureRMAssets } from "../src/AzureRMAssets";

// tslint:disable:no-console no-function-expression

// Runs before all tests
suiteSetup(async function (this: mocha.IHookCallbackContext): Promise<void> {
    let testMetadata = fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'ExpressionMetadata.test.json'));
    AzureRMAssets.setFunctionsMetadata(JSON.parse(testMetadata.toString()));
    console.log('global.test.ts: suiteSetup');
});

// Runs after all tests
suiteTeardown(async function (this: mocha.IHookCallbackContext): Promise<void> {
    console.log('global.test.ts: suiteTeardown');
});
