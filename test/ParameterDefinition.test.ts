// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression

import * as assert from "assert";
import { Uri } from "vscode";
import { DeploymentTemplateDoc, IJsonDocument, Json, ParameterDefinition, Span } from "../extension.bundle";

suite("ParameterDefinition", () => {
    suite("constructor(Json.Property)", () => {
        test("with property with no metadata", () => {
            const doc: IJsonDocument = new DeploymentTemplateDoc("", Uri.parse('https://doc'));
            const parameterName = new Json.StringValue(new Span(0, 13), "'parameterName'");
            const parameterDefinition = new Json.ObjectValue(new Span(16, 2), []);
            const property = new Json.Property(parameterName.span.union(parameterDefinition.span), parameterName, parameterDefinition);

            const pd = new ParameterDefinition(doc, property);

            assert.deepStrictEqual(pd.nameValue, parameterName);
            assert.deepStrictEqual(pd.description, undefined);
        });
    });
});
