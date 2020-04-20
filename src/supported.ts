// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Position, Range, TextDocument, workspace } from "vscode";
import { armTemplateLanguageId, configKeys, configPrefix } from "./constants";
import { containsArmSchema, containsParametersSchema } from "./schemas";

export const templateDocumentSelector = [
    { language: armTemplateLanguageId, scheme: 'file' },
    { language: armTemplateLanguageId, scheme: 'untitled' } // unsaved files
];

export const parameterDocumentSelector = [
    { language: 'json', scheme: 'file' },
    { language: 'json', scheme: 'untitled' },
    { language: 'jsonc', scheme: 'file' },
    { language: 'jsonc', scheme: 'untitled' },
];

export const templateOrParameterDocumentSelector = [
    { language: armTemplateLanguageId, scheme: 'file' },
    { language: armTemplateLanguageId, scheme: 'untitled' }, // unsaved files
    { language: 'json', scheme: 'file' },
    { language: 'json', scheme: 'untitled' },
    { language: 'jsonc', scheme: 'file' },
    { language: 'jsonc', scheme: 'untitled' },
];

const maxLinesToDetectSchemaIn = 500;

function isJsonOrJsoncLangId(textDocument: TextDocument): boolean {
    return textDocument.languageId === 'json' || textDocument.languageId === 'jsonc';
}

// We keep track of arm-template files, of course,
// but also JSON/JSONC so we can check them for the ARM deployment and parameters schemas
function shouldWatchDocument(textDocument: TextDocument): boolean {
    if (
        textDocument.uri.scheme !== 'file'
        && textDocument.uri.scheme !== 'untitled' // unsaved files
    ) {
        return false;
    }

    if (textDocument.languageId === armTemplateLanguageId) {
        return true;
    }

    return isJsonOrJsoncLangId(textDocument);
}

export function isAutoDetectArmEnabled(): boolean {
    return !!workspace.getConfiguration(configPrefix).get<boolean>(configKeys.autoDetectJsonTemplates);
}

export function mightBeDeploymentTemplate(textDocument: TextDocument): boolean {
    if (!shouldWatchDocument(textDocument)) {
        return false;
    }

    if (textDocument.languageId === armTemplateLanguageId) {
        return true;
    }

    if (isJsonOrJsoncLangId(textDocument)) {
        if (!isAutoDetectArmEnabled()) {
            return false;
        }

        let startOfDocument = textDocument.getText(new Range(new Position(0, 0), new Position(maxLinesToDetectSchemaIn - 1, 0)));

        // Do a quick dirty check if the first portion of the JSON contains a schema string that we're interested in
        // (might not actually be in a $schema property, though)
        return !!startOfDocument && containsArmSchema(startOfDocument);
    }

    return false;
}

export function mightBeDeploymentParameters(textDocument: TextDocument): boolean {
    if (!shouldWatchDocument(textDocument)) {
        return false;
    }

    if (isJsonOrJsoncLangId(textDocument)) {
        let startOfDocument = textDocument.getText(new Range(new Position(0, 0), new Position(maxLinesToDetectSchemaIn - 1, 0)));

        // Do a quick dirty check if the first portion of the JSON contains a schema string that we're interested in
        // (might not actually be in a $schema property, though)
        return !!startOfDocument && containsParametersSchema(startOfDocument);
    }

    return false;
}
