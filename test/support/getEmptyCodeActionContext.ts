// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CodeActionContext, CodeActionTriggerKind } from "vscode";

export function getCodeActionContext(): CodeActionContext {
    return {
        diagnostics: [],
        only: undefined,
        triggerKind: CodeActionTriggerKind.Automatic
    };
}
