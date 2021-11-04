/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as mocha from 'mocha';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as vscode from 'vscode';
import { armTemplateLanguageId, configKeys, configPrefix, ext, stopArmLanguageServer } from "../extension.bundle";
import { displayCacheStatus } from './support/cache';
import { delay } from "./support/delay";
import { publishVsCodeLogs } from './support/publishVsCodeLogs';
import { alwaysEchoTestLog, createTestLog, deleteTestLog, setTestLogOutputFile, testLog, writeToLog, writeToWarning } from './support/testLog';
import { useTestSnippets } from './support/TestSnippets';
import { logsFolder } from './testConstants';
import { useTestFunctionMetadata } from "./TestData";

// tslint:disable:no-console no-function-expression

let previousSettings = {
    autoDetectJsonTemplates: <boolean | undefined>undefined,
    fileAssociations: <{ [key: string]: string }>{}
};

// Runs before all tests
suiteSetup(async function (this: mocha.IHookCallbackContext): Promise<void> {
    // Create logs folder
    if (await fse.pathExists(logsFolder)) {
        rimraf.sync(logsFolder);
    }
    await fse.mkdir(logsFolder);
    setTestLogOutputFile(path.join(logsFolder, "testlog.txt"));

    await displayCacheStatus();
    // await publishCache(path.join(logsFolder, 'pre-cache'));

    // For tests, set up dotnet install path to something unusual to simulate installing with unusual usernames
    process.env.ARM_DOTNET_INSTALL_FOLDER = ".dotnet O'Hare O'Donald";

    // Use test metadata for all tests by default
    useTestFunctionMetadata();
    useTestSnippets();

    ext.addCompletedDiagnostic = true;

    // Just to make it easier to see what's going on
    vscode.commands.executeCommand('workbench.actions.view.problems');

    // Set some configuration settings that are required for the tests to run properly
    writeToLog("Updating user settings");
    // ... autoDetectJsonTemplates (so editor loads with .json/json with our language server)
    previousSettings.autoDetectJsonTemplates = vscode.workspace.getConfiguration(configPrefix).get<boolean>(configKeys.autoDetectJsonTemplates);
    await vscode.workspace.getConfiguration(configPrefix).update(configKeys.autoDetectJsonTemplates, true, vscode.ConfigurationTarget.Global);
    // ... Add {'*.azrm':'arm-template'} to file.assocations (so colorization tests use the correct grammar, since _workbench.captureSyntaxTokens doesn't actually load anything into an editor)
    let fileAssociations = previousSettings.fileAssociations = Object.assign({}, vscode.workspace.getConfiguration('files').get<{}>('associations'));
    console.warn("Old file associations:", fileAssociations);
    let newAssociations = Object.assign({}, fileAssociations, { '*.azrm': armTemplateLanguageId });
    vscode.workspace.getConfiguration('files', null).update('associations', newAssociations, vscode.ConfigurationTarget.Global);

    await delay(1000); // Give vscode time to update the setting
    const confirmedNewAssociations = Object.assign({}, vscode.workspace.getConfiguration('files').get<{}>('associations'));
    console.warn("Confirmed new file associations:", confirmedNewAssociations);

    writeToLog('Done: global.test.ts: suiteSetup');
});

// Runs after all tests are done
suiteTeardown(async function (this: mocha.IHookCallbackContext): Promise<void> {
    writeToLog('Done: global.test.ts: suiteTeardown');

    await displayCacheStatus();
    // await publishCache(path.join(logsFolder, 'post-cache'));

    await publishVsCodeLogs('ms-dotnettools.vscode-dotnet-runtime');
    await publishVsCodeLogs(path.basename(ext.context.logPath));
    await publishVsCodeLogs(undefined);

    /* Restoring settings doesn't seem to work anymore
    writeToLog('Restoring settings');
    vscode.workspace.getConfiguration(configPrefix).update(configKeys.autoDetectJsonTemplates, previousSettings.autoDetectJsonTemplates, vscode.ConfigurationTarget.Global);
    delete previousSettings.fileAssociations["*.azrm"];
    await vscode.workspace.getConfiguration('file').update('assocations', previousSettings.fileAssociations, vscode.ConfigurationTarget.Global);
    await delay(1000);
    const confirmedNewAssociations = Object.assign({}, vscode.workspace.getConfiguration('files').get<{}>('associations'));
    console.warn("Confirmed new file associations:", confirmedNewAssociations);
    */

    await stopArmLanguageServer();
    writeToLog("Tests complete.");
});

// Runs before each individual test
setup(function (this: Mocha.IBeforeAndAfterContext): void {
    writeToLog(`Running: ${this.currentTest.title}`);
    createTestLog();
});

// Runs after each individual test
teardown(function (this: Mocha.IBeforeAndAfterContext): void {
    if (!this.currentTest.state || this.currentTest.state === 'failed') {
        if (testLog.toString()) {
            writeToWarning(`Failed: ${this.currentTest.title}`);
        } else {
            writeToWarning(`Failed (test log is empty): ${this.currentTest}`);
        }
    } else {
        let message = `Passed: ${this.currentTest}\n`;
        if (alwaysEchoTestLog) {
            message += `TEST LOG:\n${testLog.toString()}\n`;
            writeToLog(message);
        }
    }

    deleteTestLog();
});
