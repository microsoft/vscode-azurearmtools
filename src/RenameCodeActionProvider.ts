
import * as vscode from 'vscode';
import { DefinitionKind } from './INamedDefinition';
import { PositionContext } from './PositionContext';
const COMMAND = 'editor.action.rename';
export class RenameCodeActionProvider implements vscode.CodeActionProvider {

    constructor(private action: (document: vscode.TextDocument, position: vscode.Position) => Promise<PositionContext | undefined>) {
    }

    public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.CodeAction[] | undefined> {
        let pc = await this.action(document, range.start);
        if (!pc) {
            return;
        }
        const referenceSiteInfo = pc.getReferenceSiteInfo(true);
        if (!referenceSiteInfo || referenceSiteInfo.definition.definitionKind === DefinitionKind.BuiltinFunction) {
            return;
        }
        return [
            this.createCommand()
        ];
    }

    private createCommand(): vscode.CodeAction {
        const action = new vscode.CodeAction('Rename...', vscode.CodeActionKind.RefactorRewrite);
        action.command = { command: COMMAND, title: '' };
        return action;
    }
}
