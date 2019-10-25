// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ExpressionType } from "./ExpressionType";
import { INamedDefinition } from "./INamedDefinition";
import * as Json from "./JSON";
import * as language from "./Language";

/**
 * This class represents the definition of any kind of parameter in a deployment template.
 */
export interface IParameterDefinition extends INamedDefinition {
    nameValue: Json.StringValue;

    // tslint:disable-next-line:no-reserved-keywords
    type: Json.Value | null;
    validType: ExpressionType | null;

    /**
     * The full span of the definition
     */
    fullSpan: language.Span;

    // Description and defaultValue are only supported for top-level parameters
    description: string | null;
    defaultValue: Json.Value | null;
}
