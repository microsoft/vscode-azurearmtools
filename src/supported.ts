// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Position, Range, TextDocument, workspace } from "vscode";
import { armDeploymentLanguageId, configKeys } from "./constants";

export const armDeploymentDocumentSelector = [
    { language: armDeploymentLanguageId, scheme: 'file' }
];

const armSchemaRegex =
    /https?:\/\/schema\.management\.azure\.com\/schemas\/[^"\/]+\/(deploymentTemplate|subscriptionDeploymentTemplate)\.json/i;
const maxLinesToDetectSchemaIn = 10;

function isJsonOrJsonWithComments(textDocument: TextDocument): boolean {
    return textDocument.languageId === 'json' || textDocument.languageId === 'jsonc';
}

// We keep track of arm-deployment files, and also JSON/JSONC (unless disabled)
export function shouldWatchDocument(textDocument: TextDocument): boolean {
    if (textDocument.uri.scheme !== 'file') {
        return false;
    }

    if (textDocument.languageId === armDeploymentLanguageId) {
        return true;
    }

    let enableAutoDetection = workspace.getConfiguration('armTools').get<boolean>(configKeys.autoDetectJsonTemplates);
    if (!enableAutoDetection) {
        return false;
    }

    return isJsonOrJsonWithComments(textDocument);
}

export function isDeploymentTemplate(textDocument: TextDocument): boolean {
    if (!shouldWatchDocument(textDocument)) {
        return false;
    }

    if (textDocument.languageId === armDeploymentLanguageId) {
        return true;
    }

    if (isJsonOrJsonWithComments(textDocument)) {
        // TODO: restrict to characters as well?
        let startOfDocument = textDocument.getText(new Range(new Position(0, 0), new Position(maxLinesToDetectSchemaIn - 1, 0)));
        return startOfDocument && !!startOfDocument.match(armSchemaRegex);
    }

    return false;
}
