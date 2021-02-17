// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { IParameterDefinition } from "./IParameterDefinition";
import { IParameterDefinitionsSource } from "./IParameterDefinitionsSource";

export class SimpleParameterDefinitionsSource implements IParameterDefinitionsSource {
    private _parameterDefinitions: IParameterDefinition[] = [];

    public constructor(parameterDefinitions: IParameterDefinition[] = []) {
        this.setParameterDefinitions(parameterDefinitions);
    }

    public get parameterDefinitions(): IParameterDefinition[] {
        return this._parameterDefinitions;
    }

    public setParameterDefinitions(parameterDefinitions: IParameterDefinition[]): void {
        this._parameterDefinitions = parameterDefinitions.slice(); // clone
    }
}
