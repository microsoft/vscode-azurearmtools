/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:promise-function-async // Grandfathered in

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

export let vscodeReporter: TelemetryReporter;

export class Reporter extends vscode.Disposable {
    constructor(ctx: vscode.ExtensionContext) {
        super(() => vscodeReporter.dispose());

        let packageInfo = getPackageInfo(ctx);
        if (packageInfo) {
            vscodeReporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
        }
    }
}

interface IPackageInfo {
    name: string;
    version: string;
    aiKey: string;
}

function getPackageInfo(context: vscode.ExtensionContext): IPackageInfo | undefined {
    // tslint:disable-next-line:non-literal-require
    let extensionPackage = require(context.asAbsolutePath('./package.json'));
    if (extensionPackage) {
        return {
            name: extensionPackage.name,
            version: extensionPackage.version,
            aiKey: extensionPackage.aiKey
        };
    }
    return undefined;
}
