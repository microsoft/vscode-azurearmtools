// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as Json from "../../language/json/JSON";
import { IJsonDocument } from "../templates/IJsonDocument";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

/**
 * Represents a "parameters" JSON object in a deployment template or parameter file
 * which contains parameter values (not definitions) for a template file or
 * linked/nested template
 */
export interface IParameterValuesSource {
    /**
     * The document containing the parameter values (could be a parameter file
     * or a template file if for a nested/linked template)
     */
    document: IJsonDocument;
    /**
     * The "parameters" property within the document which contains the
     * parameter values (keyed by their name, case insensitive)
     */
    parameterValuesProperty: Json.Property | undefined;

    // The root object for the actual template
    deploymentRootObject: Json.ObjectValue | undefined;

    // case-insensitive
    getParameterValue(parameterName: string): ParameterValueDefinition | undefined;
    parameterValueDefinitions: ParameterValueDefinition[];
}
