// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as Json from "../../../language/json/JSON";
import { ISchemaInfo } from "../ISchemaInfo";

export interface IDeploymentSchemaReference {
    schemaStringValue: Json.StringValue | undefined;
    matchingInfo: ISchemaInfo | undefined;
}
