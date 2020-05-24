import { IActionContext } from "vscode-azureextensionui";

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
        }
    };
}
