import { EventEmitter, InputBoxOptions, MessageItem, OpenDialogOptions, QuickPickItem, Uri } from "vscode";
import { IActionContext, IAzureQuickPickOptions, PromptResult } from "vscode-azureextensionui";

export function getActionContext(): IActionContext {
    return {
        telemetry: {
            measurements: {},
            properties: {},
            suppressAll: true,
            suppressIfSuccessful: true
        },
        errorHandling: {
            issueProperties: {},
            rethrow: false,
            suppressDisplay: true,
            suppressReportIssue: true
        },
        ui: {
            onDidFinishPrompt: new EventEmitter<PromptResult>().event,
            showInputBox: async (options: InputBoxOptions): Promise<string> => {
                throw new Error("Not implemented");
            },
            showQuickPick: async <T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: IAzureQuickPickOptions): Promise<T> => {
                throw new Error("Not implemented");
            },
            showWarningMessage: async <T extends MessageItem>(message: string, ...items: T[]): Promise<T> => {
                throw new Error("Not implemented");
            },
            showOpenDialog: async (options: OpenDialogOptions): Promise<Uri[]> => {
                throw new Error("Not implemented");
            }
        }
    };
}
