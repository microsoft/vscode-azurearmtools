// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Position, Range, TextDocument, workspace } from "vscode";
import { armDeploymentLanguageId, configKeys } from "./constants";

export const armDeploymentDocumentSelector = [
    { language: armDeploymentLanguageId, scheme: 'file' }
];

// tslint:disable-next-line: no-suspicious-comment
// TODO: This doesn't take comments into consideration
const armSchemaRegex =
    /https?:\/\/schema\.management\.azure\.com\/schemas\/[^"\/]+\/(deploymentTemplate|subscriptionDeploymentTemplate)\.json/i;
const maxLinesToDetectSchemaIn = 10;

function isJsonOrJsoncLangId(textDocument: TextDocument): boolean {
    return textDocument.languageId === 'json' || textDocument.languageId === 'jsonc';
}

// We keep track of arm-deployment files, of course,
// but also JSON/JSONC (unless auto-detect is disabled) so we can check them for the ARM schema
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

    return isJsonOrJsoncLangId(textDocument);
}

export function isDeploymentTemplate(textDocument: TextDocument): boolean {
    if (!shouldWatchDocument(textDocument)) {
        return false;
    }

    if (textDocument.languageId === armDeploymentLanguageId) {
        return true;
    }

    if (isJsonOrJsoncLangId(textDocument)) {
        let startOfDocument = textDocument.getText(new Range(new Position(0, 0), new Position(maxLinesToDetectSchemaIn - 1, 0)));
        return startOfDocument && doesJsonContainArmSchema(startOfDocument);
    }

    return false;
}

export function doesJsonContainArmSchema(json: string): boolean {
    return json && !!json.match(armSchemaRegex);
}
