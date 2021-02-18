// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { Uri } from "vscode";
import { documentSchemes } from "../constants";

/**
 * Prepends the linked template scheme to the given URI if it's not a local file
 */
export function prependLinkedTemplateScheme(uri: Uri): Uri { //asdf rename
    switch (uri.scheme) {
        case documentSchemes.file:
        case documentSchemes.git:
        case documentSchemes.untitled:
        case documentSchemes.linkedTemplate:
            return uri;

        default:
            const newUri = `${documentSchemes.linkedTemplate}:${uri.toString()}`; //asdf encode?
            return Uri.parse(newUri);
    }
}

export function removeLinkedTemplateScheme(uri: Uri): Uri { //asdf?
    if (uri.scheme === documentSchemes.linkedTemplate) {
        return Uri.parse(uri.toString().replace(/^linked-template:/, '').replace(/%3A/, ':')); //asdf decode?
    }

    return uri;
}
