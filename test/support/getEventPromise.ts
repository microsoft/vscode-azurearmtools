// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template

import { TextDocument, workspace } from 'vscode';
import { Completion } from "../../extension.bundle";
import { ext } from '../../src/extensionVariables';
import { delay } from '../support/delay';

export function getEventPromise<T>(
    eventName: string,
    executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void,
    timeout: number = 60000): Promise<T> {
    // tslint:disable-next-line:promise-must-complete
    return new Promise<T>(
        async (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void): Promise<void> => {
            executor(
                resolve,
                reject
            );

            await delay(timeout);
            reject(`Timed out waiting for event "${eventName}"`);
        });
}

export function getDocumentChangedPromise(document: TextDocument, timeout: number = 60000): Promise<string> {
    return getEventPromise<string>(
        "onDidChangeTextDocument",
        (resolve, reject) => {
            const disposable = workspace.onDidChangeTextDocument(e => {
                if (e.document === document) {
                    disposable.dispose();
                    resolve(document.getText());
                }
            });
        });
}

export function getCompletionItemsPromise(document: TextDocument, timeout: number = 60000): Promise<Completion.Item[]> {
    return getEventPromise(
        "onCompletionItems",
        (resolve, reject) => {
            const disposable = ext.completionItemsSpy.onCompletionItems(e => {
                if (e.document.documentId.fsPath === document.uri.fsPath) {
                    disposable.dispose();
                    resolve(e.result);
                }
            });
        });
}
