// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { LineColPos } from '../../language/LineColPos';
import { Span } from '../../language/Span';
import { IDocumentLocation } from "./IDocumentLocation";

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
    getDocumentText(span: Span, offsetIndex?: number): string;

    getDocumentPosition(documentCharacterIndex: number): LineColPos;
}
