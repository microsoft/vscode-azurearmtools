// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri } from "vscode";
import { IParameterValuesSource } from "./parameterFiles/IParameterValuesSource";

/**
 * Represents parameter values inside a parameter file that can be loaded when needed
 */
export interface IParameterValuesSourceFromFile {
    parameterFileUri: Uri;
    fetchParameterValues(): Promise<IParameterValuesSource>;
}
