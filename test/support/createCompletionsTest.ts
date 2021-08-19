/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IDeploymentTemplate, IPartialDeploymentTemplate } from "./diagnostics";
import { parseTemplateWithMarkers } from "./parseTemplate";
import { stringify } from './stringify';
import { ITestPreparation, testWithPrep } from './testWithPrep';

/**
 * Creates a test for completions in a particular template language expression
 */
export function createExpressionCompletionsTest(
    // Contains the text of the expression. '<!cursor!>' indicates the cursor location
    expressionWithCursorMarker: string,
    // Can either be an array of completion names, or an array of
    //   [completion name, insert text] tuples
    expectedCompletions: ([string, string][]) | (string[]),
    // If specified, the template with the string '<context>' in the location
    // where the expression to be tested should be placed
    template?: string | Partial<IDeploymentTemplate> | IPartialDeploymentTemplate,
    options?: {
        name?: string;
        preps?: ITestPreparation[];
        ignoreCompletionNames?: string[];
    }
): void {
    const defaultTemplate = <IDeploymentTemplate>{
        $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
        contentVersion: "1.0.0.0",
        resources: [],
        outputs: {
            o1: {
                type: "object",
                value: "<context>"
            }
        }
    };
    template = template ?? defaultTemplate;

    createExpressionCompletionsTestEx(template, '<context>', expressionWithCursorMarker, expectedCompletions, options);
}

/**
 * A generalization of createExpressionCompletionsTest that allows specifying a template and a location in that template
 * of where the expression completions will be evaluated
 */
export function createExpressionCompletionsTestEx(
    template: string | Partial<IDeploymentTemplate> | IPartialDeploymentTemplate,
    /**
     * Indicates where in the template to place the expressionWithCursorMarker and run the completions on
     *  Example: if the template had the following in it:
     *    "output1": {
     *        "value": "<output1>",
     *        "type": "int"
     *    }
     *  then this should be '<output1>', which is the context of where the expression will be placed for the
     *  completions tests
     */
    contextFind: string,
    expressionWithCursorMarker: string,
    // Can either be an array of completion names, or an array of
    //   [completion name, insert text] tuples
    expectedCompletions: (string | [string, string])[],
    options?: {
        name?: string;
        preps?: ITestPreparation[];
        triggerCharacter?: string;
        ignoreCompletionNames?: string[];
    }
): void {
    const name = options?.name;
    testWithPrep(
        // tslint:disable-next-line:prefer-template
        `Expression completion: ${name ? name + ': ' : ''}${expressionWithCursorMarker}`,
        options?.preps ?? [],
        async () => {
            let keepInClosure = name;
            keepInClosure = keepInClosure;

            template = stringify(template).replace(contextFind, expressionWithCursorMarker);

            const { dt, markers: { cursor } } = parseTemplateWithMarkers(template);
            assert(cursor, "Didn't find <!cursor!> marker in text");
            const pc = dt.getContextFromDocumentCharacterIndex(cursor.index, undefined);
            const completions = await pc.getCompletionItems(options?.triggerCharacter, 4);

            // Remove completions to ignore
            const completionItems = completions.items.filter(c => !(options?.ignoreCompletionNames ?? []).includes(c.label));

            const completionNames = completionItems.map(c => c.label).sort();

            const completionInserts = completionItems.map(c => c.insertText).sort();

            let expectedNames = (<unknown[]>expectedCompletions).map(e => Array.isArray(e) ? <string>e[0] : <string>e);
            expectedNames = expectedNames.sort();
            let expectedInsertTexts: string[] | undefined;
            if (expectedCompletions.every(e => Array.isArray(e))) {
                expectedInsertTexts = (<[string, string][]>expectedCompletions).map(e => e[1]).sort();
            }

            assert.deepStrictEqual(completionNames, expectedNames);
            if (expectedInsertTexts !== undefined) {
                assert.deepStrictEqual(completionInserts, expectedInsertTexts, "Completion insert texts didn't match");
            }
        }
    );
}
