// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri } from "vscode";
import { IParameterValuesSource } from "./IParameterValuesSource";
import { IParameterValuesSourceProvider } from "./IParameterValuesSourceProvider";

/**
 * Represents a parameter values source provider that is known at construction time.  For instance, a nested
 * deployment inside a template file.
 */
export class SynchronousParameterValuesSourceProvider implements IParameterValuesSourceProvider {
    public constructor(
        private valuesSource: IParameterValuesSource
    ) {
    }

    // This is not a parameter file
    public readonly parameterFileUri: Uri | undefined;

    // tslint:disable-next-line: promise-function-async
    public getValuesSource(): Promise<IParameterValuesSource> {
        return Promise.resolve(this.valuesSource);
    }
}
