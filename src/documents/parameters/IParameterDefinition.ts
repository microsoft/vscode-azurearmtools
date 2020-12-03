// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { INamedDefinition } from "../../language/INamedDefinition";
import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import { ExpressionType } from "../templates/ExpressionType";
import { IJsonDocument } from "../templates/IJsonDocument";

/**
 * This class represents the definition of any kind of parameter in a deployment template.
 */
export interface IParameterDefinition extends INamedDefinition {
    // tslint:disable-next-line: no-suspicious-comment
    document: IJsonDocument; // CONSIDER: move to parent (INamedDefinition)

    nameValue: Json.StringValue;

    // tslint:disable-next-line:no-reserved-keywords
    type: Json.Value | undefined;
    validType: ExpressionType | undefined;

    /**
     * The full span of the definition
     */
    fullSpan: Span;

    // Description and defaultValue are only supported for top-level parameters
    description: string | undefined;
    defaultValue: Json.Value | undefined;
}
