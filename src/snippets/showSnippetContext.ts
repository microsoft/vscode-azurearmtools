// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ext } from "../extensionVariables";
import { PositionContext } from "../PositionContext";

export function showSnippetContext(pc: PositionContext): void {
    const insertionContext = pc.getSnippetInsertionContext(undefined);
    ext.outputChannel.show();
    const context = insertionContext.context ?? '(none)';
    ext.outputChannel.appendLine(`Snippet context at ${pc.documentPosition.line + 1},${pc.documentPosition.column + 1}: ${context}`);

}
