// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as vscode from "vscode";

export function rangeToString(range: vscode.Range | undefined): string {
    if (!range) {
        return "[]";
    } else {
        // Convert to 1-indexed, which is what is shown in vscode's output window
        return `[${range.start.line + 1},${range.start.character + 1}`
            + `-${range.end.line + 1},${range.end.character + 1}]`;
    }
}

export function positionToString(position: vscode.Position | undefined): string {
    if (!position) {
        return "[]";
    } else {
        // Convert to 1-indexed, which is what is shown in vscode's output window
        return `[${position.line + 1},${position.character + 1}]`;
    }
}
