/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DeploymentFile } from '../DeploymentFile';
import { assert } from "../fixed_assert";
import * as language from "../Language";

export function getVSCodeRangeFromSpan(deploymentFile: DeploymentFile, span: language.Span): vscode.Range {
    assert(span);
    assert(deploymentFile);

    const startPosition: language.Position = deploymentFile.getDocumentPosition(span.startIndex);
    const vscodeStartPosition = new vscode.Position(startPosition.line, startPosition.column);

    const endPosition: language.Position = deploymentFile.getDocumentPosition(span.afterEndIndex);
    const vscodeEndPosition = new vscode.Position(endPosition.line, endPosition.column);

    return new vscode.Range(vscodeStartPosition, vscodeEndPosition);
}

export function getVSCodePositionFromPosition(position: language.Position): vscode.Position {
    return new vscode.Position(position.line, position.column);
}
