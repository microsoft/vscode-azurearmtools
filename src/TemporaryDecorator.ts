/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

/**
 * Adds a given decoration to the editor and removes it on dispose
 */
export class TemporaryDecorator implements vscode.Disposable {
    private _isDisposed: boolean = false;

    public constructor(
        public readonly decorationType: vscode.TextEditorDecorationType,
        public readonly editor: vscode.TextEditor,
        ranges: vscode.Range[]
    ) {
        editor.setDecorations(decorationType, ranges);
    }

    public dispose(): void {
        if (this._isDisposed) {
            this._isDisposed = true;
            this.editor.setDecorations(this.decorationType, []);
        }
    }
}
