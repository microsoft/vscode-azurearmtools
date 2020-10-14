// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as vscode from 'vscode';
import { PositionContext } from '../documents/positionContexts/PositionContext';
import { getRenameError } from '../util/getRenameError';

const command = 'editor.action.rename';

export class RenameCodeActionProvider implements vscode.CodeActionProvider {

    constructor(private action: (document: vscode.TextDocument, position: vscode.Position) => Promise<PositionContext | undefined>) {
    }

    public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.CodeAction[] | undefined> {
        let pc = await this.action(document, range.start);
        if (!pc) {
            return;
        }
        const referenceSiteInfo = pc.getReferenceSiteInfo(true);
        if (!referenceSiteInfo || getRenameError(referenceSiteInfo)) {
            return;
        }
        return [
            this.createCommand()
        ];
    }

    private createCommand(): vscode.CodeAction {
        const action = new vscode.CodeAction('Rename...', vscode.CodeActionKind.RefactorRewrite);
        action.command = { command: command, title: '' };
        return action;
    }
}
