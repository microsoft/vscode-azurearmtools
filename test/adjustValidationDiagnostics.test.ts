// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes

import * as assert from 'assert';
import * as vscode from 'vscode';
// tslint:disable-next-line:no-duplicate-imports
import { Diagnostic, Uri } from "vscode";
import { DiagnosticSeverity } from "vscode-languageclient";
import { adjustValidationDiagnostics, DeploymentFileMapping, DeploymentTemplate, getVSCodePositionFromPosition, getVSCodeRangeFromSpan, Language, validationDiagnosticsSource } from '../extension.bundle';
import { IDeploymentTemplate } from "./support/diagnostics";
import { parseTemplateWithMarkers } from "./support/parseTemplate";
import { TestConfiguration } from './support/TestConfiguration';

suite("adjustValidationDiagnostics", () => {
    function createTest(
        name: string,
        // Template marked with a "!" where the error occurs, and <!start!> and <!end!> where the
        // adjusted error should be
        markedTemplate: IDeploymentTemplate | string
    ): void {
        function rangeToString(r: vscode.Range): string {
            return `(${r.start.line},${r.start.character})-(${r.end.line},${r.end.character})`;
        }

        test(name, async () => {
            const { dt, markers: { bang, start, end } } = await parseTemplateWithMarkers(
                markedTemplate,
                undefined,
                {
                    expectedMarkers: ['bang', 'start', 'end']
                });
            const errorPosition: vscode.Position = getVSCodePositionFromPosition(dt.getDocumentPosition(bang.index));
            const fakeUri = Uri.file('https://fake');
            const getTemplate = async (_uri: Uri): Promise<DeploymentTemplate | undefined> => {
                return dt;
            };
            const diagnostics: Diagnostic[] = [
                {
                    message: "fake diagnostics error",
                    range: new vscode.Range(errorPosition, errorPosition),
                    source: validationDiagnosticsSource,
                    severity: DiagnosticSeverity.Error
                }
            ];

            const mapping = new DeploymentFileMapping(new TestConfiguration());
            await adjustValidationDiagnostics(fakeUri, diagnostics, getTemplate, mapping);
            const actualRange = diagnostics[0].range;
            const expectedRange = getVSCodeRangeFromSpan(dt, new Language.Span(start.index, end.index));

            assert.equal(rangeToString(actualRange), rangeToString(expectedRange));
        });
    }

    createTest(
        "No parameters defined, extra parameter values specified in params",
        `!<!start!>{<!end!>
            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "resources": []
        }`
    );
    createTest(
        "No parameters defined, extra parameter values specified in params, whitespace before starting curly brace",
        `
        // some comments

        !<!start!>{<!end!>
            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "resources": []
        }`
    );
    createTest(
        "One parameter defined, three values given",
        {
            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "resources": [],
            "parameters": {
                "p1": {
                    "type": "int"
                }
            }
        });
});
