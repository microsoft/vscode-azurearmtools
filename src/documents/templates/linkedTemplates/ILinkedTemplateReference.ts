// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { LinkedFileLoadState } from "./LinkedFileLoadState";

export interface ILinkedTemplateReference {
    id: string; // Guid
    fullUri: string;
    originalPath: string;
    lineNumberInParent: number;
    columnNumberInParent: number;
    parameterValues: { [key: string]: unknown };
    loadState: LinkedFileLoadState;
    loadErrorMessage: string | undefined;
}
