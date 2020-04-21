// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ext } from "../extensionVariables";

/**
 * Indents each line of a multi-line string by 'indent' number of spaces
 */
export function indentMultilineString(multilineText: string, indent: number): string {
    const lines = splitIntoLines(multilineText);
    const indentation: string = '\t'.repeat(indent);
    return indentation + lines.join(ext.EOL + indentation);
}

/**
 * Unindents the given multi-line string by the minimum amount of indentation that exists on
 * any given line
 */
export function unindentMultilineString(multilineText: string, ignoreFirstLineWhenCalculatingIndent: boolean = false): string {
    const lines = splitIntoLines(multilineText);
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

function splitIntoLines(multilineText: string): string[] {
    return multilineText.split(/\r\n|\n|\r/);
}
