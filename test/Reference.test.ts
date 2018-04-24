// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression
// tslint:disable:max-func-body-length

import * as assert from "assert";

import * as language from "../src/Language";
import * as Reference from "../src/Reference";

suite("Reference", () => {
    suite("List", () => {
        suite("constructor(Reference.Type, Span[])", () => {
            test("with null type", () => {
                assert.throws(() => { new Reference.List(null); });
            });

            test("with undefined type", () => {
                assert.throws(() => { new Reference.List(undefined); });
            });

            test("with null spans", () => {
                assert.throws(() => { new Reference.List(Reference.ReferenceKind.Parameter, null); });
            });

            test("with undefined spans", () => {
                const list = new Reference.List(Reference.ReferenceKind.Parameter, undefined);
                assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Parameter);
                assert.deepStrictEqual(list.spans, []);
                assert.deepStrictEqual(list.length, 0);
            });

            test("with empty spans", () => {
                const list = new Reference.List(Reference.ReferenceKind.Parameter, []);
                assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Parameter);
                assert.deepStrictEqual(list.spans, []);
                assert.deepStrictEqual(list.length, 0);
            });

            test("with non-empty spans", () => {
                const list = new Reference.List(Reference.ReferenceKind.Parameter, [new language.Span(0, 1), new language.Span(2, 3)]);
                assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Parameter);
                assert.deepStrictEqual(list.spans, [new language.Span(0, 1), new language.Span(2, 3)]);
                assert.deepStrictEqual(list.length, 2);
            });
        });

        suite("add(Span)", () => {
            test("with null", () => {
                const list = new Reference.List(Reference.ReferenceKind.Variable);
                assert.throws(() => { list.add(null); });
            });

            test("with undefined", () => {
                const list = new Reference.List(Reference.ReferenceKind.Variable);
                assert.throws(() => { list.add(undefined); });
            });
        });

        suite("addAll(Reference.List)", () => {
            test("with null", () => {
                const list = new Reference.List(Reference.ReferenceKind.Variable);
                assert.throws(() => { list.addAll(null); });
            });

            test("with undefined", () => {
                const list = new Reference.List(Reference.ReferenceKind.Variable);
                assert.throws(() => { list.addAll(undefined); });
            });

            test("with empty list of the same type", () => {
                const list = new Reference.List(Reference.ReferenceKind.Variable);
                list.addAll(new Reference.List(Reference.ReferenceKind.Variable));
                assert.deepStrictEqual(list.length, 0);
                assert.deepStrictEqual(list.spans, []);
            });

            test("with empty list of a different type", () => {
                const list = new Reference.List(Reference.ReferenceKind.Variable);
                assert.throws(() => { list.addAll(new Reference.List(Reference.ReferenceKind.Parameter)); });
            });

            test("with non-empty list", () => {
                const list = new Reference.List(Reference.ReferenceKind.Variable);
                list.addAll(new Reference.List(Reference.ReferenceKind.Variable, [new language.Span(10, 20)]));
                assert.deepStrictEqual(list.spans, [new language.Span(10, 20)]);
            });
        });

        suite("translate(number)", () => {
            test("with empty list", () => {
                const list = new Reference.List(Reference.ReferenceKind.Parameter);
                const list2 = list.translate(17);
                assert.deepStrictEqual(list, list2);
            });

            test("with non-empty list", () => {
                const list = new Reference.List(Reference.ReferenceKind.Parameter, [new language.Span(10, 20)]);
                const list2 = list.translate(17);
                assert.deepStrictEqual(list2, new Reference.List(Reference.ReferenceKind.Parameter, [new language.Span(27, 20)]));
            });

            test("with null movement", () => {
                const list = new Reference.List(Reference.ReferenceKind.Parameter, [new language.Span(10, 20)]);
                assert.throws(() => { list.translate(null); });
            });

            test("with undefined movement", () => {
                const list = new Reference.List(Reference.ReferenceKind.Parameter, [new language.Span(10, 20)]);
                assert.throws(() => { list.translate(undefined); });
            });
        });
    });
});
