/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IActionContext, IAzureUserInput } from "@microsoft/vscode-azext-utils";

export function getActionContext(): IActionContext {
    return {
        telemetry: {
            properties: {
                isActivationEvent: 'false',
                lastStep: '',
                result: 'Succeeded',
                stack: '',
                error: '',
                errorMessage: ''
            },
            measurements: {
                duration: 0
            },
            suppressIfSuccessful: false,
            suppressAll: false
        },
        errorHandling: {
            suppressDisplay: false,
            rethrow: false,
            issueProperties: {}
        },
        ui: <IAzureUserInput><unknown>undefined,
        valuesToMask: []
    };
}
