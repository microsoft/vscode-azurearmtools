/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Completion from "../Completion";
import * as language from "../Language";
import { ISnippet } from "./ISnippet";
import { SnippetContext } from "./SnippetContext";
import { SnippetInsertionContext } from "./SnippetInsertionContext";

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
    getSnippets(context: SnippetContext): Promise<ISnippet[]>;
    /**
     * Retrieve completion items for all snippets
     */
    getSnippetsAsCompletionItems(insertionContext: SnippetInsertionContext, span: language.Span): Promise<Completion.Item[]>;
}
