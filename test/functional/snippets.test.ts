// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
const DEBUG_BREAK_AFTER_INSERTING_SNIPPET = false;

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { ITestCallbackContext } from 'mocha';
import * as path from 'path';
import { commands, Diagnostic, Selection, window, workspace } from "vscode";
import { DeploymentTemplate, getVSCodePositionFromPosition } from '../../extension.bundle';
import { delay } from '../support/delay';
import { getDiagnosticsForDocument, sources, testFolder } from '../support/diagnostics';
import { getTempFilePath } from "../support/getTempFilePath";
import { testWithLanguageServer } from '../support/testWithLanguageServer';

let resourceTemplate: string = `{
    "resources": [
        // Insert here: resource
    ],
    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "variables": {
        // Insert here: variable
    },
    "parameters": {
        // Insert here: parameter
    },
    "outputs": {
        // Insert here: output
    },
    "functions": [{
        "namespace": "udf",
        "members": {
            // Insert here: user function
        }
    }]
}`;

let emptyTemplate: string = `
// Insert here: empty
`;

//
// These provide some snippet-specific instructions that can't be handled by the general test logic
//

const overrideSkipTests: { [name: string]: boolean } = {
    "Azure Resource Manager (ARM) Template": true, // TODO: Blocked by https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1005573
    "Azure Resource Manager (ARM) Parameters Template": true, // TODO: Blocked by https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1005573

    "Tag Section": true // Needs comma for no errors, and not complicated, just ignore
};

const overrideTemplateForSnippet: { [name: string]: string } = {
    // Which template to start with - default is resourceTemplate
    "Azure Resource Manager (ARM) Template": emptyTemplate,
    "Azure Resource Manager (ARM) Parameters Template": emptyTemplate,
    "User Function Namespace": `{
        "resources": [],
        "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "functions": [
            // Insert here: namespace
        ]
    }`
};

const overrideInsertPosition: { [name: string]: string } = {
    // Where to insert the template - default is "Insert here: resource"
    "Azure Resource Manager (ARM) Template": "// Insert here: empty",
    "Azure Resource Manager (ARM) Parameters Template": "// Insert here: empty",
    Variable: "// Insert here: variable",
    Parameter: "// Insert here: parameter",
    Output: "// Insert here: output",
    "User Function": "// Insert here: user function",
    "User Function Namespace": "// Insert here: namespace"
};

const overrideExpectedDiagnostics: { [name: string]: string[] } = {
    // Expected errors/warnings - default is none
    "Azure Resource Manager (ARM) Parameters Template":
        [
            "Template validation failed: Required property 'resources' not found in JSON. Path '', line 5, position 1."
            //"Missing required property resources"
        ],
    Variable: [
        "The variable 'variable1' is never used."
    ],
    Parameter: [
        "The parameter 'parameter1' is never used."
    ],
    Function: [
        "Undefined variable reference: 'applicationInsightsName'",
        "Template validation failed: The template variable 'applicationInsightsName' is not found. Please see https://aka.ms/arm-template/#variables for usage details."
    ],
    "User Function": [
        "Template validation failed: The template function 'function-name' at line '19' and column '30' is not valid. The function name contains invalid characters '-'. Please see https://aka.ms/arm-template/#functions for usage details.",
        "The user-defined function 'udf.function-name' is never used.",
        "The parameter 'parameter-name' of function 'udf.function-name' is never used."
    ],
    "User Function Namespace": [
        "Template validation failed: The template function at line '7' and column '45' is not valid. The function namespace 'namespace-name' contains invalid characters '-'. Please see https://aka.ms/arm-template/#functions for usage details.",
        "The user-defined function 'namespace-name.function-name' is never used.",
        "The parameter 'parameter-name' of function 'namespace-name.function-name' is never used."
    ],
    "Automation Certificate": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'automationCertificate1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '74' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Credential": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'automationCredential' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '73' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Job Schedule": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'automationJobSchedule1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '74' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Runbook": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'automationRunbook1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '70' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Schedule": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'automationSchedule1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '71' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Variable": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'automationVariable1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '71' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Cosmos DB Mongo Database": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'account-name/mongodb/database-name/collectionName' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '4' and column '74' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "DNS Record": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'dnsRecord1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '50' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Network Security Group Rule": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'networkSecurityGroupRuleName' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '75' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Route Table Route": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'route-name' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '58' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "SQL Database Import": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'sqlDatabase1Import1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '64' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Web Deploy for Web App": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        "Template validation failed: The template resource 'Deploy-webApp1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '52' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Windows Virtual Machine": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012636
        "Template validation failed: The template resource 'windowsVM1' at line '83' and column '9' is not valid: Unable to evaluate template language function 'resourceId': the type 'Microsoft.Storage/storageAccounts' requires '1' resource name argument(s). Please see https://aka.ms/arm-template-expressions/#resourceid for usage details.. Please see https://aka.ms/arm-template-expressions for usage details."
    ]
};

