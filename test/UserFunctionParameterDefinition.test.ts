// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression no-non-null-assertion

import * as assert from "assert";
import { Uri } from "vscode";
import { DeploymentTemplateDoc, IJsonDocument, Json, Span, UserFunctionParameterDefinition } from "../extension.bundle";
import { createStringProperty } from "./support/jsonCreation";

const fakeSpan = new Span(10, 20);

suite("UserFunctionParameterDefinition", () => {
    suite("constructor(Json.Property)", () => {
        const doc: IJsonDocument = new DeploymentTemplateDoc("", Uri.parse('https://doc'));

        test("with no fields (invalid without name)", () => {
            const parameterDefinition = new Json.ObjectValue(new Span(16, 2), []);

            const pd = UserFunctionParameterDefinition.createIfValid(doc, parameterDefinition);

            assert(!pd, "Without a name should be invalid");
        });

        test("with just name", () => {
            const nameProperty = createStringProperty("name", "parameterName");
            const paramObject = new Json.ObjectValue(fakeSpan, [nameProperty]);

            let pd = UserFunctionParameterDefinition.createIfValid(doc, paramObject);

            assert(pd, "Should be valid with name");
            pd = pd!;

            assert(pd.nameValue);
            assert(pd.nameValue.toString() === 'parameterName');
            assert.deepStrictEqual(pd.fullSpan, fakeSpan);
            assert(!pd.defaultValue);
            assert(!pd.description);
        });

        test("name case insensitive", () => {
            const nameProperty = createStringProperty("NAme", "parameterName");
            const paramObject = new Json.ObjectValue(fakeSpan, [nameProperty]);

            let pd = UserFunctionParameterDefinition.createIfValid(doc, paramObject);

            assert(pd, "Should be valid with name");
            pd = pd!;

            assert(pd.nameValue.toString() === 'parameterName');
        });

        test("with other fields", () => {
            const paramObject = new Json.ObjectValue(
                fakeSpan,
                [
                    createStringProperty("name", "parameterName"),
                    createStringProperty("type", "STRING"),
                    createStringProperty("unexpectedField", "Look Ma, too many hands!")
                ]);

            let pd = UserFunctionParameterDefinition.createIfValid(doc, paramObject);

            assert(pd, "Should be valid with name");
            pd = pd!;

            assert(pd.nameValue);
            assert(pd.nameValue.toString() === 'parameterName');
            assert.deepStrictEqual(pd.fullSpan, fakeSpan);
            assert(!pd.defaultValue);
            assert(!pd.description);
        });
    });
});
