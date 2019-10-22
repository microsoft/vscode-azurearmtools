// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression no-non-null-assertion max-func-body-length

import * as assert from "assert";
import { Json, Language, UserFunctionNamespaceDefinition } from "../extension.bundle";
import { createObject, createProperty, createStringProperty } from "./support/jsonCreation";

const fakeSpan = new Language.Span(10, 20);

suite("UserFunctionNamespaceDefinition", () => {
    suite("constructor(Json.Property)", () => {
        test("no namespace name (not valid)", () => {
            const namespaceName = createStringProperty("namespaceMisspelled", "Contoso");
            const namespaceObject = new Json.ObjectValue(fakeSpan, [namespaceName]);

            let pd = UserFunctionNamespaceDefinition.createIfValid(namespaceObject);
            assert(!pd, "No namespace name, should be invalid");
        });

        test("with namespace name", () => {
            const namespaceName = createStringProperty("namespace", "Contoso");
            const namespaceObject = new Json.ObjectValue(fakeSpan, [namespaceName]);

            let pd = UserFunctionNamespaceDefinition.createIfValid(namespaceObject);
            assert(pd);
            pd = pd!;

            assert(pd.namespaceName, "Contoso");
            assert(pd.members);
            assert.equal(pd.members.length, 0);
            assert.deepStrictEqual(pd.span, fakeSpan);
        });

        test("namespace name case insensitive", () => {
            const namespaceName = createStringProperty("namespacE", "Contoso");
            const namespaceObject = new Json.ObjectValue(fakeSpan, [namespaceName]);

            let pd = UserFunctionNamespaceDefinition.createIfValid(namespaceObject);
            assert(pd);
            pd = pd!;

            assert(pd.namespaceName, "Contoso");
        });

        suite("with members", () => {
            const namespace1 =
                createObject(
                    createStringProperty("NAMEspace", "Contoso"),
                    createProperty(
                        "members",
                        createObject(
                            createProperty("function1", createObject()),
                            createProperty("function2", createObject())
                        )),
                    createProperty(
                        "function1",
                        createObject()
                    )
                );
            const namespace2 =
                createObject(
                    createStringProperty("nameSPACE", "microsoft"),
                    createProperty(
                        "MEmbers",
                        createObject(
                            createProperty("function1", createObject()),
                            createProperty("Function2", createObject())
                        ))
                );

            test("getMemberDefinition", () => {
                let userNs = UserFunctionNamespaceDefinition.createIfValid(namespace1);
                assert(userNs);
                userNs = userNs!;

                assert(userNs.namespaceName, "Contoso");
                assert(userNs.members);
                assert.equal(userNs.members.length, 2);
                assert.equal(userNs.getMemberDefinition("function1")!.name, "function1");
            });

            test("getMemberDefinition case insensitive", () => {
                let userNs = UserFunctionNamespaceDefinition.createIfValid(namespace2);
                assert(userNs);
                userNs = userNs!;

                assert(userNs.namespaceName, "microsoft");
                assert(userNs.members);
                assert.equal(userNs.members.length, 2);
                assert(userNs.getMemberDefinition("function2"));
                assert.equal(userNs.getMemberDefinition("function2")!.name, "Function2");
            });
        });
    });
});
