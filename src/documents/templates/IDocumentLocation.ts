// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri } from "vscode";

/**
 * Represents something that is contained inside a document with a URI location
 */

export interface IDocumentLocation {
    documentUri: Uri;
}
