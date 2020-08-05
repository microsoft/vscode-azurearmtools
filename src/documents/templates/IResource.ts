// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import { TemplateScope } from "./scopes/TemplateScope";

export interface IResource {
    childDeployment: TemplateScope | undefined;
    span: Span;
    nameValue: Json.StringValue | undefined;
}
