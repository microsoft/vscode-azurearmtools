// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as Json from "./JSON";
import * as language from "./Language";
import { TemplateScope } from "./TemplateScope";

export interface IResource {
    childDeployment: TemplateScope | undefined;
    span: language.Span;
    nameValue: Json.StringValue | undefined;
}
