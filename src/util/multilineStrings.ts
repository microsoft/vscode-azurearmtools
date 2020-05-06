// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as vscode from 'vscode';
import { ext } from "../extensionVariables"; //asdf

export type IFormatTextOptions = {
    insertSpaces: boolean;
    tabSize: number;
};

/*
/** asdf
 * Indents each line of a multi-line string by 'indent' number of spaces
 *
export function indentMultilineString(multilineText: string, indent: number): string { // asdf spaces vs tabs?
    const lines = splitIntoLines(multilineText); //asdf testpoint
    const indentation: string = ' '.repeat(indent); //asdf
    return indentation + lines.join(ext.EOL + indentation);
}
*/

/**
 * Indents each line of a multi-line string by 'indent' number of spaces asdf
 */
export function prependToEachLine(multilineText: string, indentation: string): string { // asdf spaces vs tabs?
    const lines = splitIntoLines(multilineText); //asdf testpoint
    return indentation + lines.join(ext.EOL + indentation);
}

/**
 * Unindents the given multi-line string by the minimum amount of indentation that exists on
 * any given line
 */
export function unindentMultilineString(multilineText: string, ignoreFirstLineWhenCalculatingIndent: boolean = false): string {
    const lines = splitIntoLines(multilineText); //asdf testpoint
    const linesToCalculateIndent = ignoreFirstLineWhenCalculatingIndent ? lines.slice(1) : lines;
    const minIndent = linesToCalculateIndent.map(getLineIndentation).reduce((previous, current) => Math.min(previous, current), Number.MAX_SAFE_INTEGER);
    const removeFromStart = new RegExp(`^\\s{0,${minIndent}}`, "gm");
    const unindentedLines = lines.map(l => l.replace(removeFromStart, ""));
    return unindentedLines.join(ext.EOL);
}

/**
 * Returns the amount of whitespace at the start of the given single line of text
 */
export function getLineIndentation(singleLineText: string): number {
    const indentation = singleLineText.match(/^\s+/);
    if (!indentation) {
        return 0;
    }

    return indentation[0].length;
}

export function formatText(text: string, textEditor: vscode.TextEditor): string;
// tslint:disable-next-line: unified-signatures
export function formatText(text: string, options: IFormatTextOptions): string;
export function formatText(text: string, textEditorOrFormatOptions: vscode.TextEditor | IFormatTextOptions): string {
    const options: IFormatTextOptions = "document" in textEditorOrFormatOptions
        ? <IFormatTextOptions>{
            tabSize: <number>(<vscode.TextEditor>textEditorOrFormatOptions).options.tabSize,
            // tslint:disable-next-line: no-any
            insertSpaces: <boolean><any>(<vscode.TextEditor>textEditorOrFormatOptions).options.insertSpaces
        }
        : <IFormatTextOptions>textEditorOrFormatOptions;

    if (options.insertSpaces) {
        text = text.replace(/\t/g, ' '.repeat(Number(options.tabSize)));
    }
    return text;
}

function splitIntoLines(multilineText: string): string[] {
    return multilineText.split(/\r\n|\n|\r/);
}
