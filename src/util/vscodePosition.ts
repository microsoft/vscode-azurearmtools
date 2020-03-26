/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DeploymentDocument } from '../DeploymentDocument';
import { assert } from "../fixed_assert";
import * as language from "../Language";

export function getVSCodeRangeFromSpan(deploymentDocument: DeploymentDocument, span: language.Span): vscode.Range {
    assert(span);
    assert(deploymentDocument);

    const startPosition: language.Position = deploymentDocument.getDocumentPosition(span.startIndex);
    const vscodeStartPosition = new vscode.Position(startPosition.line, startPosition.column);

    const endPosition: language.Position = deploymentDocument.getDocumentPosition(span.afterEndIndex);
    const vscodeEndPosition = new vscode.Position(endPosition.line, endPosition.column);

    return new vscode.Range(vscodeStartPosition, vscodeEndPosition);
}

export function getVSCodePositionFromPosition(position: language.Position): vscode.Position {
    return new vscode.Position(position.line, position.column);
}
