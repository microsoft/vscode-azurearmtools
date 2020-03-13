/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DeploymentTemplate } from '../DeploymentTemplate';
import { assert } from "../fixed_assert";
import * as language from "../Language";
import { DeploymentParameters } from '../parameterFiles/DeploymentParameters';

export function getVSCodeRangeFromSpan(deploymentTemplate: DeploymentTemplate, span: language.Span): vscode.Range {
    assert(span);
    assert(deploymentTemplate);

    const startPosition: language.Position = deploymentTemplate.getContextFromDocumentCharacterIndex(span.startIndex).documentPosition;
    const vscodeStartPosition = new vscode.Position(startPosition.line, startPosition.column);

    const endPosition: language.Position = deploymentTemplate.getContextFromDocumentCharacterIndex(span.afterEndIndex).documentPosition;
    const vscodeEndPosition = new vscode.Position(endPosition.line, endPosition.column);

    return new vscode.Range(vscodeStartPosition, vscodeEndPosition);
}

export function getVSCodePositionFromPosition(position: language.Position): vscode.Position {
    return new vscode.Position(position.line, position.column);
}

export function getVSCodeRangeFromSpan2asdf(deploymentParameters: DeploymentParameters, span: language.Span): vscode.Range {
    assert(span);
    assert(deploymentParameters);

    // asdf don't create context in order to do this
    const startPosition: language.Position = deploymentParameters.getContextFromDocumentCharacterIndex(span.startIndex, undefined).documentPosition;
    const vscodeStartPosition = new vscode.Position(startPosition.line, startPosition.column);

    const endPosition: language.Position = deploymentParameters.getContextFromDocumentCharacterIndex(span.afterEndIndex, undefined).documentPosition;
    const vscodeEndPosition = new vscode.Position(endPosition.line, endPosition.column);

    return new vscode.Range(vscodeStartPosition, vscodeEndPosition);
}
