/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as mocha from 'mocha';
import * as path from "path";
import * as vscode from 'vscode';
import { AzureRMAssets, configKeys, configPrefix, ext } from "../extension.bundle";
import { languageId } from "../src/constants";
import { delay } from "./support/delay";

// tslint:disable:no-console no-function-expression

let previousSettings = {
    autoDetectJsonTemplates: <boolean | undefined>undefined,
    fileAssociations: <{} | undefined>undefined
};

// Runs before all tests
suiteSetup(async function (this: mocha.IHookCallbackContext): Promise<void> {
    let testMetadata = fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'ExpressionMetadata.test.json'));
    AzureRMAssets.setFunctionsMetadata(testMetadata.toString());

    ext.addCompletionDiagnostic = true;

    // Just to make it easier to see what's going on
    vscode.commands.executeCommand('workbench.actions.view.problems');

    // Set some configuration settings that are required for the tests to run properly
    console.log("Updating user settings");
    // ... autoDetectJsonTemplates (so editor loads with .json/json with our language server)
    previousSettings.autoDetectJsonTemplates = vscode.workspace.getConfiguration(configPrefix).get<boolean>(configKeys.autoDetectJsonTemplates);
    vscode.workspace.getConfiguration(configPrefix).update(configKeys.autoDetectJsonTemplates, true, vscode.ConfigurationTarget.Global);
    vscode.workspace.getConfiguration(configPrefix).update('languageServer.path', 'hello', vscode.ConfigurationTarget.Global);
    // ... Add {'*.azrm':'arm-template'} to file.assocations (so colorization tests use the correct grammar, since _workbench.captureSyntaxTokens doesn't actually load anything into an editor)
    let fileAssociations = previousSettings.fileAssociations = vscode.workspace.getConfiguration('files').get<{}>('associations');
    let newAssociations = Object.assign({}, fileAssociations, { '*.azrm': languageId });
    vscode.workspace.getConfiguration('files', null).update('associations', newAssociations, vscode.ConfigurationTarget.Global);

    await delay(1000); // Give vscode time to update the setting

    console.log('Done: global.test.ts: suiteSetup');
});

// Runs after all tests
suiteTeardown(async function (this: mocha.IHookCallbackContext): Promise<void> {
    console.log('Done: global.test.ts: suiteTeardown');

    console.log('Restoring settings');
    vscode.workspace.getConfiguration(configPrefix).update(configKeys.autoDetectJsonTemplates, previousSettings.autoDetectJsonTemplates, vscode.ConfigurationTarget.Global);
    previousSettings.fileAssociations = vscode.workspace.getConfiguration('file').get<{}>('associations');
    vscode.workspace.getConfiguration('file').update('assocations', previousSettings.fileAssociations, vscode.ConfigurationTarget.Global);
    await delay(1000);
});
