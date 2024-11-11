/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:no-console no-function-expression no-implicit-dependencies

import { parseError } from "@microsoft/vscode-azext-utils";
import * as fse from 'fs-extra';
import * as mocha from 'mocha';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as vscode from 'vscode';
import { armTemplateLanguageId, configKeys, configPrefix, delay, ext, stopArmLanguageServer } from "../extension.bundle";
import { displayCacheStatus } from './support/cache';
import { ensureExtensionHasInitialized } from './support/ensureExtensionHasInitialized';
import { publishVsCodeLogs } from './support/publishVsCodeLogs';
import { alwaysEchoTestLog, deleteTestLog, getTestLogContents, setTestLogOutputFile, writeToError, writeToLog } from './support/testLog';
import { useTestSnippets } from './support/TestSnippets';
import { logsFolder } from './testConstants';
import { useTestFunctionMetadata } from "./TestData";

let previousSettings = {
    autoDetectJsonTemplates: <boolean | undefined>undefined,
    fileAssociations: <{ [key: string]: string }>{}
};

var _bailed = false;
export function bail(): void {
    _bailed = true;
}

// Runs before all tests
suiteSetup(async function (this: mocha.Context): Promise<void> {
    writeToLog(">>> suiteSetup", true);

    const timeout = 5 * 60 * 1000;
    this.timeout(timeout);

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

    await delay(5 * 1000); // Give vscode time to update the setting
    const confirmedNewAssociations = Object.assign({}, vscode.workspace.getConfiguration('files').get<{}>('associations'));
    console.warn("Confirmed new file associations:", confirmedNewAssociations);

    await ensureExtensionHasInitialized(timeout * 0.95);

    writeToLog('Done: global.test.ts: suiteSetup');
});

// Runs after all tests are done
suiteTeardown(async function (this: mocha.Context): Promise<void> {
    writeToLog('suiteTeardown', true);

    await displayCacheStatus();
    // await publishCache(path.join(logsFolder, 'post-cache'));

    if (ext.extensionStartupComplete) {
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
        writeToLog("Tests complete.", true);
    } else {
        console.warn("Cannot publish logs because extension context is not available (startup didn't complete)");
    }
});

// Runs before each individual test
setup(function (this: mocha.Context): void {
    writeToLog(`Running test: ${this.currentTest!.title}`, true);
});

// Runs after each individual test
teardown(function (this: Mocha.Context): void {
    let message: string;
    const failed = (!this.currentTest!.state || this.currentTest!.state === 'failed');

    if (failed) {
        if (getTestLogContents()) {
            message = `Test Failed: ${this.currentTest!.title}:`;
            message += `\n  ${parseError(this.currentTest?.err).message}`;
        } else {
            message = `Test Failed: (test log is empty): ${this.currentTest!.title}`;
            message += `\n  ${parseError(this.currentTest?.err).message}`;
        }
    } else {
        message = `Test passed: ${this.currentTest!.title}\n`;
    }

    if (alwaysEchoTestLog) {
        message += `TEST LOG:\n${getTestLogContents()}\n`;
    }

    if (failed) {
        writeToError(message);
    } else {
        writeToLog(message);
    }

    if (_bailed || this.currentTest!.timedOut || parseError(this.currentTest?.err).message.match(/timed/i)) {
        throw new Error(`A test timed out ('${this.currentTest!.title}'), so exiting out of the rest of the tests because tests tend to be unstable after a timeout`);
    }

    deleteTestLog();
});
