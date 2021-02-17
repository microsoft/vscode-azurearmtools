// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { EndOfLine, Position, Range, Selection, SnippetString, TextEditor, TextEditorDecorationType, TextEditorEdit, TextEditorOptions, Uri } from "vscode";
import { DeploymentTemplateDoc } from "../../extension.bundle";
import { TextDocumentFake } from "./TextDocumentFake";

class EditBuilder implements TextEditorEdit {
    public constructor(public readonly textEditorFake: TextEditorFake) {
    }

    public replace(location: Selection | Range | Position, value: string): void {
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
    public delete(location: Selection | Range): void {
        throw new Error("Method not implemented.");
    }
    public setEndOfLine(endOfLine: EndOfLine): void {
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

    public viewColumn?: import("vscode").ViewColumn | undefined;
    public async edit(callback: (editBuilder: import("vscode").TextEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean } | undefined): Promise<boolean> {
        const builder = new EditBuilder(this);
        callback(builder);
        return true;
    }

    public insertSnippet(snippet: SnippetString, location?: import("vscode").Range | import("vscode").Position | readonly import("vscode").Position[] | readonly import("vscode").Range[] | undefined, options?: { undoStopBefore: boolean; undoStopAfter: boolean } | undefined): Thenable<boolean> {
        throw new Error("Method not implemented.");
    }
    public setDecorations(decorationType: TextEditorDecorationType, rangesOrOptions: import("vscode").Range[] | import("vscode").DecorationOptions[]): void {
        throw new Error("Method not implemented.");
    }
    public revealRange(range: Range, revealType?: import("vscode").TextEditorRevealType | undefined): void {
        throw new Error("Method not implemented.");
    }
    public show(column?: import("vscode").ViewColumn | undefined): void {
        throw new Error("Method not implemented.");
    }
    public hide(): void {
        throw new Error("Method not implemented.");
    }

}