interface ISnippet {
    prefix: string;
    body: string[];
    description?: string;
}

suite("Snippets functional tests", () => {
    suite("all snippets", () => {
        createSnippetTests("armsnippets.jsonc");
    });

    function createSnippetTests(snippetsFile: string): void {
        suite(snippetsFile, () => {
            const snippetsPath = path.join(testFolder, '..', 'assets', snippetsFile);
            const snippets = <{ [name: string]: ISnippet }>fse.readJsonSync(snippetsPath);
            // tslint:disable-next-line:no-for-in forin
            for (let snippetName in snippets) {
                testWithLanguageServer(`snippet: ${snippetName}`, async function (this: ITestCallbackContext): Promise<void> {
                    await testSnippet(this, snippetsPath, snippetName, snippets[snippetName]);
                });
            }
        });
    }

    async function testSnippet(testCallbackContext: ITestCallbackContext, snippetsPath: string, snippetName: string, snippet: ISnippet): Promise<void> {
        if (overrideSkipTests[snippetName]) {
            testCallbackContext.skip();
            return;
        }

        validateSnippet();

        const template = overrideTemplateForSnippet[snippetName] !== undefined ? overrideTemplateForSnippet[snippetName] : resourceTemplate;
        // tslint:disable-next-line: strict-boolean-expressions
        const expectedDiagnostics = (overrideExpectedDiagnostics[snippetName] || []).sort();
        // tslint:disable-next-line: strict-boolean-expressions
        const snippetInsertComment: string = overrideInsertPosition[snippetName] || "// Insert here: resource";
        const snippetInsertIndex: number = template.indexOf(snippetInsertComment);
        assert(snippetInsertIndex >= 0, `Couldn't find location to insert snippet (looking for "${snippetInsertComment}")`);
        const snippetInsertPos = getVSCodePositionFromPosition(new DeploymentTemplate(template, "fake template").getContextFromDocumentCharacterIndex(snippetInsertIndex).documentPosition);

        const tempPath = getTempFilePath(`snippet ${snippetName}`, '.azrm');

        fse.writeFileSync(tempPath, template);

        let doc = await workspace.openTextDocument(tempPath);
        await window.showTextDocument(doc);

        // Wait for first set of diagnostics to finish.
        await getDiagnosticsForDocument(doc, {});
        const initialDocText = window.activeTextEditor!.document.getText();

        // Start waiting for next set of diagnostics (so it picks up the current completion versions)
        let diagnosticsPromise: Promise<Diagnostic[]> = getDiagnosticsForDocument(
            doc,
            {
                waitForChange: true,
                ignoreSources: [sources.schema] //asdf TODO: Don't ignore schema errors
            });

        // Insert snippet
        window.activeTextEditor!.selection = new Selection(snippetInsertPos, snippetInsertPos);
        await delay(1);

        await commands.executeCommand('editor.action.insertSnippet', {
            name: snippetName
        });

        // Wait for diagnostics to finish
        let diagnostics: Diagnostic[] = await diagnosticsPromise;

        if (DEBUG_BREAK_AFTER_INSERTING_SNIPPET) {
            // tslint:disable-next-line: no-debugger
            debugger;
        }

        const docTextAfterInsertion = window.activeTextEditor!.document.getText();
        validateDocumentWithSnippet();

        let messages = diagnostics.map(d => d.message).sort();
        assert.deepStrictEqual(messages, expectedDiagnostics);

        // // NOTE: Even though we request the editor to be closed,
        // // there's no way to request the document actually be closed,
        // //   and when you open it via an API, it doesn't close for a while,
        // //   so the diagnostics won't go away
        // // See https://github.com/Microsoft/vscode/issues/43056
        await commands.executeCommand("undo");
        fse.unlinkSync(tempPath);
        await commands.executeCommand('workbench.action.closeAllEditors');

        // Look for common errors in the snippet
        function validateSnippet(): void {
            const snippetText = JSON.stringify(snippet, null, 4);

            errorIfTextMatches(snippetText, /\$\$/, `Instead of $$ in snippet, use \\$`);
            errorIfTextMatches(snippetText, /\${[^0-9]/, "Snippet placeholder is missing the numeric id, makes it look like a variable to vscode");
        }

        function validateDocumentWithSnippet(): void {
            assert(initialDocText !== docTextAfterInsertion, "No insertion happened?  Document didn't change.");
        }

        function errorIfTextMatches(text: string, regex: RegExp, errorMessage: string): void {
            const match = text.match(regex);
            if (match) {
                assert(false, `${errorMessage}.  At "${text.slice(match.index!, match.index! + 20)}..."`);
            }
        }
    }
});
