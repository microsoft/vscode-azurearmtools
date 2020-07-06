// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri } from "vscode";

export interface IGotoParameterValueArgs {
    parameterFileUri: Uri;
    parameterName: string;
}
