// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as vscode from "vscode";
// tslint:disable-next-line:no-duplicate-imports
import { window, workspace } from "vscode";
import { IAzureUserInput } from 'vscode-azureextensionui';
import { DeploymentTemplate, InsertItem, SortType } from '../../extension.bundle';
import { getTempFilePath } from "../support/getTempFilePath";

suite("InsertItem", async (): Promise<void> => {
    function assertTemplate(actual: String, expected: String, textEditor: vscode.TextEditor): void {
        if (textEditor.options.insertSpaces === true) {
            expected = expected.replace(/ {4}/g, ' '.repeat(Number(textEditor.options.tabSize)));
        } else {
            expected = expected.replace(/ {4}/g, '\t');
        }
        if (textEditor.document.eol === vscode.EndOfLine.CRLF) {
            expected = expected.replace(/\n/g, '\r\n');
        }
        assert.equal(actual, expected);
    }

    async function testInsertItem(template: string, expected: String, action: (insertItem: InsertItem, deploymentTemplate: DeploymentTemplate, textEditor: vscode.TextEditor) => Promise<void>, showInputBox: string[], textToInsert: string = ''): Promise<void> {
        test("Tabs CRLF", async () => {
            await testInsertItemWithSettings(template, expected, false, 4, true, action, showInputBox, textToInsert);
        });
        test("Spaces CRLF", async () => {
            await testInsertItemWithSettings(template, expected, true, 4, true, action, showInputBox, textToInsert);
        });
        test("Spaces (2) CRLF", async () => {
            await testInsertItemWithSettings(template, expected, true, 2, true, action, showInputBox, textToInsert);
        });
        test("Spaces LF", async () => {
            await testInsertItemWithSettings(template, expected, true, 4, false, action, showInputBox, textToInsert);
        });
        test("Tabs LF", async () => {
            await testInsertItemWithSettings(template, expected, false, 4, false, action, showInputBox, textToInsert);
        });
        test("Spaces (2) LF", async () => {
            await testInsertItemWithSettings(template, expected, true, 2, false, action, showInputBox, textToInsert);
        });
    }

    async function testInsertItemWithSettings(template: string, expected: String, insertSpaces: boolean, tabSize: number, eolAsCRLF: boolean, action: (insertItem: InsertItem, deploymentTemplate: DeploymentTemplate, textEditor: vscode.TextEditor) => Promise<void>, showInputBox: string[], textToInsert: string = ''): Promise<void> {
        if (eolAsCRLF) {
            template = template.replace(/\n/g, '\r\n');
        }
        if (insertSpaces && tabSize !== 4) {
            template = template.replace(/ {4}/g, ' '.repeat(tabSize));
        }
        const tempPath = getTempFilePath(`insertItem`, '.azrm');
        fse.writeFileSync(tempPath, template);
        let document = await workspace.openTextDocument(tempPath);
        let textEditor = await window.showTextDocument(document);
        let ui = new MockUserInput(showInputBox);
        let insertItem = new InsertItem(ui);
        let deploymentTemplate = new DeploymentTemplate(document.getText(), document.uri.toString());
        await action(insertItem, deploymentTemplate, textEditor);
        await textEditor.edit(builder => builder.insert(textEditor.selection.active, textToInsert));
        const docTextAfterInsertion = document.getText();
        assertTemplate(docTextAfterInsertion, expected, textEditor);
    }

    const totallyEmptyTemplate =
        `{}`;

    suite("Variables", async () => {
        const emptyTemplate =
            `{
    "variables": {}
}`;
        const oneVariableTemplate = `{
    "variables": {
        "variable1": "[resourceGroup()]"
    }
}`;
        const twoVariablesTemplate = `{
    "variables": {
        "variable1": "[resourceGroup()]",
        "variable2": "[resourceGroup()]"
    }
}`;
        const threeVariablesTemplate = `{
    "variables": {
        "variable1": "[resourceGroup()]",
        "variable2": "[resourceGroup()]",
        "variable3": "[resourceGroup()]"
    }
}`;
        suite("Insert one variable", async () => {
            await testInsertItem(emptyTemplate, oneVariableTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Variables, editor), ["variable1"], 'resourceGroup()');
        });
        suite("Insert one more variable", async () => {
            await testInsertItem(oneVariableTemplate, twoVariablesTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Variables, editor), ["variable2"], 'resourceGroup()');
        });
        suite("Insert even one more variable", async () => {
            await testInsertItem(twoVariablesTemplate, threeVariablesTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Variables, editor), ["variable3"], 'resourceGroup()');
        });

        suite("Insert one variable in totally empty template", async () => {
            await testInsertItem(totallyEmptyTemplate, oneVariableTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Variables, editor), ["variable1"], 'resourceGroup()');
        });
    });

    suite("Outputs", async () => {
        const emptyTemplate =
            `{
    "outputs": {}
}`;
        const oneOutputTemplate = `{
    "outputs": {
        "output1": {
            "type": "string",
            "value": "[resourceGroup()]"
        }
    }
}`;
        const twoOutputsTemplate = `{
    "outputs": {
        "output1": {
            "type": "string",
            "value": "[resourceGroup()]"
        },
        "output2": {
            "type": "string",
            "value": "[resourceGroup()]"
        }
    }
}`;
        const threeOutputsTemplate = `{
    "outputs": {
        "output1": {
            "type": "string",
            "value": "[resourceGroup()]"
        },
        "output2": {
            "type": "string",
            "value": "[resourceGroup()]"
        },
        "output3": {
            "type": "string",
            "value": "[resourceGroup()]"
        }
    }
}`;
        suite("Insert one output", async () => {
            await testInsertItem(emptyTemplate, oneOutputTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Outputs, editor), ["output1"], 'resourceGroup()');
        });
        suite("Insert one more variable", async () => {
            await testInsertItem(oneOutputTemplate, twoOutputsTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Outputs, editor), ["output2"], 'resourceGroup()');
        });
        suite("Insert even one more variable", async () => {
            await testInsertItem(twoOutputsTemplate, threeOutputsTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Outputs, editor), ["output3"], 'resourceGroup()');
        });
        suite("Insert one output in totally empty template", async () => {
            await testInsertItem(totallyEmptyTemplate, oneOutputTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Outputs, editor), ["output1"], 'resourceGroup()');
        });
    });
});

class MockUserInput implements IAzureUserInput {
    private showInputBoxTexts: string[] = [];
    constructor(showInputBox: string[]) {
        this.showInputBoxTexts = Object.assign([], showInputBox);
    }
    public async showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options: import("vscode-azureextensionui").IAzureQuickPickOptions): Promise<T> {
        let result = await items;
        return result[0];
    }

    public async showInputBox(options: vscode.InputBoxOptions): Promise<string> {
        return this.showInputBoxTexts.pop()!;
    }

    public async showWarningMessage<T extends vscode.MessageItem>(message: string, options: import("vscode-azureextensionui").IAzureMessageOptions, ...items: T[]): Promise<T> {
        return items[0];
    }

    public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        return [vscode.Uri.file("c:\\some\\path")];
    }
}
