// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IDocument } from "./IDocument";
import * as Json from "./JSON";

/**
 * Represents an IDocument based on JSON
 */
export interface IJsonDocument extends IDocument {
    /**
     * Parse result for the JSON document as a whole
     */
    jsonParseResult: Json.ParseResult;

    /**
     * The JSON node for the top-level JSON object (if the JSON is not empty or malformed)
     */
    topLevelValue: Json.ObjectValue | undefined;
}
