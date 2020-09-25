// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Json } from "../../extension.bundle";
import { Span } from "../language/Span";
import { Context } from "./KnownContexts";

/**
 * Describes information about what could be inserted at this location (i.e., the type of snippets which are appropriate to insert here,
 * the span of insertion, the existing JSON structure, etc.)
 */
export interface InsertionContext {
    /**
     * The type of snippet that can be supported here
     */
    context: Context | undefined;

    /**
     * If immediately inside curly braces (representing an object), gives the span between the curly braces, inclusive
     */
    curlyBraces?: Span;

    /**
     * Is it inside a double-quoted string?
     */
    insideJsonString?: boolean;

    /**
     * True if the caller should trigger a completion dropdown
     */
    triggerSuggest?: boolean;

    /**
     * A list of all the JSON parents of the insertion point, going up the tree
     */
    parents?: (Json.ObjectValue | Json.ArrayValue | Json.Property)[]; // CONSIDER: does this belong here?  It's only information about adding the snippet, not determining if it's supported
}
