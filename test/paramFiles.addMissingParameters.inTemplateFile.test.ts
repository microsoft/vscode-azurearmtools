// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template no-http-string

import * as assert from 'assert';
import { CodeAction, Command, Uri } from 'vscode';
import { addMissingParameters, assignTemplateGraphToDeploymentTemplate, DeploymentTemplateDoc, getNormalizedDocumentKey, getVSCodeRangeFromSpan, IAddMissingParametersArgs, INotifyTemplateGraphArgs, LinkedFileLoadState, NormalizedMap, ofType, Span } from '../extension.bundle';
import { TextDocumentFake } from './fakes/TextDocumentFake';
import { TextEditorFake } from './fakes/TextEditorFake';
import { getCodeActionContext } from './support/getCodeActionContext';
import { parseTemplateWithMarkers } from "./support/parseTemplate";
import { removeComments } from './support/removeComments';
import { testWithLanguageServer } from './support/testWithLanguageServer';

// These tests are for parameter completions for nested and linked templates
suite("Add missing parameters for nested/linked templates", () => {

    enum Params {
        "all",
        "onlyRequired"
    }

    function createAddMissingParamsTest(
        testName: string,
        template: string,
        linkedTemplate: string | undefined,
        whichParams: Params,
        expectedResult: string
    ): void {
        testWithLanguageServer(testName, async () => {
            const tabSize = 4;
            //const expectedResultText = stringify(expectedResult, tabSize);
            const { dt: expectedDt } = await parseTemplateWithMarkers(expectedResult, undefined, { fromFile: true });
            const expectedResultText = expectedDt.documentText;

            // Get template
            const templateUri = Uri.file("/mainTemplate.json");
            const childUri = Uri.file("file:///childTemplate.json");

            // Get linked template
            const { dt, markers: { bang } } = await parseTemplateWithMarkers(template, undefined, { fromFile: true, documentUri: templateUri, tabSize });
            assert(bang, "Didn't find bang marker");
            const span = new Span(bang.index, 0);
            const range = getVSCodeRangeFromSpan(dt, span);

            // Set up template with linked file information
            if (linkedTemplate) {
                const { dt: childDt } = await parseTemplateWithMarkers(linkedTemplate, undefined, { fromFile: true, documentUri: childUri, tabSize });
                const graph: INotifyTemplateGraphArgs = {
                    rootTemplateUri: templateUri.toString(),
                    linkedTemplates: [
                        {
                            fullUri: childUri.toString(),
                            columnNumberInParent: range.start.character,
                            id: "0",
                            lineNumberInParent: range.start.line,
                            loadErrorMessage: undefined,
                            loadState: LinkedFileLoadState.SuccessfullyLoaded,
                            originalPath: "childTemplate.json",
                            parameterValues: {}
                        }
                    ],
                    fullValidationEnabled: true,
                    isComplete: true
                };
                const allLoadedTemplates = new NormalizedMap<Uri, DeploymentTemplateDoc>(getNormalizedDocumentKey);
                allLoadedTemplates.set(templateUri, dt);
                allLoadedTemplates.set(childUri, childDt);
                assignTemplateGraphToDeploymentTemplate(graph, dt, {
                    getOpenedDeploymentTemplate: (uri: Uri): DeploymentTemplateDoc | undefined => {
                        return allLoadedTemplates.get(uri);
                    }
                });
            }

            // Get valid code actions at the <!bang!> marker
            const codeActions: (CodeAction | Command)[] = dt.getCodeActions(undefined, range, getCodeActionContext());

            // Select the correct code action
            assert.equal(codeActions.length, 2, "Expecting a 2 add missing params code actions");
            const expectedName = whichParams === Params.all ? "Add all missing parameters" : "Add missing required parameters";
            const codeAction: CodeAction | undefined = ofType(codeActions, CodeAction).find(ca => ca.title === expectedName);
            const args: IAddMissingParametersArgs = <IAddMissingParametersArgs>codeAction!.command!.arguments![1];

            const doc: TextDocumentFake = new TextDocumentFake(dt.documentText, templateUri);
            const editor: TextEditorFake = new TextEditorFake(doc);
            editor.options = {
                insertSpaces: true,
                tabSize,
            };

            // Test
            await addMissingParameters(
                args.parameterDefinitionsSource,
                args.parameterValuesSource,
                editor,
                args.parentParameterDefinitionsSource,
                whichParams === Params.onlyRequired
            );

            const actualResult = editor.document.getText();
            const actualResultNoComments = removeComments(actualResult);
            assert.strictEqual(actualResultNoComments, expectedResultText);
        });
    }

    createAddMissingParamsTest(
        "Simple linked template - main.linked01.json",
        "templates/linkedTemplates/addMissingParams/main.simple-linked.json",
        "templates/linkedTemplates/addMissingParams/childTemplate.json",
        Params.all,
        "templates/linkedTemplates/addMissingParams/main.simple-linked.expected.json"
    );

    createAddMissingParamsTest(
        "Pass through top-level parameters to linked template",
        "templates/linkedTemplates/addMissingParams/main.linked.passthru.json",
        "templates/linkedTemplates/addMissingParams/childTemplate.json",
        Params.all,
        "templates/linkedTemplates/addMissingParams/main.linked.passthru.expected.json"
    );

    createAddMissingParamsTest(
        "Pass through top-level parameters to nested template",
        "templates/linkedTemplates/addMissingParams/main.nested.passthru.json",
        undefined,
        Params.all,
        "templates/linkedTemplates/addMissingParams/main.nested.passthru.expected.json"
    );

    // tslint:disable-next-line: no-suspicious-comment
    /* TODO: blocked by https://github.com/microsoft/vscode-azurearmtools/issues/1155
    createAddMissingParamsTest(
        "Pass through top-level parameters to linked template inside inner-scoped nested template",
        "templates/linkedTemplates/addMissingParams/main.linked-in-inner-nested.passthru.json",
        "templates/linkedTemplates/addMissingParams/childTemplate.json",
        Params.all,
        "templates/linkedTemplates/addMissingParams/main.linked-in-inner-nested.passthru.expected.json"
    );

    createAddMissingParamsTest(
        "Pass through top-level parameters to linked template inside outer-scoped nested template",
        "templates/linkedTemplates/addMissingParams/main.linked-in-outer-nested.passthru.json",
        "templates/linkedTemplates/addMissingParams/childTemplate.json",
        Params.all,
        "templates/linkedTemplates/addMissingParams/main.linked-in-outer-nested.passthru.expected.json"
    );
    */
});
