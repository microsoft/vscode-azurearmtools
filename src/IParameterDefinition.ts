// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType } from "./ExpressionType";
import * as Json from "./JSON";
import * as language from "./Language";

/**
 * This class represents the definition of any kind of parameter in a deployment template.
 */
export interface IParameterDefinition {
    name: Json.StringValue;
    // tslint:disable-next-line:no-reserved-keywords
    type: Json.Value | null;
    validType: ExpressionType | null;
    span: language.Span;

    // We don't currently need access to the top-level parameters' "type" other properties

    // Description and defaultValue are only supported for top-level parameters
    description: string | null;
    defaultValue: Json.Value | null;
}
