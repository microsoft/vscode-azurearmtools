// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IDocumentLocation } from "./IDocumentLocation";
import * as language from './Language';

/**
 * Represents a document with a URL location, contents and indexing by position
 */
export interface IDocument extends IDocumentLocation {
    /**
     * Get the document text as a string.
     */
    documentText: string;

    /**
     * Retrieves a section of the document text
     */
    getDocumentText(span: language.Span, offsetIndex?: number): string;

    getDocumentPosition(documentCharacterIndex: number): language.Position;
}
