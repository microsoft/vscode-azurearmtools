// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as os from 'os';

export function indentMultilineString(s: string, indent: number): string {
    return s.replace(/^/mg, ' '.repeat(indent));
}

export function removeIndentation(s: string, ignoreFirstLine: boolean = false): string {
    const lines = s.split(/\r\n|\n/);
    const linesToCalculateIndent = ignoreFirstLine ? lines.slice(1) : lines;
    const minIndent = linesToCalculateIndent.map(getLineIndentation).reduce((previous, current) => Math.min(previous, current), Number.MAX_SAFE_INTEGER);
    const removeFromStart = new RegExp(`^\\s{0,${minIndent}}`, "gm");
    const unindentedLines = lines.map(l => l.replace(removeFromStart, ""));
    return unindentedLines.join(os.EOL);
}

export function getLineIndentation(line: string): number {
    const indentation = line.match(/^\s+/);
    if (!indentation) {
        return 0;
    }

    return indentation[0].length;
}
