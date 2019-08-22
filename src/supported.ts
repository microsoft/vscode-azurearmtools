// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Position, Range, TextDocument, workspace } from "vscode";
import { armDeploymentLanguageId, configKeys } from "./constants";

export const armDeploymentDocumentSelector = [
    { language: armDeploymentLanguageId, scheme: 'file' }
];

const containsArmSchemaRegexString =
    `https?:\/\/schema\.management\.azure\.com\/schemas\/[^"\/]+\/[a-zA-Z]*[dD]eploymentTemplate\.json#?`;
const containsArmSchemaRegex = new RegExp(containsArmSchemaRegexString, 'i');
const isArmSchemaRegex = new RegExp(`^${containsArmSchemaRegexString}$`, 'i');
const maxLinesToDetectSchemaIn = 500;

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

export function mightBeDeploymentTemplate(textDocument: TextDocument): boolean {
    if (!shouldWatchDocument(textDocument)) {
        return false;
    }

    if (textDocument.languageId === armDeploymentLanguageId) {
        return true;
    }

    if (isJsonOrJsoncLangId(textDocument)) {
        let startOfDocument = textDocument.getText(new Range(new Position(0, 0), new Position(maxLinesToDetectSchemaIn - 1, 0)));

        // Do a quick dirty check if the first portion of the JSON contains a schema string that we're interested in
        // (might not actually be in a $schema property, though)
        return startOfDocument && containsArmSchema(startOfDocument);
    }

    return false;
}

export function containsArmSchema(json: string): boolean {
    return json && containsArmSchemaRegex.test(json);
}

export function isArmSchema(json: string | undefined | null): boolean {
    return json && isArmSchemaRegex.test(json);
}
