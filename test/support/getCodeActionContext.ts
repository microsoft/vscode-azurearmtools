import { CodeActionContext } from "vscode";

export function getCodeActionContext(): CodeActionContext {
    return {
        diagnostics: [],
        only: undefined
    };
}
