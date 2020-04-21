
import * as vscode from 'vscode';
import { PositionContext } from './PositionContext';
import { canRename } from './util/canRename';
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
        if (!referenceSiteInfo || canRename(referenceSiteInfo)) {
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
