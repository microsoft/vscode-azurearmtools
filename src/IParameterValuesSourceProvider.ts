// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri } from "vscode";
import { IParameterValuesSource } from "./parameterFiles/IParameterValuesSource";

/**
 * Represents parameter values for a deployment. This could be from a parameter file or parameter values for
 * nested or linked templates
 */
export interface IParameterValuesSourceProvider {
    /**
     * If this represents a parameter file, returns its URL, otherwise undefined.
     */
    parameterFileUri: Uri | undefined;

    /**
     * Retrieve the actual parameters, perhaps asynchronously (e.g. for a parameter file, where it has to be loaded)
     */
    getValuesSource(): Promise<IParameterValuesSource>;
}
