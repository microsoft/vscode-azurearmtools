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
import { commands, window, workspace } from "vscode";
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
        if (!insertSpaces) {
            template = template.replace(/ {4}/g, '\t');
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

    async function testResourceSnippet(resourceSnippet: string): Promise<void> {
        const tempPath = getTempFilePath(`insertItem`, '.azrm');
        fse.writeFileSync(tempPath, '');
        let document = await workspace.openTextDocument(tempPath);
        await window.showTextDocument(document);
        let timeout = setTimeout(() => assert.fail(`Invalid resource snippet: ${resourceSnippet}`), 1000);
        await commands.executeCommand('editor.action.insertSnippet', { name: resourceSnippet });
        clearTimeout(timeout);
    }

    const totallyEmptyTemplate =
        `{}`;

    async function doTestInsertItem(startTemplate: string, expectedTemplate: string, type: SortType, showInputBox: string[] = [], textToInsert: string = ''): Promise<void> {
        await testInsertItem(startTemplate, expectedTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, type, editor), showInputBox, textToInsert);
    }

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
            await doTestInsertItem(emptyTemplate, oneVariableTemplate, SortType.Variables, ["variable1"], 'resourceGroup()');
        });
        suite("Insert one more variable", async () => {
            await doTestInsertItem(oneVariableTemplate, twoVariablesTemplate, SortType.Variables, ["variable2"], 'resourceGroup()');
        });
        suite("Insert even one more variable", async () => {
            await doTestInsertItem(twoVariablesTemplate, threeVariablesTemplate, SortType.Variables, ["variable3"], 'resourceGroup()');
        });

        suite("Insert one variable in totally empty template", async () => {
            await doTestInsertItem(totallyEmptyTemplate, oneVariableTemplate, SortType.Variables, ["variable1"], 'resourceGroup()');
        });
    });
    suite("Resources", async () => {
        const emptyTemplate =
            `{
    "resources": []
}`;
        const oneResourceTemplate = `{
    "resources": [
  {
      "name": "storageaccount1",
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2019-06-01",
      "tags": {
          "displayName": "storageaccount1"
      },
      "location": "[resourceGroup().location]",
      "kind": "StorageV2",
      "sku": {
         "name": "Premium_LRS",
         "tier": "Premium"
       }
  }      ]
}`;

        suite("Insert one resource (Storage Account)", async () => {
            test("Spaces CRLF", async () => {
                await testInsertItemWithSettings(emptyTemplate, oneResourceTemplate, true, 4, true, async (insertItem, template, editor) => await insertItem.insertItem(template, SortType.Resources, editor), ["Storage Account"]);
            });
        });

        suite("Resource snippets", async () => {
            test("Verify all snippets used by Insert Resource", async () => {
                let insertItem = new InsertItem(new MockUserInput([]));
                for (const snippet of insertItem.getResourceSnippets()) {
                    await testResourceSnippet(snippet.label);
                }
            });
        });
    });

    suite("Functions", async () => {
        const emptyTemplate =
            `{
    "functions": []
}`;
        const namespaceTemplate = `{
    "functions": [
        {
            "namespace": "ns"
        }
    ]
}`;
        const membersTemplate = `{
    "functions": [
        {
            "namespace": "ns",
            "members": {}
        }
    ]
}`;
        const oneFunctionTemplate = `{
    "functions": [
        {
            "namespace": "ns",
            "members": {
                "function1": {
                    "parameters": [
                        {
                            "name": "parameter1",
                            "type": "string"
                        }
                    ],
                    "output": {
                        "type": "string",
                        "value": "[resourceGroup()]"
                    }
                }
            }
        }
    ]
}`;
        const twoFunctionsTemplate = `{
    "functions": [
        {
            "namespace": "ns",
            "members": {
                "function1": {
                    "parameters": [
                        {
                            "name": "parameter1",
                            "type": "string"
                        }
                    ],
                    "output": {
                        "type": "string",
                        "value": "[resourceGroup()]"
                    }
                },
                "function2": {
                    "parameters": [],
                    "output": {
                        "type": "string",
                        "value": "[resourceGroup()]"
                    }
                }
            }
        }
    ]
}`;
        const threeFunctionsTemplate = `{
    "functions": [
        {
            "namespace": "ns",
            "members": {
                "function1": {
                    "parameters": [
                        {
                            "name": "parameter1",
                            "type": "string"
                        }
                    ],
                    "output": {
                        "type": "string",
                        "value": "[resourceGroup()]"
                    }
                },
                "function2": {
                    "parameters": [],
                    "output": {
                        "type": "string",
                        "value": "[resourceGroup()]"
                    }
                },
                "function3": {
                    "parameters": [
                        {
                            "name": "parameter1",
                            "type": "string"
                        },
                        {
                            "name": "parameter2",
                            "type": "bool"
                        }
                    ],
                    "output": {
                        "type": "securestring",
                        "value": "[resourceGroup()]"
                    }
                }
            }
        }
    ]
}`;
        suite("Insert function", async () => {
            await doTestInsertItem(emptyTemplate, oneFunctionTemplate, SortType.Functions, ["ns", "function1", "String", "parameter1", "String", ""], "resourceGroup()");
        });
        suite("Insert one more function", async () => {
            await doTestInsertItem(oneFunctionTemplate, twoFunctionsTemplate, SortType.Functions, ["function2", "String", ""], "resourceGroup()");
        });
        suite("Insert one function in totally empty template", async () => {
            await doTestInsertItem(totallyEmptyTemplate, oneFunctionTemplate, SortType.Functions, ["ns", "function1", "String", "parameter1", "String", ""], "resourceGroup()");
        });
        suite("Insert function in namespace", async () => {
            await doTestInsertItem(namespaceTemplate, oneFunctionTemplate, SortType.Functions, ["function1", "String", "parameter1", "String", ""], "resourceGroup()");
        });
        suite("Insert function in members", async () => {
            await doTestInsertItem(membersTemplate, oneFunctionTemplate, SortType.Functions, ["function1", "String", "parameter1", "String", ""], "resourceGroup()");
        });
        suite("Insert even one more function", async () => {
            await doTestInsertItem(twoFunctionsTemplate, threeFunctionsTemplate, SortType.Functions, ["function3", "Secure string", "parameter1", "String", "parameter2", "Bool", ""], "resourceGroup()");
        });
    });
    suite("Parameters", async () => {
        const emptyTemplate =
            `{
    "parameters": {}
}`;
        const oneParameterTemplate = `{
    "parameters": {
        "parameter1": {
            "type": "string",
            "defaultValue": "default",
            "metadata": {
                "description": "description"
            }
        }
    }
}`;
        const twoParametersTemplate = `{
    "parameters": {
        "parameter1": {
            "type": "string",
            "defaultValue": "default",
            "metadata": {
                "description": "description"
            }
        },
        "parameter2": {
            "type": "string"
        }
    }
}`;
        const threeParametersTemplate = `{
    "parameters": {
        "parameter1": {
            "type": "string",
            "defaultValue": "default",
            "metadata": {
                "description": "description"
            }
        },
        "parameter2": {
            "type": "string"
        },
        "parameter3": {
            "type": "securestring",
            "metadata": {
                "description": "description3"
            }
        }
    }
}`;
        suite("Insert one parameter", async () => {
            await doTestInsertItem(emptyTemplate, oneParameterTemplate, SortType.Parameters, ["parameter1", "String", "default", "description"]);
        });
        suite("Insert one more parameter", async () => {
            await doTestInsertItem(oneParameterTemplate, twoParametersTemplate, SortType.Parameters, ["parameter2", "String", "", ""]);
        });
        suite("Insert even one more parameter", async () => {
            await doTestInsertItem(twoParametersTemplate, threeParametersTemplate, SortType.Parameters, ["parameter3", "Secure string", "", "description3"]);
        });
        suite("Insert one output in totally empty template", async () => {
            await doTestInsertItem(totallyEmptyTemplate, oneParameterTemplate, SortType.Parameters, ["parameter1", "String", "default", "description"]);
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
            "type": "securestring",
            "value": "[resourceGroup()]"
        }
    }
}`;
        suite("Insert one output", async () => {
            await doTestInsertItem(emptyTemplate, oneOutputTemplate, SortType.Outputs, ["output1", "String"], 'resourceGroup()');
        });
        suite("Insert one more variable", async () => {
            await doTestInsertItem(oneOutputTemplate, twoOutputsTemplate, SortType.Outputs, ["output2", "String"], 'resourceGroup()');
        });
        suite("Insert even one more variable", async () => {
            await doTestInsertItem(twoOutputsTemplate, threeOutputsTemplate, SortType.Outputs, ["output3", "Secure string"], 'resourceGroup()');
        });
        suite("Insert one output in totally empty template", async () => {
            await doTestInsertItem(emptyTemplate, oneOutputTemplate, SortType.Outputs, ["output1", "String"], 'resourceGroup()');
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
        let label = this.showInputBoxTexts.shift()!;
        let item = result.find(x => x.label === label)!;
        return item;
    }

    public async showInputBox(options: vscode.InputBoxOptions): Promise<string> {
        return this.showInputBoxTexts.shift()!;
    }

    public async showWarningMessage<T extends vscode.MessageItem>(message: string, options: import("vscode-azureextensionui").IAzureMessageOptions, ...items: T[]): Promise<T> {
        return items[0];
    }

    public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        return [vscode.Uri.file("c:\\some\\path")];
    }
}
