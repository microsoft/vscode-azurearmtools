// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri } from "vscode";
import { JsonDocument } from "./JsonDocument";

/**
 * Represents a JSON document that is not a deployment or parameter file
 */
export class UnsupportedJsonDocument extends JsonDocument {
    /**
     * Constructor
     *
     * @param _documentText The string text of the document
     * @param _documentUri The location of the document
     */
    constructor(documentText: string, documentUri: Uri) {
        super(documentText, documentUri);
    }
}
