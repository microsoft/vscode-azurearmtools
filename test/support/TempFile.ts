// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// Support for testing diagnostics in vscode

import * as assert from 'assert';
import * as fs from 'fs';
import { commands, TextDocument, TextEditor, Uri, window, workspace } from 'vscode';
import { getTempFilePath } from './getTempFilePath';

export class TempFile {
    public readonly fsPath: string;
    public readonly shouldDelete: boolean;
    public readonly uri: Uri;

    public static fromContents(contents: string, baseFilename?: string, extension?: string): TempFile {
        return new TempFile({ contents, baseFilename, extension });
    }

    public static fromExistingFile(existingFilePath: string): TempFile {
        assert(fs.existsSync(existingFilePath), `TempFile: Couldn't find path ${existingFilePath}`);
        return new TempFile({ path: existingFilePath });
    }

    private constructor(args: { path: string } | { contents: string; baseFilename?: string; extension?: string }) {
        if ("path" in args) {
            // Use an existing file
            this.fsPath = args.path;
            this.shouldDelete = false;
        } else {
            // Create temp file from contents
            this.fsPath = getTempFilePath(args.baseFilename, args.extension);
            this.shouldDelete = true;

            fs.writeFileSync(this.fsPath, args.contents);
        }

        this.uri = Uri.file(this.fsPath);
    }
    public dispose(): void {
        if (this.shouldDelete && fs.existsSync(this.fsPath)) {
            fs.unlinkSync(this.fsPath);
        }
    }
}

export class TempEditor {
    private _editor: TextEditor | undefined;

    public constructor(public readonly document: TempDocument) {
    }

    public get realEditor(): TextEditor {
        assert(this._editor);
        // tslint:disable-next-line:no-non-null-assertion
        return this._editor!;
    }

    public async open(): Promise<void> {
        if (!this._editor) {
            await this.document.open();
            // tslint:disable-next-line:no-non-null-assertion
            this._editor = await window.showTextDocument(this.document.realDocument!);
        }
    }

    public async dispose(): Promise<void> {
        await this.document.dispose();
    }
}

export class TempDocument {
    private _document: TextDocument | undefined;
    public constructor(public readonly tempFile: TempFile) {
    }

    public get realDocument(): TextDocument {
        assert(this._document);
        // tslint:disable-next-line:no-non-null-assertion
        return this._document!;
    }
    public async open(): Promise<void> {
        if (!this._document) {
            this._document = await workspace.openTextDocument(this.tempFile.fsPath);
        }
    }

    public async dispose(): Promise<void> {
        this.tempFile.dispose();

        // NOTE: Even though we request the editor to be closed,
        // there's no way to request the document actually be closed,
        //   and when you open it via an API, it doesn't close for a while,
        //   so the diagnostics won't go away
        // See https://github.com/Microsoft/vscode/issues/43056
        await commands.executeCommand('workbench.action.closeActiveEditor');
        await commands.executeCommand('workbench.action.closeAllEditors');
    }
}
