// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { IParameterDefinitionsSource } from "./IParameterDefinitionsSource";
/**
 * Provides a parameterDefinitionsSource
 */

export interface IParameterDefinitionsSourceProvider {
    parameterDefinitionsSource: IParameterDefinitionsSource | undefined;
}
