// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion object-literal-key-quotes

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
const DEBUG_BREAK_AFTER_INSERTING_SNIPPET = false;
const LOG_DOC_TEXT_BEFORE_AND_AFTER_SNIPPET_INSERTION = false;

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { ITestCallbackContext } from 'mocha';
import * as path from 'path';
import * as stripJsonComments from 'strip-json-comments';
import { commands, Selection, Uri, window, workspace } from "vscode";
import { DeploymentTemplateDoc, getVSCodePositionFromPosition, ISnippet, SnippetManager } from '../../extension.bundle';
import { assertEx } from '../support/assertEx';
import { delay } from '../support/delay';
import { diagnosticSources, getDiagnosticsForDocument, IGetDiagnosticsOptions } from '../support/diagnostics';
import { formatDocumentAndWait } from '../support/formatDocumentAndWait';
import { getTempFilePath } from "../support/getTempFilePath";
import { removeComments } from '../support/removeComments';
import { resolveInTestFolder } from '../support/resolveInTestFolder';
import { simulateCompletion } from '../support/simulateCompletion';
import { stringify } from '../support/stringify';
import { testLog } from '../support/testLog';
import { UseRealSnippets } from '../support/TestSnippets';
import { RequiresLanguageServer } from '../support/testWithLanguageServer';
import { testWithPrep } from '../support/testWithPrep';

const resultsFolder = path.join(__dirname, '..', '..', '..', 'test', 'snippets', 'results');
const expectedFolder = path.join(__dirname, '..', '..', '..', 'test', 'snippets', 'expected');

let resourceTemplate: string = `{
\t"resources": [
\t\t//Insert here: resource
\t],
\t"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
\t"contentVersion": "1.0.0.0",
\t"variables": {
\t\t//Insert here: variable
\t},
\t"parameters": {
\t\t//Insert here: parameter
\t},
\t"outputs": {
\t\t//Insert here: output
\t},
\t"functions": [
\t\t{
\t\t\t"namespace": "udf",
\t\t\t"members": {
\t\t\t\t//Insert here: user function
\t\t\t}
\t\t}
\t]
}`;

let emptyTemplate: string = `
//Insert here: empty
`;

//
// These provide some snippet-specific instructions that can't be handled by the general test logic
//

// Snippets marked with true will have their test skipped
const overrideSkipTests: { [name: string]: boolean } = {
    "Tag Section": true, // Needs comma for no errors, and not worth fixing, just ignore
    "Linked Deployment With Relative Path": true, // causes hang on build machine
    "Linked Deployment With URI": true, // causes hang on build machine
};

// Override the template file text to start with before inserting the snippet - default is resourceTemplate
const overrideTemplateForSnippet: { [name: string]: string } = {
    // These are template file templates, so the starting file contents should be empty
    "Azure Resource Manager (ARM) Template": emptyTemplate,
    "Azure Resource Manager (ARM) Template Subscription": emptyTemplate,
    "Azure Resource Manager (ARM) Template Management Group": emptyTemplate,
    "Azure Resource Manager (ARM) Template Tenant": emptyTemplate,

    // This is the params file template, so the starting file contents should be empty
    "Azure Resource Manager (ARM) Parameters Template": emptyTemplate,

    "User Function Namespace": `{
\t"resources": [
\t],
\t"$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
\t"contentVersion": "1.0.0.0",
\t"functions": [
\t\t//Insert here: namespace
\t]
}`,

    "Resource Group": `{
\t"$schema": "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
\t"contentVersion": "1.0.0.0",
\t"resources": [
\t\t//Insert here: resource
\t]
}`,

    "User Function Parameter Definition": `{
    "functions": [
        {
            "namespace": "udf",
            "members": {
                "func1": {
                    "parameters": [
                        //Insert here
                    ],
                    "output": {
                        "type": "string",
                        "value": "myvalue"
                    }
                }
            }
        }
    ]
}`,

};

// Override where to insert the snippet during the test - default is to insert with the "Resources" section, at "Insert here: resource"
const overrideInsertPosition: { [name: string]: string } = {
    "Azure Resource Manager (ARM) Template": "//Insert here: empty",
    "Azure Resource Manager (ARM) Parameters Template": "//Insert here: empty",
    "Azure Resource Manager (ARM) Template Subscription": "//Insert here: empty",
    "Azure Resource Manager (ARM) Template Management Group": "//Insert here: empty",
    "Azure Resource Manager (ARM) Template Tenant": "//Insert here: empty",

    Variable: "//Insert here: variable",
    Parameter: "//Insert here: parameter",
    Output: "//Insert here: output",
    "User Function": "//Insert here: user function",
    "User Function Namespace": "//Insert here: namespace",
    "User Function Parameter Definition": "//Insert here"
};

