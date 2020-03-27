// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { DeploymentTemplate, ReferenceList } from '../../extension.bundle';

/**
 * Given a deployment template and a character index into it, verify that getReferences on the template
 * returns the expected set of locations.
 *
 * Usually parseTemplateWithMarkers will be used to parse the document and find the indices of a set of locations
 * Example:
 *
 *      const { dt, markers: { apiVersionDef, apiVersionReference } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
 *      // Cursor at reference to "apiVersion" inside resources
 *      await testFindReferences(dt, apiVersionReference.index, [apiVersionReference.index, apiVersionDef.index]);
 */
export async function testGetReferences(dt: DeploymentTemplate, cursorIndex: number, expectedReferenceIndices: number[]): Promise<void> {
    const pc = dt.getContextFromDocumentCharacterIndex(cursorIndex);
    // tslint:disable-next-line: no-non-null-assertion
    const references: ReferenceList = pc.getReferences()!;
    assert(references, "Expected non-empty list of references");

    const indices = references.spans.map(r => r.startIndex).sort();
    expectedReferenceIndices = expectedReferenceIndices.sort();

    assert.deepStrictEqual(indices, expectedReferenceIndices);
}
