// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from "vscode";
import { IGotoResourcesArgs } from "../../vscodeIntegration/commandArguments";

/**
 * Navigates to the given resource, if only one, else peeks the resources in the editor
 */
export async function gotoResources(actionContext: IActionContext, args: IGotoResourcesArgs): Promise<void> {
    // Set telemetry properties
    Object.assign(actionContext.telemetry.properties, args.telemetryProperties ?? {});

    if (args.targets.length === 1) {
        const target = args.targets[0];
        const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === target.uri.fsPath) {
            editor.revealRange(target.range, vscode.TextEditorRevealType.Default);
            editor.selection = new vscode.Selection(target.range.start, target.range.start);
        }
    } else {
        // Show them like references
        await vscode.commands.executeCommand(
            'editor.action.showReferences',
            args.source.uri,
            args.source.range.start,
            args.targets
        );
    }
}
