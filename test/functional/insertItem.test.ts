// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
import { IAzureUserInput, PromptResult } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as vscode from "vscode";
import { window, workspace } from "vscode";
import { DeploymentTemplateDoc, InsertItem, TemplateSectionType } from '../../extension.bundle';
import { testWithRealSnippets } from '../support/TestSnippets';
import { getActionContext } from '../support/getActionContext';
import { getTempFilePath } from "../support/getTempFilePath";
import { removeApiVersions } from '../support/removeApiVersions';

suite("InsertItem", async (): Promise<void> => {
    function assertTemplate(actual: string, expected: string, textEditor: vscode.TextEditor, options?: { ignoreWhiteSpace?: boolean; ignoreApiVersions?: boolean }): void {
        if (textEditor.options.insertSpaces === true) {
            expected = expected.replace(/ {4}/g, ' '.repeat(Number(textEditor.options.tabSize)));
            if (options?.ignoreWhiteSpace) {
                expected = expected.replace(/ +/g, ' ');
                actual = actual.replace(/ +/g, ' ');
            }
        } else {
            expected = expected.replace(/ {4}/g, '\t');
            if (options?.ignoreWhiteSpace) {
                expected = expected.replace(/\t+/g, '\t');
                actual = actual.replace(/\t+/g, '\t');
            }
        }
        if (textEditor.document.eol === vscode.EndOfLine.CRLF) {
            expected = expected.replace(/\n/g, '\r\n');
        }

        if (options?.ignoreApiVersions) {
            actual = removeApiVersions(actual);
            expected = removeApiVersions(expected);
        }

        assert.strictEqual(actual, expected);
    }

    function testInsertItem(template: string, expected: string, action: (insertItem: InsertItem, deploymentTemplate: DeploymentTemplateDoc, textEditor: vscode.TextEditor) => Promise<void>, showInputBox: string[], textToInsert: string = '', ignoreWhiteSpace: boolean = false): void {
        testWithRealSnippets("Tabs CRLF", async () => {
            await testInsertItemWithSettings(template, expected, false, 4, true, action, showInputBox, textToInsert, ignoreWhiteSpace);
        });
        testWithRealSnippets("Spaces CRLF", async () => {
            await testInsertItemWithSettings(template, expected, true, 4, true, action, showInputBox, textToInsert, ignoreWhiteSpace);
        });
        testWithRealSnippets("Spaces (2) CRLF", async () => {
            await testInsertItemWithSettings(template, expected, true, 2, true, action, showInputBox, textToInsert, ignoreWhiteSpace);
        });
        testWithRealSnippets("Spaces LF", async () => {
            await testInsertItemWithSettings(template, expected, true, 4, false, action, showInputBox, textToInsert, ignoreWhiteSpace);
        });
        testWithRealSnippets("Tabs LF", async () => {
            await testInsertItemWithSettings(template, expected, false, 4, false, action, showInputBox, textToInsert, ignoreWhiteSpace);
        });
        testWithRealSnippets("Spaces (2) LF", async () => {
            await testInsertItemWithSettings(template, expected, true, 2, false, action, showInputBox, textToInsert, ignoreWhiteSpace);
        });
    }

    async function testInsertItemWithSettings(template: string, expected: string, insertSpaces: boolean, tabSize: number, eolAsCRLF: boolean, action: (insertItem: InsertItem, deploymentTemplate: DeploymentTemplateDoc, textEditor: vscode.TextEditor) => Promise<void>, showInputBox: string[], textToInsert: string = '', ignoreWhiteSpace: boolean = false): Promise<void> {
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
        const document = await workspace.openTextDocument(tempPath);
        const textEditor = await window.showTextDocument(document);
        const ui = new MockUserInput(showInputBox);
        const insertItem = new InsertItem(ui);
        const deploymentTemplate = new DeploymentTemplateDoc(document.getText(), document.uri, document.version);
        await action(insertItem, deploymentTemplate, textEditor);
        await textEditor.edit(builder => builder.insert(textEditor.selection.active, textToInsert));
        const docTextAfterInsertion = document.getText();
        assertTemplate(docTextAfterInsertion, expected, textEditor, { ignoreWhiteSpace, ignoreApiVersions: true });
    }

    const totallyEmptyTemplate =
        `{}`;

    function createInsertItemTests(startTemplate: string, expectedTemplate: string, sectionType: TemplateSectionType, showInputBox: string[] = [], textToInsert: string = '', ignoreWhiteSpace: boolean = false): void {
        testInsertItem(startTemplate, expectedTemplate, async (insertItem, template, editor) => await insertItem.insertItem(template, sectionType, editor, getActionContext()), showInputBox, textToInsert, ignoreWhiteSpace);
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
            createInsertItemTests(emptyTemplate, oneVariableTemplate, TemplateSectionType.Variables, ["variable1"], 'resourceGroup()');
        });
        suite("Insert one more variable", async () => {
            createInsertItemTests(oneVariableTemplate, twoVariablesTemplate, TemplateSectionType.Variables, ["variable2"], 'resourceGroup()');
        });
        suite("Insert even one more variable", async () => {
            createInsertItemTests(twoVariablesTemplate, threeVariablesTemplate, TemplateSectionType.Variables, ["variable3"], 'resourceGroup()');
        });
        suite("Insert one variable in totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneVariableTemplate, TemplateSectionType.Variables, ["variable1"], 'resourceGroup()');
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
            "name": "keyVault1/keyVaultSecret1",
            "type": "Microsoft.KeyVault/vaults/secrets",
            "apiVersion": "xxxx-xx-xx",
            "properties": {
                "value": "secretValue"
            }
        }
    ]
}`;
        const twoResourcesTemplate = `{
    "resources": [
        {
            "name": "keyVault1/keyVaultSecret1",
            "type": "Microsoft.KeyVault/vaults/secrets",
            "apiVersion": "xxxx-xx-xx",
            "properties": {
                "value": "secretValue"
            }
        },
        {
            "name": "applicationSecurityGroup1",
            "type": "Microsoft.Network/applicationSecurityGroups",
            "apiVersion": "xxxx-xx-xx",
            "location": "[resourceGroup().location]",
            "tags": {},
            "properties": {}
        }
    ]
}`;

        suite("Insert one resource (KeyVault Secret) into totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneResourceTemplate, TemplateSectionType.Resources, ["KeyVault Secret"], '', true);
        });
        suite("Insert one resource (KeyVault Secret)", async () => {
            createInsertItemTests(emptyTemplate, oneResourceTemplate, TemplateSectionType.Resources, ["KeyVault Secret"], '', true);
        });
        suite("Insert one more resource (Application Security Group)", async () => {
            createInsertItemTests(oneResourceTemplate, twoResourcesTemplate, TemplateSectionType.Resources, ["Application Security Group"], '', true);
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
            createInsertItemTests(emptyTemplate, oneFunctionTemplate, TemplateSectionType.Functions, ["ns", "function1", "String", "parameter1", "String", ""], "resourceGroup()");
        });
        suite("Insert one more function", async () => {
            createInsertItemTests(oneFunctionTemplate, twoFunctionsTemplate, TemplateSectionType.Functions, ["function2", "String", ""], "resourceGroup()");
        });
        suite("Insert one function in totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneFunctionTemplate, TemplateSectionType.Functions, ["ns", "function1", "String", "parameter1", "String", ""], "resourceGroup()");
        });
        suite("Insert function in namespace", async () => {
            createInsertItemTests(namespaceTemplate, oneFunctionTemplate, TemplateSectionType.Functions, ["function1", "String", "parameter1", "String", ""], "resourceGroup()");
        });
        suite("Insert function in members", async () => {
            createInsertItemTests(membersTemplate, oneFunctionTemplate, TemplateSectionType.Functions, ["function1", "String", "parameter1", "String", ""], "resourceGroup()");
        });
        suite("Insert even one more function", async () => {
            createInsertItemTests(twoFunctionsTemplate, threeFunctionsTemplate, TemplateSectionType.Functions, ["function3", "Secure string", "parameter1", "String", "parameter2", "Bool", ""], "resourceGroup()");
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

        const oneParameterTemplateInt = `{
    "parameters": {
        "parameter1": {
            "type": "int",
            "defaultValue": 42
        }
    }
}`;
        const oneParameterTemplateArray = `{
    "parameters": {
        "parameter1": {
            "type": "array",
            "defaultValue": []
        }
    }
}`;
        const oneParameterTemplateBool = `{
    "parameters": {
        "parameter1": {
            "type": "bool",
            "defaultValue": true
        }
    }
}`;
        const oneParameterTemplateObject = `{
    "parameters": {
        "parameter1": {
            "type": "object",
            "defaultValue": {}
        }
    }
}`;
        const oneParameterTemplateSecureObject = `{
    "parameters": {
        "parameter1": {
            "type": "secureobject",
            "defaultValue": {}
        }
    }
}`;
        suite("Insert one parameter", async () => {
            createInsertItemTests(emptyTemplate, oneParameterTemplate, TemplateSectionType.Parameters, ["parameter1", "String", "default", "description"]);
        });
        suite("Insert one more parameter", async () => {
            createInsertItemTests(oneParameterTemplate, twoParametersTemplate, TemplateSectionType.Parameters, ["parameter2", "String", "", ""]);
        });
        suite("Insert even one more parameter", async () => {
            createInsertItemTests(twoParametersTemplate, threeParametersTemplate, TemplateSectionType.Parameters, ["parameter3", "Secure string", "", "description3"]);
        });
        suite("Insert one parameter in totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneParameterTemplate, TemplateSectionType.Parameters, ["parameter1", "String", "default", "description"]);
        });
        suite("Insert one int parameter in totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneParameterTemplateInt, TemplateSectionType.Parameters, ["parameter1", "Int", "42", ""]);
        });
        suite("Insert one array parameter in totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneParameterTemplateArray, TemplateSectionType.Parameters, ["parameter1", "Array", "[]", ""]);
        });
        suite("Insert one bool parameter in totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneParameterTemplateBool, TemplateSectionType.Parameters, ["parameter1", "Bool", "true", ""]);
        });
        suite("Insert one object parameter in totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneParameterTemplateObject, TemplateSectionType.Parameters, ["parameter1", "Object", "{}", ""]);
        });
        suite("Insert one secure object parameter in totally empty template", async () => {
            createInsertItemTests(totallyEmptyTemplate, oneParameterTemplateSecureObject, TemplateSectionType.Parameters, ["parameter1", "Secure object", "{}", ""]);
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
            createInsertItemTests(emptyTemplate, oneOutputTemplate, TemplateSectionType.Outputs, ["output1", "String"], 'resourceGroup()');
        });
        suite("Insert one more output", async () => {
            createInsertItemTests(oneOutputTemplate, twoOutputsTemplate, TemplateSectionType.Outputs, ["output2", "String"], 'resourceGroup()');
        });
        suite("Insert even one more output", async () => {
            createInsertItemTests(twoOutputsTemplate, threeOutputsTemplate, TemplateSectionType.Outputs, ["output3", "Secure string"], 'resourceGroup()');
        });
        suite("Insert one output in totally empty template", async () => {
            createInsertItemTests(emptyTemplate, oneOutputTemplate, TemplateSectionType.Outputs, ["output1", "String"], 'resourceGroup()');
        });
    });
});

// CONSIDER: Switch to using TestUserInput from @microsoft/vscode-azext-dev
class MockUserInput implements IAzureUserInput {
    private showInputBoxTexts: string[] = [];
    private _onDidFinishPromptEmitter: vscode.EventEmitter<PromptResult> = new vscode.EventEmitter<PromptResult>();

    constructor(showInputBox: string[]) {
        this.showInputBoxTexts = Object.assign([], showInputBox);
    }

    public get onDidFinishPrompt(): vscode.Event<PromptResult> {
        return this._onDidFinishPromptEmitter.event;
    }

    public async showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, _options: import("@microsoft/vscode-azext-utils").IAzureQuickPickOptions): Promise<T> {
        const result = await items;
        const label = this.showInputBoxTexts.shift()!;
        const item = result.find(x => x.label === label)!;
        return item;
    }

    public async showInputBox(_options: vscode.InputBoxOptions): Promise<string> {
        return this.showInputBoxTexts.shift()!;
    }

    public async showWarningMessage<T extends vscode.MessageItem>(message: string, options: import("@microsoft/vscode-azext-utils").IAzureMessageOptions, ...items: T[]): Promise<T> {
        return items[0];
    }

    public async showOpenDialog(_options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        return [vscode.Uri.file("c:\\some\\path")];
    }
}
