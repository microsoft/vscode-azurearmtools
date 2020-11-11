// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as Json from "../../../language/json/JSON";
import { findSchemaInfo } from "../schemas";
import { IDeploymentScopeReference } from "./IDeploymentScopeReference";

export function getDeploymentScope(schemaStringValue: Json.StringValue | undefined): IDeploymentScopeReference {
    const schemaUri = schemaStringValue?.unquotedValue;
    const matchingInfo = schemaUri ? findSchemaInfo(schemaUri) : undefined;
    return {
        //schemaUri: schemaUri ?? '',
        schemaStringValue,
        matchingInfo
    };
}
