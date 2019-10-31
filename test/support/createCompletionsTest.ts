/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IDeploymentTemplate } from "./diagnostics";
import { parseTemplateWithMarkers } from "./parseTemplate";
import { stringify } from './stringify';

export function createCompletionsTest(
    template: string | Partial<IDeploymentTemplate>,
    find: string,
    replacementWithBang: string,
    // Can either be an array of completion names, or an array of
    //   [completion name, insert text] tuples
    expectedNamesAndInsertTexts: ([string, string][]) | (string[])
): void {
    test(`Test UDF Completions: ${replacementWithBang}`, async () => {
        template = stringify(template).replace(find, replacementWithBang);

        const { dt, markers: { bang } } = await parseTemplateWithMarkers(template);
        assert(bang, "Didn't find ! marker in text");
        const pc = dt.getContextFromDocumentCharacterIndex(bang.index);
        const completions = pc.getCompletionItems();

        const completionNames = completions.map(c => c.name).sort();
        const completionInserts = completions.map(c => c.insertText).sort();

        const expectedNames = (<unknown[]>expectedNamesAndInsertTexts).map(e => Array.isArray(e) ? <string>e[0] : <string>e).sort();
        const expectedInsertTexts = expectedNamesAndInsertTexts.every(e => Array.isArray(e)) ? (<[string, string][]>expectedNamesAndInsertTexts).map(e => e[1]).sort() : undefined;

        assert.deepStrictEqual(completionNames, expectedNames, "Completion names didn't match");
        if (expectedInsertTexts !== undefined) {
            assert.deepStrictEqual(completionInserts, expectedInsertTexts, "Completion insert texts didn't match");
        }
    });
}
