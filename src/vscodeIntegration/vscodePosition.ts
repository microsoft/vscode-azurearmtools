/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IDocument } from "../documents/templates/IDocument";
import { assert } from "../fixed_assert";
import { LineColPos } from '../language/LineColPos';
import { Span } from '../language/Span';

export function getVSCodeRangeFromSpan(deploymentDocument: IDocument, span: Span): vscode.Range {
    assert(span);
    assert(deploymentDocument);

    const startPosition: LineColPos = deploymentDocument.getDocumentPosition(span.startIndex);
    const vscodeStartPosition = new vscode.Position(startPosition.line, startPosition.column);

    const endPosition: LineColPos = deploymentDocument.getDocumentPosition(span.afterEndIndex);
    const vscodeEndPosition = new vscode.Position(endPosition.line, endPosition.column);

    return new vscode.Range(vscodeStartPosition, vscodeEndPosition);
}

export function getVSCodePositionFromPosition(position: LineColPos): vscode.Position {
    return new vscode.Position(position.line, position.column);
}
