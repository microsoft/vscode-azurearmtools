/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Diagnostic, Position, Range, Uri } from "vscode";
import { callWithTelemetryAndErrorHandling } from "vscode-azureextensionui";
import { templateKeys, validationDiagnosticsSource } from "./constants";
import { DeploymentTemplate } from "./DeploymentTemplate";
import * as Json from "./JSON";
import { Contains, Span } from "./Language";
import { DeploymentFileMapping } from "./parameterFiles/DeploymentFileMapping";
import { getVSCodeRangeFromSpan } from "./util/vscodePosition";

/**
 * Modifies the diagnostics that are returned from the backend template validation
 * @param getTemplate A function to retrieve the deployment template for the given URI
 */
export async function adjustValidationDiagnostics(
    documentUri: Uri,
    diagnostics: Diagnostic[],
    getTemplate: (uri: Uri) => Promise<DeploymentTemplate | undefined>,
    mapping: DeploymentFileMapping
): Promise<void> {
    for (let d of diagnostics) {
        if (d.source === validationDiagnosticsSource) {
            await adjustValidationDiagnostic(documentUri, d, getTemplate, mapping);
        }
    }
}

async function adjustValidationDiagnostic(
    documentUri: Uri,
    diagnostic: Diagnostic,
    getTemplate: (uri: Uri) => Promise<DeploymentTemplate | undefined>,
    mapping: DeploymentFileMapping
): Promise<void> {
    await callWithTelemetryAndErrorHandling('adjustValidationDiagnostic', async actionContext => {
        actionContext.errorHandling.suppressDisplay = true;
        actionContext.telemetry.suppressIfSuccessful = true;
        const dt = await getTemplate(documentUri);
        if (dt) {
            const range = diagnostic.range;
            const startIndex = dt.getDocumentCharacterIndex(range.start.line, range.start.character);
            const endIndex = dt.getDocumentCharacterIndex(range.end.line, range.end.character);
            // If the diagnostic range is empty...
            if (startIndex === endIndex) {
                let isErrorAtBeginning = false;

                // Pick a more appropriate non-empty range, which will be more friendly to users
                if (startIndex === dt.topLevelValue?.span.startIndex) {
                    // Error is on the opening brace (for instance occurs when the params file contains
                    // undefined parameters). Don't want to mark the entire file, so just expand the length
                    // the cover the brace itself
                    isErrorAtBeginning = true;
                }

                if (isErrorAtBeginning) {
                    diagnostic.range = getVSCodeRangeFromSpan(dt, new Span(startIndex, startIndex + 1));
                } else {

                    let value = dt.getJSONValueAtDocumentCharacterIndex(startIndex, Contains.extended);
                    if (value instanceof Json.Property) { //asdf
                        value = value.nameValue;
                    }
                    if (value) {
                        diagnostic.range = getVSCodeRangeFromSpan(dt, value.span);
                    }
                }

                // If the error references the parameter file, add it to the diagnostic
                if (diagnostic.message.includes('#parameter-file')) {
                    // Example error message:
                    //
                    //   Template validation failed: The template parameters 'location' in the parameters file
                    //   are not valid; they are not present in the original template and can therefore not be
                    //   provided at deployment time. The only supported parameters for this template are 'p1'.
                    //   Please see https://aka.ms/arm-deploy/#parameter-file for usage details.
                    const paramFileUri = mapping.getParameterFile(documentUri);
                    if (paramFileUri) {
                        diagnostic.relatedInformation = diagnostic.relatedInformation ?? [];
                        diagnostic.relatedInformation.push({
                            location: { uri: paramFileUri, range: new Range(new Position(0, 0), new Position(0, 0)) },
                            message: "The error may be in the parameter file"
                        });
                    }
                    if (isErrorAtBeginning) {
                        const parametersSpan = dt.topLevelValue?.getProperty(templateKeys.parameters)?.span;
                        if (parametersSpan) {
                            diagnostic.range = getVSCodeRangeFromSpan(dt, parametersSpan);
                        }
                    }
                }
            }
        }
    });
}
