// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IJsonDocument } from "../IJsonDocument";
import * as Json from "../JSON";
import { IParameterValuesSource } from "./IParameterValuesSource";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

export class ParameterValuesSource implements IParameterValuesSource {
    public constructor(
        public readonly document: IJsonDocument,
        public readonly parametersProperty: Json.Property | undefined
    ) {
    }

    public getParameterValue(parameterName: string): ParameterValueDefinition | undefined {
        const parameterProperty = this.parametersProperty?.value?.asObjectValue?.getProperty(parameterName);
        return parameterProperty
            ? new ParameterValueDefinition(parameterProperty)
            : undefined;
    }

    public get parameterValueDefinitions(): ParameterValueDefinition[] {
        const parameterProperties = this.parametersProperty?.value?.asObjectValue?.properties;
        return parameterProperties
            ? parameterProperties.map(p => new ParameterValueDefinition(p))
            : [];
    }
}
