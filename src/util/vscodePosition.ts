/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DeploymentDoc } from '../DeploymentDoc';
import { assert } from "../fixed_assert";
import * as language from "../Language";

export function getVSCodeRangeFromSpan(deploymentDoc: DeploymentDoc, span: language.Span): vscode.Range {
    assert(span);
    assert(deploymentDoc);

    const startPosition: language.Position = deploymentDoc.getDocumentPosition(span.startIndex);
    const vscodeStartPosition = new vscode.Position(startPosition.line, startPosition.column);

    const endPosition: language.Position = deploymentDoc.getDocumentPosition(span.afterEndIndex);
    const vscodeEndPosition = new vscode.Position(endPosition.line, endPosition.column);

    return new vscode.Range(vscodeStartPosition, vscodeEndPosition);
}

export function getVSCodePositionFromPosition(position: language.Position): vscode.Position {
    return new vscode.Position(position.line, position.column);
}
