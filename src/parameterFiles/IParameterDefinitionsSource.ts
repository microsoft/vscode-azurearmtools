// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IJsonDocument } from "../IJsonDocument";
import { IParameterDefinition } from "../IParameterDefinition";

/**
 * Represents a "parameters" JSON object in a deployment template
 * which contains parameter definitions for a template file or
 * linked/nested template
 */
export interface IParameterDefinitionsSource {
    /**
     * The document containing the parameter values (could be a parameter file
     * or a template file if for a nested/linked template)
     */
    document: IJsonDocument;

    parameterDefinitions: IParameterDefinition[];
}
