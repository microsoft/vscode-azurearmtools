// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { DecorationOptions, EndOfLine, Position, Range, Selection, SnippetString, TextEditor, TextEditorDecorationType, TextEditorEdit, TextEditorOptions, TextEditorRevealType, Uri, ViewColumn } from "vscode";
import { DeploymentTemplateDoc } from "../../extension.bundle";
import { TextDocumentFake } from "./TextDocumentFake";

class EditBuilder implements TextEditorEdit {
    public constructor(public readonly textEditorFake: TextEditorFake) {
    }

    public replace(_location: Selection | Range | Position, _value: string): void {
        throw new Error("Method not implemented.");
    }

    public insert(location: Position, value: string): void {
        const dt = new DeploymentTemplateDoc(this.textEditorFake.document._textBuffer, Uri.file("/template.json"), 0);
        const index = dt.getDocumentCharacterIndex(location.line, location.character);
        const newText =
            this.textEditorFake.document._textBuffer.slice(0, index) +
            value +
            this.textEditorFake.document._textBuffer.slice(index);
        this.textEditorFake.document._textBuffer = newText;
    }

    // tslint:disable-next-line: no-reserved-keywords
    public delete(_location: Selection | Range): void {
        throw new Error("Method not implemented.");
    }
    public setEndOfLine(_endOfLine: EndOfLine): void {
        throw new Error("Method not implemented.");
    }
}

export class TextEditorFake implements TextEditor {
    public constructor(public readonly document: TextDocumentFake) {
    }

    public selection: Selection = new Selection(new Position(0, 0), new Position(0, 0));
    public selections: Selection[] = [];
    public visibleRanges: Range[] = [];
    public options: TextEditorOptions = {
    };

    public viewColumn: ViewColumn = ViewColumn.One;
    public async edit(callback: (editBuilder: TextEditorEdit) => void, _options?: { undoStopBefore: boolean; undoStopAfter: boolean } | undefined): Promise<boolean> {
        const builder = new EditBuilder(this);
        callback(builder);
        return true;
    }

    public insertSnippet(_snippet: SnippetString, _location?: Range | Position | readonly Position[] | readonly Range[] | undefined, _options?: { undoStopBefore: boolean; undoStopAfter: boolean } | undefined): Thenable<boolean> {
        throw new Error("Method not implemented.");
    }
    public setDecorations(_decorationType: TextEditorDecorationType, _rangesOrOptions: Range[] | DecorationOptions[]): void {
        throw new Error("Method not implemented.");
    }
    public revealRange(_range: Range, _revealType?: TextEditorRevealType | undefined): void {
        throw new Error("Method not implemented.");
    }
    public show(_column?: ViewColumn | undefined): void {
        throw new Error("Method not implemented.");
    }
    public hide(): void {
        throw new Error("Method not implemented.");
    }

}
