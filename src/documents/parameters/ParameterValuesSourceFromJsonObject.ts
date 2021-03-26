// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as Json from "../../language/json/JSON";
import { IJsonDocument } from "../templates/IJsonDocument";
import { IParameterValuesSource } from "./IParameterValuesSource";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

/**
 * Retrieves parameter values from a JSON object structured like the "parameters" property value of a parameter file or
 * in the properties for a linked or nested template, e.g.:
 *
 *   "parameters": {
 *       "administratorLoginPassword": {
 *            "reference": {
 *                "keyVault": {
 *                    "id": "..."
 *                },
 *                "secretName": "mysecretpassword"
 *            }
 *        },
 *        "administratorName": {
 *            "value": "username"
 *        }
 *    }
 */
export class ParameterValuesSourceFromJsonObject implements IParameterValuesSource {
    public constructor(
        public readonly document: IJsonDocument,
        public readonly parameterValuesProperty: Json.Property | undefined,
        public readonly deploymentRootObject: Json.ObjectValue | undefined
    ) {
    }
    public getParameterValue(parameterName: string): ParameterValueDefinition | undefined {
        const parameterProperty = this.parameterValuesProperty?.value?.asObjectValue?.getProperty(parameterName);
        return parameterProperty
            ? new ParameterValueDefinition(parameterProperty)
            : undefined;
    }

    public get parameterValueDefinitions(): ParameterValueDefinition[] {
        const parameterProperties = this.parameterValuesProperty?.value?.asObjectValue?.properties;
        return parameterProperties
            ? parameterProperties.map(p => new ParameterValueDefinition(p))
            : [];
    }
}
