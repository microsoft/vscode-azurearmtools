// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as Json from "../JSON";

/**
 * A visitor for Json.StringValue that calls generic code for each JSON string in the given value's subtree (inclusive)
 */
export class GenericStringVisitor extends Json.Visitor {
    private constructor(private onStringValue: (jsonStringValue: Json.StringValue) => void) {
        super();
    }

    public static visit(value: Json.Value, onStringValue: (jsonStringValue: Json.StringValue) => void): void {
        const visitor = new GenericStringVisitor(onStringValue);
        value.accept(visitor);
    }

    public visitStringValue(stringValue: Json.StringValue): void {
        // We found a string value - call the function that was given to us on it
        this.onStringValue(stringValue);
    }
}
