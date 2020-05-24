
import * as vscode from 'vscode';
import { Property } from './JSON';
import { Contains } from './Language';
import { PositionContext } from './PositionContext';
import { TemplatePositionContext } from './TemplatePositionContext';
import { getRenameError } from './util/getRenameError';
const command = 'editor.action.rename';
export class RenameCodeActionProvider implements vscode.CodeActionProvider {

    constructor(private action: (document: vscode.TextDocument, position: vscode.Position) => Promise<PositionContext | undefined>) {
    }

    public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.CodeAction[] | undefined> {
        let pc = await this.action(document, range.start) as TemplatePositionContext;
        if (!pc) {
            return;
        }
        const referenceSiteInfo = pc.getReferenceSiteInfo(true);
        if (range.start.line === range.end.line && range.start.character !== range.end.character) {
            let jsonToken = pc.document.getJSONValueAtDocumentCharacterIndex(pc.jsonTokenStartIndex - 1, Contains.extended);
            if (jsonToken instanceof Property) {
                const selectedText = document.getText(range);
                if (pc.jsonValue && jsonToken.value && jsonToken.value.span === pc.jsonValue.span && selectedText && pc.jsonValue.asStringValue?.unquotedValue === selectedText) {
                    return [
                        this.createExtractParameterCommand()
                    ];
                }
            }
        }
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

    private createExtractParameterCommand(): vscode.CodeAction {
        const action = new vscode.CodeAction('Extract Parameter...', vscode.CodeActionKind.RefactorExtract);
        action.command = { command: command, title: '' };
        return action;
    }

}
