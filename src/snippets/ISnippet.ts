// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export interface ISnippet {
    /**
     * Snippet name, used as a key, only shows in UI if there's no description
     */
    name: string;
    /**
     * defines one or more trigger words that display the snippet in
     * IntelliSense. Substring matching is performed on prefixes, so
     * "fc" could match "for-const".
     */
    prefix: string;
    /**
     * Snippet body
     */
    insertText: string;
    /**
     * Snippet description
     */
    description: string;
}