// Override expected errors/warnings for the snippet test - default is none
const overrideExpectedDiagnostics: { [name: string]: (string | RegExp)[] } = {
    "Application Gateway": [
        // Expected (by design)
        `Value must be one of the following types: object`
    ],
    "Application Gateway and Firewall": [
        // Expected (by design)
        `Value must be one of the following types: object`
    ],

    "Azure Resource Manager (ARM) Parameters Template":
        [
            // Expected (by design)
            "Template validation failed: Required property 'resources' not found in JSON. Path '', line 7, position 2.",
            "Unknown schema: https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        ],
    "Linked Deployment With Relative Path": [
        // Expected (by design)
        /Linked template file not found/i
    ],
    "Linked Deployment With URI": [
        // Expected (by design)
        /Linked template file not found/i
    ],
    Variable: [
        // Expected (by design)
        "The variable 'variable1' is never used."
    ],
    Parameter: [
        // Expected (by design)
        "The parameter 'parameter1' is never used."
    ],
    "User Function": [
        // Expected (by design)
        "The user-defined function 'udf.functionname' is never used.",
        "User-function parameter 'parametername' is never used."
    ],
    "User Function Namespace": [
        // Expected (by design)
        "The user-defined function 'namespacename.functionname' is never used.",
        "User-function parameter 'parametername' is never used."
    ],
    "User Function Parameter Definition": [
        // Expected (by design)
        'Missing required property "$schema"',
        "Template validation failed: Required property '$schema' not found in JSON. Path '', line 21, position 1.",
        "The user-defined function 'udf.func1' is never used.",
        "User-function parameter 'parameter1' is never used."
    ],
    "Automation Job Schedule": [
        // Expected (by design)
        "Value must match the regular expression ^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$"
    ],
    "Automation Schedule": [
        // Expected (by design)
        "Value must be a valid ISO 8601 datetime",
        "Value must be one of the following types: object"
    ],
    "Cosmos DB Mongo Database": [
        // TODO: fix snippet
        "Template validation failed: The template resource 'account-name/mongodb/database-name/collectionName' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '4' and column '66' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "DNS Record": [
        // TODO: fix snippet
        "Template validation failed: The template resource 'dnsRecord1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '42' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "KeyVault": [
        // Expected (by design)
        "Value must match the regular expression ^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$",
        "Value must match the regular expression ^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$"
    ],
    "KeyVault Secret": [
        // Expected (by design)
        "Value must match the regular expression ^[a-zA-Z0-9-]{1,127}$"
    ],
    "Network Security Group Rule": [
        "Template validation failed: The template resource 'networkSecurityGroupRuleName' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '67' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Route Table Route": [
        "Template validation failed: The template resource 'route-name' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '50' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ]
};

// Override whether to ignore schema validation - default is to perform schema validation - mark with "true" to ignore schema validation
// TODO: All items in this list indicate an error (either snippet or schema) and should eventually be removed
const overrideIgnoreSchemaValidation: { [name: string]: boolean } = {
    /* // TODO: fix snippet
     +   'Missing required property "protectedSettings"'
     */
    "Linux VM Custom Script": true,
};

suite("Snippets functional tests", () => {
    suite("all snippets", () => {
        createSnippetTests("armsnippets.jsonc");
    });

    function createSnippetTests(snippetsFile: string): void {
        suite(snippetsFile, () => {
            const snippetsFilePath = resolveInTestFolder(path.join('..', 'assets', snippetsFile));
            const resourceSnippetsFolderPath = resolveInTestFolder(path.join('..', 'assets', 'resourceSnippets'));
            const snippetsFromMainFile = <{ [name: string]: ISnippet }>JSON.parse(stripJsonComments(fse.readFileSync(snippetsFilePath).toString()));
            const resourceSnippets = fse.readdirSync(resourceSnippetsFolderPath).map(file => file.replace(/(.*)\.snippet\.json$/, '$1'));
            const snippetExpectedResultsNames = fse.readdirSync(resolveInTestFolder('snippets/expected')).map(file => file.replace(/\.json$/, ''));
            let snippetNames = Object.getOwnPropertyNames(snippetsFromMainFile).concat(resourceSnippets).concat(snippetExpectedResultsNames);
            snippetNames = [...new Set(snippetNames)]; // dedupe

            const manager = SnippetManager.createDefault();
            for (let snippetName of snippetNames) {
                if (!snippetName.startsWith('$')) {
                    for (let i = 0; i < 1; ++i) {
                        testWithPrep(
                            `snippet: ${snippetName}`,
                            [RequiresLanguageServer.instance, UseRealSnippets.instance],
                            async function (this: ITestCallbackContext): Promise<void> {
                                const snippets = (await manager.getAllSnippets());
                                const snippet = snippets.find(s => s.name === snippetName);
                                assert(snippet !== undefined, `Couldn't find snippet ${snippetName}`);
                                await testSnippet(this, snippetsFilePath, snippetName, snippet!);
                            });
                    }
                }
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
        const snippetInsertComment: string = overrideInsertPosition[snippetName] || "//Insert here: resource";
        const snippetInsertIndex: number = template.indexOf(snippetInsertComment);
        const snippetInsertLength: number = snippetInsertComment.length;
        assert(snippetInsertIndex >= 0, `Couldn't find location to insert snippet (looking for "${snippetInsertComment}")`);
        const fakeDt = new DeploymentTemplateDoc(template, Uri.file("fake template"), 0);
        const snippetInsertPos = getVSCodePositionFromPosition(fakeDt.getContextFromDocumentCharacterIndex(snippetInsertIndex, undefined).documentPosition);
        const snippetInsertEndPos = getVSCodePositionFromPosition(fakeDt.getContextFromDocumentCharacterIndex(snippetInsertIndex + snippetInsertLength, undefined).documentPosition);

        const tempPath = getTempFilePath(`snippet ${snippetName}`, '.azrm');

        fse.writeFileSync(tempPath, template);

        let doc = await workspace.openTextDocument(tempPath);
        let editor = await window.showTextDocument(doc);

        // Wait for first set of diagnostics to finish.
        const diagnosticOptions: IGetDiagnosticsOptions = {
            ignoreSources: (overrideIgnoreSchemaValidation[snippetName]) ? [diagnosticSources.schema] : []
        };
        let diagnosticResults = await getDiagnosticsForDocument(doc, 1, diagnosticOptions);

        // Remove comment at insertion point
        editor.selection = new Selection(snippetInsertEndPos, snippetInsertPos);
        await delay(1);
        await editor.edit(e => e.replace(editor.selection, ' '));
        diagnosticResults = await getDiagnosticsForDocument(doc, 2, diagnosticOptions, diagnosticResults);

        // Insert snippet
        const docTextBeforeInsertion = doc.getText();
        if (LOG_DOC_TEXT_BEFORE_AND_AFTER_SNIPPET_INSERTION) {
            testLog.writeLine(`Document before inserting snippet:\n${docTextBeforeInsertion}`);
        }
        await simulateCompletion(
            editor,
            snippet.prefix,
            undefined);

        // Wait for final diagnostics but don't compare until we've compared the expected text first
        diagnosticResults = await getDiagnosticsForDocument(editor.document, 3, diagnosticOptions, diagnosticResults);
        let messages = diagnosticResults.diagnostics.map(d => d.message).sort();

        if (DEBUG_BREAK_AFTER_INSERTING_SNIPPET) {
            // tslint:disable-next-line: no-debugger
            debugger;
        }

        // Format (vscode seems to be inconsistent about this in these scenarios)
        const docTextAfterInsertion = await formatDocumentAndWait(doc);
        if (LOG_DOC_TEXT_BEFORE_AND_AFTER_SNIPPET_INSERTION) {
            testLog.writeLine(`Document after inserting snippet:\n${docTextAfterInsertion}`);
        }

        fse.mkdirpSync(resultsFolder);
        const outputPath = path.join(resultsFolder, `${snippetName}.snippetresult.json`);

        fse.writeFileSync(outputPath, docTextAfterInsertion);

        validateDocumentWithSnippet();

        // Compare diagnostics
        assertEx.arraysEqual(messages, expectedDiagnostics, {}, "Diagnostics mismatch");

        // Make sure formatting of the sippet is correct by formatting the document and seeing if it changes
        // await commands.executeCommand('editor.action.formatDocument');
        // const docTextAfterFormatting = window.activeTextEditor!.document.getText();
        // assert.deepStrictEqual(docTextAfterInsertion, docTextAfterFormatting, "Snippet is incorrectly formatted. Make sure to use \\t instead of spaces, and make sure the tabbing/indentations are correctly structured");

        // Compare with result files under snippets/expected
        const expectedPath = path.join(expectedFolder, `${snippetName}.json`);
        const expected: string = fse.readFileSync(expectedPath).toString();
        // Compare text without spaces by converting to/from JSON
        const expectedNormalized = stringify(JSON.parse(removeComments(expected)));
        const actualNormalized = stringify(JSON.parse(removeComments(docTextAfterInsertion)));
        assertEx.strictEqual(actualNormalized, expectedNormalized, {}, `Actual result from ${outputPath} did not match expected result in ${expectedPath}`);

        // NOTE: Even though we request the editor to be closed,
        // there's no way to request the document actually be closed,
        //   and when you open it via an API, it doesn't close for a while,
        //   so the diagnostics won't go away
        // See https://github.com/Microsoft/vscode/issues/43056
        fse.unlinkSync(tempPath);
        await commands.executeCommand('workbench.action.closeAllEditors');

        // Look for common errors in the snippet
        function validateSnippet(): void {
            const snippetText = JSON.stringify(snippet, null, 4);

            errorIfTextMatches(snippetText, /\$\$/, `Instead of $$ in snippet, use \\$`);
            errorIfTextMatches(snippetText, /\${[^0-9]/, "Snippet placeholder is missing the numeric id, makes it look like a variable to vscode");
        }

        function validateDocumentWithSnippet(): void {
            assert(docTextBeforeInsertion !== docTextAfterInsertion, "No insertion happened?  Document didn't change.");
        }

        function errorIfTextMatches(text: string, regex: RegExp, errorMessage: string): void {
            const match = text.match(regex);
            if (match) {
                assert(false, `${errorMessage}.  At "${text.slice(match.index!, match.index! + 20)}..."`);
            }
        }
    }

    // test("convert main file into individual resource snippets", async () => {

    //     function convertToResourceSnippetJsonFile(snippet: ISnippet): string {
    //         const lines = snippet.insertText.split(/\n|\r|\r\n/);
    //         let resources = lines.join('\n');
    //         const constChars = '[a-zA-Z0-9_]';
    //         // e.g. "state": "${5|enabled,disabled|}",
    //         resources = resources.replace(new RegExp(`\\"\\\${([0-9]+)\\|(${constChars}+)((,${constChars}+)*)\\|}\\"`, 'g'), '/*$${$1|$2$3|}*/"$2"');
    //         // // e.g. "\t\t\t\"requestBodyCheck\": ${2|true,false|},",
    //         // resources = resources.replace(new RegExp(`\\\${([0-9]+)\\|(${constChars}+)((,${constChars}+)*)\\|}`, 'g'), "/*$${$1|$2$3|}*/$2");
    //         // e.g. "Port": ${17:80}
    //         resources = resources.replace(new RegExp(`: \\\${([0-9]+):(${constChars}+)}`, 'g'), ": /*$${$1:$2}*/$2");

    //         const json = `{
    //     "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    //     "contentVersion": "1.0.0.0",
    //     "metadata": {
    //         "prefix": "${snippet.prefix}",
    //         "description": "${snippet.description}"
    //     },
    //     "resources": [
    // ${resources}
    //     ]
    // }`;
    //         return json;
    //     }

    //     const resourceSnippetsFolderPath = resolveInTestFolder(path.join('..', 'assets', 'resourceSnippets'));
    //     for (const file of fse.readdirSync(resourceSnippetsFolderPath)) {
    //         fse.rmSync(path.join(resourceSnippetsFolderPath, file));
    //     }
    //     const manager = SnippetManager.createDefault();
    //     const resourceSnippets = await manager.getSnippets(KnownContexts.resources);
    //     for (const snippet of resourceSnippets) {
    //         console.log(snippet.name);
    //         const snippetFileContent = convertToResourceSnippetJsonFile(snippet);
    //         const snippetPath = path.join(resourceSnippetsFolderPath, `${snippet.name}.snippet.json`);
    //         fse.writeFileSync(snippetPath, snippetFileContent);
    //     }
    // });

});
