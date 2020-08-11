// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import { TemplateScope } from "./scopes/TemplateScope";

export interface IResource {
    /**
     * If this resource is a deployment, returns the scope representing the child deployment
     */
    childDeployment: TemplateScope | undefined;

    /**
     * The span of the resource object
     */
    span: Span;

    /**
     * The nameValue of the resource object in the JSON
     */
    nameValue: Json.StringValue | undefined;
    resourceTypeValue: Json.StringValue | undefined;
}
