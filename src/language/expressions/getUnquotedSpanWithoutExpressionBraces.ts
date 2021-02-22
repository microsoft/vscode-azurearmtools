// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { StringValue } from "../json/JSON";
import { Span } from "../Span";
import { isTleExpression } from "./isTleExpression";

/**
 * Given a JSON StringValue, retrieve the span of the string inside it. If it's an expression,
 * the square brackets are removed from the span.
 */
export function getUnquotedSpanWithoutExpressionBraces(stringValue: StringValue): Span {
    let span = stringValue.unquotedSpan;

    if (isTleExpression(stringValue.unquotedValue)) {
        span = span.extendLeft(-1).extendRight(-1);
    }

    return span;
}
