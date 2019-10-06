// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression no-non-null-assertion

import { Json, Span } from "../../extension.bundle";

const fakeSpan = new Span(1, 2);

export function createStringProperty(name: string, unquotedValue: string): Json.Property {
    const prop = new Json.Property(
        fakeSpan,
        new Json.StringValue(fakeSpan, name),
        new Json.StringValue(fakeSpan, `'${unquotedValue}'`));
    return prop;
}

export function createProperty(name: string, value: Json.Value): Json.Property {
    const prop = new Json.Property(
        fakeSpan,
        new Json.StringValue(fakeSpan, name),
        value);
    return prop;
}

export function createObject(...properties: Json.Property[]): Json.ObjectValue {
    return new Json.ObjectValue(fakeSpan, properties);
}

export function createArray(...values: Json.Value[]): Json.ArrayValue {
    return new Json.ArrayValue(fakeSpan, values);
}

export function createString(value: string): Json.StringValue {
    return new Json.StringValue(fakeSpan, value);
}
