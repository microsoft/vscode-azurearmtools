/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Span } from "../language/Span";
import * as Completion from "../vscodeIntegration/Completion";
import { InsertionContext } from "./InsertionContext";
import { ISnippet } from "./ISnippet";
import { Context } from "./KnownContexts";

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
    getSnippets(context: Context): Promise<ISnippet[]>;
    /**
     * Retrieve completion items for all snippets
     */
    getSnippetsAsCompletionItems(insertionContext: InsertionContext, span: Span): Promise<Completion.Item[]>;
}
