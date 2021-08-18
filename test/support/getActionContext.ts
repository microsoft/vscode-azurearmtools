import { IActionContext, IAzureUserInput } from "vscode-azureextensionui";

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
        ui: <IAzureUserInput><unknown>undefined,
        valuesToMask: []
    };
}
