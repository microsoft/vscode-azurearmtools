// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { Uri } from "vscode";
import { documentSchemes } from "../constants";
import { parseUri, stringifyUri } from "./uri";

/**
 * Prepends the linked template scheme to the given URI if it's not a local file
 */
export function prependLinkedTemplateScheme(uri: Uri): Uri {
    switch (uri.scheme) {
        case documentSchemes.file:
        case documentSchemes.git:
        case documentSchemes.untitled:
        case documentSchemes.linkedTemplate:
            return uri;

        default:
            const newUri = `${documentSchemes.linkedTemplate}:${stringifyUri(uri)}`;
            return parseUri(newUri);
    }
}

export function removeLinkedTemplateScheme(uri: Uri): Uri {
    if (uri.scheme === documentSchemes.linkedTemplate) {
        return parseUri(
            stringifyUri(uri).
                replace(/^linked-template:/, ''));
    }

    return uri;
}
