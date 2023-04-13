// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as vscode from "vscode";
import { expressionsDiagnosticsSource } from "../../common";
import { DeploymentDocument } from "../documents/DeploymentDocument";
import { Issue } from "../language/Issue";
import { getVSCodeRangeFromSpan } from "./vscodePosition";

export function toVSCodeDiagnosticFromIssue(deploymentDocument: DeploymentDocument, issue: Issue, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
    const range: vscode.Range = getVSCodeRangeFromSpan(deploymentDocument, issue.span);
    const message: string = issue.message;
    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.source = expressionsDiagnosticsSource;
    diagnostic.code = "";

    if (issue.isUnnecessaryCode) {
        diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
    }

    if (issue.relatedInformation.length > 0) {
        diagnostic.relatedInformation = issue.relatedInformation.map(ri =>
            new vscode.DiagnosticRelatedInformation(
                new vscode.Location(
                    ri.location.uri,
                    getVSCodeRangeFromSpan(deploymentDocument, ri.location.span)
                ),
                ri.message
            ));
    }

    return diagnostic;
}
