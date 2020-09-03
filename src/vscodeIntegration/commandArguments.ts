// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Range, Uri } from "vscode";
import { IParameterDefinitionsSource } from "../documents/parameters/IParameterDefinitionsSource";
import { IParameterValuesSource } from "../documents/parameters/IParameterValuesSource";

export interface IGotoParameterValueArgs {
    inParameterFile?: {
        // Can't guarantee parameter file doesn't change since the code lens was created, so resolve the parameter
        //   location only when needed
        parameterFileUri: Uri;
        parameterName: string | undefined; // If no parameter name, just navigate to the parameters property or the top of the file
    };

    inTemplateFile?: {
        documentUri: Uri;
        range: Range;
    };

    telemetryProperties?: { [key: string]: string };
}

export interface IAddMissingParametersArgs {
    parameterDefinitionsSource: IParameterDefinitionsSource;
    parameterValuesSource: IParameterValuesSource;
}

export interface IGotoResourceArgs { //asdf
    documentUri: Uri;
    range: Range;

    telemetryProperties?: { [key: string]: string };
}
