/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IDeploymentTemplate, IPartialDeploymentTemplate } from "./diagnostics";
import { parseTemplateWithMarkers } from "./parseTemplate";
import { stringify } from './stringify';

/**
 * Creates a test for completions in a particular template language expression
 */
export function createExpressionCompletionsTest(
    // Contains the text of the expression. '!' indicates the cursor location
    expressionWithBang: string,
    // Can either be an array of completion names, or an array of
    //   [completion name, insert text] tuples
    expectedCompletions: ([string, string][]) | (string[]),
    // If specified, the template with the string '<context>' in the location
    // where the expression to be tested should be placed
    template?: string | Partial<IDeploymentTemplate> | IPartialDeploymentTemplate,
    options?: {
        name?: string;
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

    createExpressionCompletionsTestEx(template, '<context>', expressionWithBang, expectedCompletions, options);
}

/**
 * A generalization of createExpressionCompletionsTest that allows specifying a template and a location in that template
 * of where the expression completions will be evaluated
 */
export function createExpressionCompletionsTestEx(
    template: string | Partial<IDeploymentTemplate> | IPartialDeploymentTemplate,
    /**
     * Indicates where in the template to place the expressionWithBang and run the completions on
     *  Example: if the template had the following in it:
     *    "output1": {
     *        "value": "<output1>",
     *        "type": "int"
     *    }
     *  then this should be '<output1>', which is the context of where the expression will be placed for the
     *  completions tests
     */
    contextFind: string,
    expressionWithBang: string,
    // Can either be an array of completion names, or an array of
    //   [completion name, insert text] tuples
    expectedCompletions: ([string, string][]) | (string[]),
    options?: {
        name?: string;
    }
): void {
    const name = options?.name;
    // tslint:disable-next-line:prefer-template
    test(`Expression completion: ${name ? name + ': ' : ''}${expressionWithBang}`, async () => {
        expressionWithBang = expressionWithBang.replace(/!/g, "<!bang!>");
        template = stringify(template).replace(contextFind, expressionWithBang);

        const { dt, markers: { bang } } = await parseTemplateWithMarkers(template, undefined, { ignoreBang: true });
        assert(bang, "Didn't find ! marker in text");
        const pc = dt.getContextFromDocumentCharacterIndex(bang.index, undefined);
        const completions = pc.getCompletionItems();

        const completionNames = completions.map(c => c.label).sort();
        const completionInserts = completions.map(c => c.insertText).sort();

        const expectedNames = (<unknown[]>expectedCompletions).map(e => Array.isArray(e) ? <string>e[0] : <string>e).sort();
        // tslint:disable-next-line: no-any
        const expectedInsertTexts = expectedCompletions.every((e: any) => Array.isArray(e)) ? (<[string, string][]>expectedCompletions).map(e => e[1]).sort() : undefined;

        assert.deepStrictEqual(completionNames, expectedNames, "Completion names didn't match");
        if (expectedInsertTexts !== undefined) {
            assert.deepStrictEqual(completionInserts, expectedInsertTexts, "Completion insert texts didn't match");
        }
    });
}
