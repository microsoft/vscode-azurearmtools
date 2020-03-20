// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template

import { CompletionItem, TextDocument, workspace } from 'vscode';
import { ICompletionsSpyResult } from '../../src/CompletionsSpy';
import { ext } from '../../src/extensionVariables';
import { delay } from '../support/delay';

const defaultTimeout: number = 5000; //asdf 60 * 1000;

export function getEventPromise<T>(
    eventName: string,
    executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void,
    timeout: number = defaultTimeout): Promise<T> {
    // tslint:disable-next-line:promise-must-complete
    return new Promise<T>(
        async (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void): Promise<void> => {
            let completed = false;
            executor(
                (value?: T | PromiseLike<T>) => {
                    completed = true;
                    resolve(value);
                },
                (reason?: unknown) => {
                    completed = true;
                    reject(reason);
                }
            );

            await delay(timeout);
            if (!completed) {
                reject(new Error(`Timed out waiting for event "${eventName}"`));
            }
        });
}

export function getDocumentChangedPromise(document: TextDocument, timeout: number = defaultTimeout): Promise<string> {
    return getEventPromise<string>(
        "onDidChangeTextDocument",
        (resolve, reject) => {
            const disposable = workspace.onDidChangeTextDocument(e => {
                console.warn("changed");
                if (e.document === document) {
                    disposable.dispose();
                    resolve(document.getText());
                }
            });
        },
        timeout);
}

export function getCompletionItemsPromise(document: TextDocument, timeout: number = defaultTimeout): Promise<ICompletionsSpyResult> {
    return getEventPromise(
        "onCompletionItems",
        (resolve, reject) => {
            const disposable = ext.completionItemsSpy.getValue().onCompletionItems(e => {
                if (e.document.documentId.fsPath === document.uri.fsPath) {
                    disposable.dispose();
                    resolve(e);
                }
            });
        },
        timeout);
}

export function getCompletionItemResolutionPromise(item?: CompletionItem, timeout: number = defaultTimeout): Promise<CompletionItem> {
    return getEventPromise(
        "onCompletionItemResolved",
        (resolve, reject) => {
            const disposable = ext.completionItemsSpy.getValue().onCompletionItemResolved(e => {
                if (!item || e === item) {
                    disposable.dispose();
                    resolve(e);
                }
            });
        },
        timeout);
}
