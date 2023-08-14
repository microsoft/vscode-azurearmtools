// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as path from 'path';
import { languages, Position, Range, TextDocument, workspace } from "vscode";
import { armTemplateLanguageId, configKeys, configPrefix, documentSchemes } from "../../../common";
import { containsArmSchema, containsParametersSchema } from "./schemas";

export const templateDocumentSelector = [
    { language: armTemplateLanguageId, scheme: documentSchemes.file },
    { language: armTemplateLanguageId, scheme: documentSchemes.untitled } // unsaved files
];

export const parameterDocumentSelector = [
    { language: 'json', scheme: documentSchemes.file },
    { language: 'json', scheme: documentSchemes.untitled },
    { language: 'jsonc', scheme: documentSchemes.file },
    { language: 'jsonc', scheme: documentSchemes.untitled },
];

export const templateOrParameterDocumentSelector = [
    { language: armTemplateLanguageId, scheme: documentSchemes.file },
    { language: armTemplateLanguageId, scheme: documentSchemes.untitled },
    { language: 'json', scheme: documentSchemes.file },
    { language: 'json', scheme: documentSchemes.untitled },
    { language: 'jsonc', scheme: documentSchemes.file },
    { language: 'jsonc', scheme: documentSchemes.untitled },
];

const maxLinesToDetectSchemaIn = 500;

function isJsonOrJsoncLangId(textDocument: TextDocument): boolean {
    return textDocument.languageId === 'json' || textDocument.languageId === 'jsonc';
}

// We keep track of arm-template files, of course,
// but also JSON/JSONC so we can check them for the ARM deployment and parameters schemas
function shouldWatchDocument(textDocument: TextDocument): boolean {
    if (
        textDocument.uri.scheme !== documentSchemes.file
        && textDocument.uri.scheme !== documentSchemes.untitled // unsaved files
        // 'git' is the scheme that is used for documents in the left-hand side of the git 'changes'
        // view.  If we don't switch to arm-template for it, the JSON language server will kick in
        // and show false positive errors
        && textDocument.uri.scheme !== documentSchemes.git
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

        const startOfDocument = textDocument.getText(new Range(new Position(0, 0), new Position(maxLinesToDetectSchemaIn - 1, 0)));

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
        const startOfDocument = textDocument.getText(new Range(new Position(0, 0), new Position(maxLinesToDetectSchemaIn - 1, 0)));

        // Do a quick dirty check if the first portion of the JSON contains a schema string that we're interested in
        // (might not actually be in a $schema property, though)
        return !!startOfDocument && containsParametersSchema(startOfDocument);
    }

    return false;
}

export function setLangIdToArm(document: TextDocument, actionContext: IActionContext): void {
    void languages.setTextDocumentLanguage(document, armTemplateLanguageId);

    actionContext.telemetry.properties.switchedToArm = 'true';
    actionContext.telemetry.properties.docLangId = document.languageId;
    actionContext.telemetry.properties.docExtension = path.extname(document.fileName);
    actionContext.telemetry.suppressIfSuccessful = false;
}
