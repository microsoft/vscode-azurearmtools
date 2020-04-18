
import * as vscode from 'vscode';
import { DeploymentTemplate } from './DeploymentTemplate';
import { DefinitionKind } from './INamedDefinition';
import { IReferenceSite } from './PositionContext';
const COMMAND = 'editor.action.rename';
export class RenameCodeActionProvider implements vscode.CodeActionProvider {

    constructor(private action: (document: vscode.TextDocument) => DeploymentTemplate | undefined) {
    }
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.RefactorRewrite
    ];

    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] | undefined {
        let template = this.action(document);
        let position = range.start;
        if (!template) {
            return undefined;
        }
        let pc = template.getContextFromDocumentLineAndColumnIndexes(position.line, position.character, undefined);
        const referenceSiteInfo: IReferenceSite | undefined = pc.getReferenceSiteInfo(true);
        if (!referenceSiteInfo || referenceSiteInfo.definition.definitionKind === DefinitionKind.BuiltinFunction) {
            return;
        }
        const commandAction = this.createCommand();

        return [
            commandAction
        ];
    }

    private createCommand(): vscode.CodeAction {
        const action = new vscode.CodeAction('Rename...', vscode.CodeActionKind.RefactorRewrite);
        action.command = { command: COMMAND, title: 'Rename', tooltip: 'This will rename the parameter.' };
        return action;
    }
}
