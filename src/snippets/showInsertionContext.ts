// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { PositionContext } from "../documents/positionContexts/PositionContext";
import { ext } from "../extensionVariables";

export function showInsertionContext(pc: PositionContext): void {
    const insertionContext = pc.getSnippetInsertionContext(undefined);
    ext.outputChannel.show();
    const context = insertionContext.context ?? '(none)';
    ext.outputChannel.appendLine(`Insertion context at ${pc.documentPosition.line + 1},${pc.documentPosition.column + 1}: ${context}`);

}
