/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, TextEditor, TextEditorSelectionChangeEvent, window } from "vscode";

export async function waitForEditorSelectionChanged(editor: TextEditor): Promise<void> {
    // tslint:disable-next-line: typedef
    return new Promise(resolve => {
        let disposable: Disposable | undefined;
        disposable = window.onDidChangeTextEditorSelection((evt: TextEditorSelectionChangeEvent) => {
            if (evt.textEditor === editor) {
                disposable?.dispose();
                resolve();
            }
        });
    });
}
