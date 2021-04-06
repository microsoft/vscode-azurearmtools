// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as vscode from "vscode";
import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import { IDocument } from "./IDocument";

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

    getJSONTokenAtDocumentCharacterIndex(documentCharacterIndex: number): Json.Token | undefined;

    // tslint:disable-next-line:function-name
    _debugShowTextAt(positionOrRange: number | Span | vscode.Range | vscode.Position): string;
}
