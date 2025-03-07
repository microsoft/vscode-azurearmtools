// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template

import { CompletionItem, TextDocument, workspace } from 'vscode';
import { delay, ext, ICompletionsSpyResult } from '../../extension.bundle';

const defaultTimeout: number = 200 * 1000;

export function getEventPromise<T>(
    eventName: string,
    executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void,
    timeout: number = defaultTimeout): Promise<T> {
    return new Promise<T>(
        async (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void): Promise<void> => {
            try {
                let completed = false;
                executor(
                    (value: T | PromiseLike<T>) => {
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
                    reject(new TimeoutError(`Timed out waiting for event "${eventName}"`));
                }
            } catch (err) {
                reject(err);
            }
        });
}

export class TimeoutError extends Error {
    public constructor(message: string) {
        super(message);
    }
}

export async function actThenWait<T, U>(action: () => Promise<T> | T, promise: Promise<U>): Promise<U> {
    await action();
    return await promise;
}

export function getDocumentChangedPromise(document: TextDocument, timeout: number = defaultTimeout): Promise<string> {
    return getEventPromise<string>(
        "onDidChangeTextDocument",
        (resolve, reject) => {
            const disposable = workspace.onDidChangeTextDocument(e => {
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
            const disposable = ext.completionItemsSpy.onCompletionItems(e => {
                if (e.document.documentUri.fsPath === document.uri.fsPath) {
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
            const disposable = ext.completionItemsSpy.onCompletionItemResolved(e => {
                if (!item || e === item) {
                    disposable.dispose();
                    resolve(e);
                }
            });
        },
        timeout);
}
