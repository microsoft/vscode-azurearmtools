/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
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
        },
        ui: {
            onDidFinishPrompt: sinon.stub(),
            showQuickPick: sinon.stub().resolves(),
            showInputBox: sinon.stub(),
            showWarningMessage: sinon.stub(),
            showOpenDialog: sinon.stub(),
        }
    };
}
