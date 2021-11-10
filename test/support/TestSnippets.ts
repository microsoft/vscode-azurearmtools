// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ITest, ITestCallbackContext } from 'mocha';
import * as path from 'path';
import { ext, SnippetManager } from "../../extension.bundle";
import { writeToLog } from './testLog';
import { RequiresLanguageServer } from './testWithLanguageServer';
import { ITestPreparation, ITestPreparationResult, testWithPrep } from './testWithPrep';

// By default we use the test snippets for tests
export function useTestSnippets(): void {
    ext.snippetManager.value = new SnippetManager(path.join(__dirname, '..', '..', '..', 'test', 'support', 'TestArmSnippets.jsonc'), undefined); //asdf?
    writeToLog("Installed test snippets");
}

export function useRealSnippets(): void {
    ext.snippetManager.value = SnippetManager.createDefault();
    writeToLog("Installed real snippets");
}

export function useNoSnippets(): void {
    ext.snippetManager.value = new SnippetManager(path.join(__dirname, '..', '..', '..', 'test', 'support', 'EmptySnippets.jsonc'), undefined);
    writeToLog("Installed empty snippet manager");
}

export class UseRealSnippets implements ITestPreparation {
    public static readonly instance: UseRealSnippets = new UseRealSnippets();

    public pretest(this: ITestCallbackContext): ITestPreparationResult {
        useRealSnippets();
        return {
            postTestActions: useTestSnippets
        };
    }
}

export class UseNoSnippets implements ITestPreparation {
    public static readonly instance: UseNoSnippets = new UseNoSnippets();

    public pretest(this: ITestCallbackContext): ITestPreparationResult {
        useNoSnippets();
        return {
            postTestActions: useTestSnippets
        };
    }
}

export function testWithRealSnippets(expectation: string, callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    return testWithPrep(
        expectation,
        [UseRealSnippets.instance, RequiresLanguageServer.instance], // Language server needed for format document
        callback);
}
