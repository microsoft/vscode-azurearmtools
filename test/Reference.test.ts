// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression  no-null-keyword max-func-body-length

import * as assert from "assert";
import { Uri } from "vscode";
import { DefinitionKind, DeploymentTemplateDoc, ReferenceList, Span } from "../extension.bundle";

suite("Reference", () => {
    suite("List", () => {
        const document = new DeploymentTemplateDoc("", Uri.parse("fake"));

        suite("constructor(Reference.Type, Span[])", () => {
            test("with null type", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new ReferenceList(<any>null); });
            });

            test("with undefined type", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new ReferenceList(<any>undefined); });
            });

            test("with null spans", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new ReferenceList(DefinitionKind.Parameter, <any>null); });
            });

            test("with undefined spans", () => {
                const list = new ReferenceList(DefinitionKind.Parameter, undefined);
                assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
                assert.deepStrictEqual(list.references, []);
                assert.deepStrictEqual(list.length, 0);
            });

            test("with empty spans", () => {
                const list = new ReferenceList(DefinitionKind.Parameter, []);
                assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
                assert.deepStrictEqual(list.references, []);
                assert.deepStrictEqual(list.length, 0);
            });

            test("with non-empty spans", () => {
                const list = new ReferenceList(DefinitionKind.Parameter, [
                    { document, span: new Span(0, 1) },
                    { document, span: new Span(2, 3) }]);
                assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
                assert.deepStrictEqual(list.references.map(r => r.span), [new Span(0, 1), new Span(2, 3)]);
                assert.deepStrictEqual(list.length, 2);
            });
        });

        suite("addAll(Reference.List)", () => {
            test("with null", () => {
                const list = new ReferenceList(DefinitionKind.Variable);
                // tslint:disable-next-line:no-any
                assert.throws(() => { list.addAll(<any>null); });
            });

            test("with undefined", () => {
                const list = new ReferenceList(DefinitionKind.Variable);
                // tslint:disable-next-line:no-any
                assert.throws(() => { list.addAll(<any>undefined); });
            });

            test("with empty list of the same type", () => {
                const list = new ReferenceList(DefinitionKind.Variable);
                list.addAll(new ReferenceList(DefinitionKind.Variable));
                assert.deepStrictEqual(list.length, 0);
                assert.deepStrictEqual(list.references, []);
            });

            test("with empty list of a different type", () => {
                const list = new ReferenceList(DefinitionKind.Variable);
                assert.throws(() => { list.addAll(new ReferenceList(DefinitionKind.Parameter)); });
            });

            test("with non-empty list", () => {
                const list = new ReferenceList(DefinitionKind.Variable);
                list.addAll(new ReferenceList(DefinitionKind.Variable, [{ document, span: new Span(10, 20) }]));
                assert.deepStrictEqual(list.references.map(r => r.span), [new Span(10, 20)]);
            });
        });
    });
});
