// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as vscode from "vscode";
import { normalizePath } from "../../util/normalizePath";
import { removeLinkedTemplateScheme } from "../../util/prependLinkedTemplateScheme";

export function getNormalizedDocumentKey(documentUri: vscode.Uri): string {
    // We want a normalized file path to use as key, but also need to differentiate documents with different URI schemes
    const uri = removeLinkedTemplateScheme(documentUri);
    return `${uri.scheme}|${normalizePath(uri)}`;
}
