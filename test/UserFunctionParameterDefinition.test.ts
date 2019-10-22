// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression no-non-null-assertion

import * as assert from "assert";
import { Json, Language, UserFunctionParameterDefinition } from "../extension.bundle";
import { createStringProperty } from "./support/jsonCreation";

const fakeSpan = new Language.Span(10, 20);

suite("UserFunctionParameterDefinition", () => {
    suite("constructor(Json.Property)", () => {
        test("with null", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { UserFunctionParameterDefinition.createIfValid(<any>null); });
        });

        test("with undefined", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { UserFunctionParameterDefinition.createIfValid(<any>undefined); });
        });

        test("with no fields (invalid without name)", () => {
            const parameterDefinition = new Json.ObjectValue(new Language.Span(16, 2), []);

            const pd = UserFunctionParameterDefinition.createIfValid(parameterDefinition);

            assert(!pd, "Without a name should be invalid");
        });

        test("with just name", () => {
            const nameProperty = createStringProperty("name", "parameterName");
            const paramObject = new Json.ObjectValue(fakeSpan, [nameProperty]);

            let pd = UserFunctionParameterDefinition.createIfValid(paramObject);

            assert(pd, "Should be valid with name");
            pd = pd!;

            assert(pd.name);
            assert(pd.name.toString() === 'parameterName');
            assert.deepStrictEqual(pd.span, fakeSpan);
            assert(!pd.defaultValue);
            assert(!pd.description);
        });

        test("name case insensitive", () => {
            const nameProperty = createStringProperty("NAme", "parameterName");
            const paramObject = new Json.ObjectValue(fakeSpan, [nameProperty]);

            let pd = UserFunctionParameterDefinition.createIfValid(paramObject);

            assert(pd, "Should be valid with name");
            pd = pd!;

            assert(pd.name.toString() === 'parameterName');
        });

        test("with other fields", () => {
            const paramObject = new Json.ObjectValue(
                fakeSpan,
                [
                    createStringProperty("name", "parameterName"),
                    createStringProperty("type", "STRING"),
                    createStringProperty("unexpectedField", "Look Ma, too many hands!")
                ]);

            let pd = UserFunctionParameterDefinition.createIfValid(paramObject);

            assert(pd, "Should be valid with name");
            pd = pd!;

            assert(pd.name);
            assert(pd.name.toString() === 'parameterName');
            assert.deepStrictEqual(pd.span, fakeSpan);
            assert(!pd.defaultValue);
            assert(!pd.description);
        });
    });
});
