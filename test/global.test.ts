/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as fs from "fs";
import * as mocha from 'mocha';
import * as path from "path";
import * as vscode from 'vscode';
import { AzureRMAssets, configKeys, configPrefix, ext } from "../extension.bundle";

// tslint:disable:no-console no-function-expression

// Runs before all tests
suiteSetup(async function (this: mocha.IHookCallbackContext): Promise<void> {
    let testMetadata = fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'ExpressionMetadata.test.json'));
    AzureRMAssets.setFunctionsMetadata(testMetadata.toString());

    ext.addCompletionDiagnostic = true;

    // Just to make it easier to see what's going on
    vscode.commands.executeCommand('workbench.actions.view.problems');

    let autoDetectJsonTemplates = vscode.workspace.getConfiguration(configPrefix).get<boolean>(configKeys.autoDetectJsonTemplates);
    assert(autoDetectJsonTemplates, "armTools.autoDetectJsonTemplates must be true (it's default value) when running the suites");

    console.log('Done: global.test.ts: suiteSetup');
});

// Runs after all tests
suiteTeardown(async function (this: mocha.IHookCallbackContext): Promise<void> {
    console.log('Done: global.test.ts: suiteTeardown');
});
