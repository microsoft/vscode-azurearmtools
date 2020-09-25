// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as vscode from "vscode";

export function rangeToString(range: vscode.Range | undefined): string {
    if (!range) {
        return "[]";
    } else {
        return `[${range.start.line},${range.start.character}`
            + `-${range.end.line},${range.end.character}]`;
    }
}
