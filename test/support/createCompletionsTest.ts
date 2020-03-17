/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IDeploymentTemplate } from "./diagnostics";
import { parseTemplateWithMarkers } from "./parseTemplate";
import { stringify } from './stringify';

export function createExpressionCompletionsTest(
    // Contains the text of the expression. '!' indicates the cursor location
    replacementWithBang: string,
    // Can either be an array of completion names, or an array of
    //   [completion name, insert text] tuples
    expectedNamesAndInsertTexts: ([string, string][]) | (string[])
): void {
    const template = <IDeploymentTemplate>{
        $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
        contentVersion: "1.0.0.0",
        resources: [],
        outputs: {
            o1: {
                type: "object",
                value: "<output1>"
            }
        }
    };

    createCompletionsTest(template, '<output1>', replacementWithBang, expectedNamesAndInsertTexts);
}

export function createCompletionsTest(
    template: string | Partial<IDeploymentTemplate>,
    find: string, // String to find and replace in the template (e.g. '<output1>')
    replacementWithBang: string,
    // Can either be an array of completion names, or an array of
    //   [completion name, insert text] tuples
    expectedNamesAndInsertTexts: ([string, string][]) | (string[])
): void {
    test(`Test Completions: ${replacementWithBang}`, async () => {
        template = stringify(template).replace(find, replacementWithBang);

        const { dt, markers: { bang } } = await parseTemplateWithMarkers(template);
        assert(bang, "Didn't find ! marker in text");
        const pc = dt.getContextFromDocumentCharacterIndex(bang.index);
        const completions = pc.getCompletionItems();

        const completionNames = completions.map(c => c.label).sort();
        const completionInserts = completions.map(c => c.insertText).sort();

        const expectedNames = (<unknown[]>expectedNamesAndInsertTexts).map(e => Array.isArray(e) ? <string>e[0] : <string>e).sort();
        // tslint:disable-next-line: no-any
        const expectedInsertTexts = expectedNamesAndInsertTexts.every((e: any) => Array.isArray(e)) ? (<[string, string][]>expectedNamesAndInsertTexts).map(e => e[1]).sort() : undefined;

        assert.deepStrictEqual(completionNames, expectedNames, "Completion names didn't match");
        if (expectedInsertTexts !== undefined) {
            assert.deepStrictEqual(completionInserts, expectedInsertTexts, "Completion insert texts didn't match");
        }
    });
}
