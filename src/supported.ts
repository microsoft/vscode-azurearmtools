import { DocumentSelector } from "vscode";

// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export let supportedDocumentSelector: DocumentSelector = [
    { language: "json", scheme: 'file' },
    { language: "jsonc", scheme: 'file' }
];

export function isLanguageIdSupported(languageId: string): boolean {
    return !!languageId && !!languageId.match(/^(json|jsonc)$/i);
}
