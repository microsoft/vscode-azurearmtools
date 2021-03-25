// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { ReferenceList } from '../../extension.bundle';
import { DeploymentDocument } from '../../src/documents/DeploymentDocument';

/**
 * Given a deployment template and a character index into it, verify that getReferences on the template
 * returns the expected set of locations.
 *
 * Usually parseTemplateWithMarkers will be used to parse the document and find the indices of a set of locations
 * Example:
 *
 *      const { dt, markers: { apiVersionDef, apiVersionReference } } =  parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
 *      // Cursor at reference to "apiVersion" inside resources
 *      await testFindReferences(dt, apiVersionReference.index, [apiVersionReference.index, apiVersionDef.index]);
 */
export function testGetReferences(dt: DeploymentDocument, cursorIndexInTemplate: number, associatedDoc: DeploymentDocument | undefined, expectedReferenceIndices: number[]): void {
    const pc = dt.getContextFromDocumentCharacterIndex(cursorIndexInTemplate, associatedDoc);
    // tslint:disable-next-line: no-non-null-assertion
    const references: ReferenceList = pc.getReferences()!;
    assert(references, "Expected non-empty list of references");

    const indices = references.references.map(r => r.span.startIndex).sort();
    expectedReferenceIndices = expectedReferenceIndices.sort();

    assert.deepStrictEqual(indices, expectedReferenceIndices);
}
