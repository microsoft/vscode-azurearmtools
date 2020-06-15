/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Completion from "./Completion";
import * as language from "./Language";

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

    /**
     * Context in which this snippet can be used
     */
    context: {
        isResource: boolean;
    };
}

/**
 * Manages snippets and creates completion items for them.  We do this rather
 * than allowing them to be handled by vscode so that:
 * 1) We can control the context into which snippets can be inserted
 * 2) We can receive telemetry about snippet usage
 */
export interface ISnippetManager {
    /**
     * Retrieve all snippets
     */
    getSnippets(): Promise<ISnippet[]>;
    /**
     * Retrieve completion items for all snippets
     */
    getCompletionItems(span: language.Span, _triggerCharacter: string | undefined): Promise<Completion.Item[]>;
}
