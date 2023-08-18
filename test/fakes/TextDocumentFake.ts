// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { EndOfLine, Position, Range, TextDocument, TextLine, Uri } from "vscode";
import { DeploymentTemplateDoc, ext } from "../../extension.bundle";

export class TextDocumentFake implements TextDocument {
    public constructor(
        public _textBuffer: string,
        public readonly uri: Uri
    ) {
        this.fileName = uri.fsPath;
    }

    public readonly fileName: string;
    public isUntitled: boolean = false;
    public languageId: string = "plain-text";
    public version: number = 0;
    public isDirty: boolean = false;
    public isClosed: boolean = false;

    public save(): Thenable<boolean> {
        throw new Error("Method not implemented.");
    }
    public eol: EndOfLine = ext.EOL === '\r\n' ? EndOfLine.CRLF : EndOfLine.LF;

    public get lineCount(): number {
        throw new Error("Method not implemented.");
    }

    public lineAt(line: number): TextLine;
    // tslint:disable-next-line: unified-signatures
    public lineAt(position: Position): TextLine;
    public lineAt(_position: number | Position): TextLine {
        throw new Error("Method not implemented.");
    }
    public offsetAt(_position: Position): number {
        throw new Error("Method not implemented.");
    }
    public positionAt(_offset: number): Position {
        throw new Error("Method not implemented.");
    }
    public getText(range?: Range | undefined): string {
        if (range) {
            const dt = new DeploymentTemplateDoc(this._textBuffer, this.uri, this.version);
            const startIndex = dt.getDocumentCharacterIndex(range.start.line, range.start.character);
            const endIndex = dt.getDocumentCharacterIndex(range.start.line, range.start.character);

            return this._textBuffer.slice(startIndex, endIndex);
        } else {
            return this._textBuffer.slice();
        }
    }
    public getWordRangeAtPosition(_position: Position, _regex?: RegExp | undefined): Range | undefined {
        throw new Error("Method not implemented.");
    }
    public validateRange(_range: Range): Range {
        throw new Error("Method not implemented.");
    }
    public validatePosition(_position: Position): Position {
        throw new Error("Method not implemented.");
    }
}
