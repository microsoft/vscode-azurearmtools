// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import * as assert from "assert";
import { Json, Language, mapJsonObjectValue } from "../extension.bundle";
import { stringify } from "./support/stringify";

suite("mapJsonObjectValue", () => {

    function parseObject(o: object): Json.ObjectValue {
        const pr = Json.parse(stringify(o));
        const obj = Json.asObjectValue(pr.value)!;
        assert(obj);
        return obj;
    }

    function newProperty(name: string, value: unknown): Json.Property {
        return new Json.Property(
            new Language.Span(0, 0),
            new Json.StringValue(new Language.Span(0, 0), `"${name}"`),
            Json.parse(stringify(value)).value
        );
    }

    test("no changes - should be same object exactly", () => {
        const o = parseObject({
            a: "a",
            b: "b"
        });

        assert(o === mapJsonObjectValue(o, p => p));
    });

    test("single replacement", () => {
        const o = parseObject({
            a: "a",
            b: "b"
        });

        const repl = mapJsonObjectValue(o, p => p.nameValue.unquotedValue === "b" ? newProperty("c", "c") : p);
        assert.deepStrictEqual(repl.propertyNames, ["a", "c"]);
    });

    test("replace with two properties", () => {
        const o = parseObject({
            a: "a",
            b: "b",
            c: "c"
        });

        const repl = mapJsonObjectValue(
            o,
            p => p.nameValue.unquotedValue === "b" ? [newProperty("b1", "b1"), newProperty("b2", "b2")] : p
        );
        assert.deepStrictEqual(repl.propertyNames, ["a", "b1", "b2", "c"]);
    });

    test("no deep replacement", () => {
        const o = parseObject({
            a: "a",
            b: {
                b1: "b1",
                b2: "b2"
            },
            c: "c"
        });

        const repl = mapJsonObjectValue(
            o,
            p => p.nameValue.unquotedValue === "b1" ? [newProperty("b1a", "b1a"), newProperty("b1b", "b1b")] : p
        );
        assert.deepStrictEqual(repl.propertyNames, ["a", "b", "c"]);
        assert.deepStrictEqual(Json.asObjectValue(repl.getPropertyValue("b"))!.propertyNames, ["b1", "b2"]);
    });
});
