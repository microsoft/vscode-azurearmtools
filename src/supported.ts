// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export let supportedDocumentSelector = ["json", "jsonc"];

export function isLanguageIdSupported(languageId: string): boolean {
    return !!languageId && !!languageId.match(/^(json|jsonc)$/i);
}
