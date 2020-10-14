// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { assert } from "../../fixed_assert";
import { isSingleQuoted } from "../../util/strings";
import { IResourceInfo } from "./getResourcesInfo";

/**
 * Determines if two top-level resources are in a parent/child relationship
 */
export function areDecoupledChildAndParent(child: IResourceInfo, parent: IResourceInfo): boolean {
    const childTypeSegments = child.typeSegmentExpressions;
    const parentTypeSegments = parent.typeSegmentExpressions;

    if ((child.parent && !child.isDecoupledChild) || (parent.parent && !parent.isDecoupledChild)) {
        // Not root-level resources
        return false;
    }

    if (childTypeSegments.length === 0 || parentTypeSegments.length === 0) {
        // malformed
        return false;
    }

    if (!(childTypeSegments.length === parentTypeSegments.length + 1)) {
        // Child should have exactly one more segment than the parent
        return false;
    }

    const childNameSegments = child.nameSegmentExpressions;
    const parentNameSegments = parent.nameSegmentExpressions;

    if (childTypeSegments.length === 0 || parentTypeSegments.length === 0) {
        // malformed
        return false;
    }
    if (!(childNameSegments.length === parentNameSegments.length + 1)) {
        // Child should have exactly one more segment than the parent
        return false;
    }

    // Number of segments for names and types should be the same
    if (childTypeSegments.length !== childNameSegments.length) {
        return false;
    }

    // Child and parent segments must match, except the last child segment
    if (!childMatchesParentSegments(childNameSegments, parentNameSegments)) {
        return false;
    }
    if (!childMatchesParentSegments(childTypeSegments, parentTypeSegments)) {
        return false;
    }

    return true;

    function childMatchesParentSegments(childSegments: string[], parentSegments: string[]): boolean {
        assert(childSegments.length === parentSegments.length + 1);
        for (let i = 0; i < parentSegments.length; ++i) {
            if (!expressionsAreSame(childSegments[i], parentSegments[i])) {
                return false;
            }
        }

        return true;
    }
}

function expressionsAreSame(expr1: string, expr2: string): boolean {
    const expr1LC = expr1.toLowerCase();
    const expr2LC = expr2.toLowerCase();

    if (expr1LC === expr2LC) {
        return true;
    }

    if (!isSingleQuoted(expr1) && !isSingleQuoted(expr2)) {
        // Expressions could contain whitespace, so remove it
        // CONSIDER: Do we need to be more exact than this?  For instance, could produce false positives when strings inside the expression differ by whitespace.  But probably not worth the extra work.
        const expr1NoWhitespace = expr1.replace(/\s+/g, '');
        const expr2NoWhitespace = expr2.replace(/\s+/g, '');

        return expr1NoWhitespace === expr2NoWhitespace;
    }

    return false;
}
