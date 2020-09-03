// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Span } from "../../language/Span";
import * as Json from "./../../language/json/JSON";
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

    /**
     * The typeValue of the resource object in the JSON
     */
    resourceTypeValue: Json.StringValue | undefined;
}
