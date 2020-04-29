// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length insecure-random
// tslint:disable:object-literal-key-quotes no-function-expression no-non-null-assertion align no-http-string

import * as assert from "assert";
import { Uri } from "vscode";
import { DeploymentParameters, ParameterValueDefinition } from "../extension.bundle";

const fakeId = Uri.file("https://fake-id");

suite("DeploymentParameters", () => {

    suite("constructor(string)", () => {
        test("Empty stringValue", () => {
            const dt = new DeploymentParameters("", fakeId);
            assert.deepStrictEqual("", dt.documentText);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentId.fsPath);
            assert.deepStrictEqual([], dt.parameterValues);
        });

        test("Non-JSON stringValue", () => {
            const dt = new DeploymentParameters("I'm not a JSON file", fakeId);
            assert.deepStrictEqual("I'm not a JSON file", dt.documentText);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentId.fsPath);
            assert.deepStrictEqual([], dt.parameterValues);
        });

        test("JSON stringValue with number parameters definition", () => {
            const dt = new DeploymentParameters("{ 'parameters': 21 }", fakeId);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentId.fsPath);
            assert.deepStrictEqual([], dt.parameterValues);
        });

        test("JSON stringValue with empty object parameters definition", () => {
            const dt = new DeploymentParameters("{ 'parameters': {} }", fakeId);
            assert.deepStrictEqual("{ 'parameters': {} }", dt.documentText);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentId.fsPath);
            assert.deepStrictEqual([], dt.parameterValues);
        });

        test("JSON stringValue with one parameter value", () => {
            const dt = new DeploymentParameters("{ 'parameters': { 'num': { 'value': 1 } } }", fakeId);
            const parameterValues: ParameterValueDefinition[] = dt.parameterValues;
            assert(parameterValues);
            assert.deepStrictEqual(parameterValues.length, 1);
            const pd0: ParameterValueDefinition = parameterValues[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.value?.toFriendlyString(), "1");
        });

        test("JSON stringValue with one parameter definition with null value", () => {
            const dt = new DeploymentParameters("{ 'parameters': { 'num': { 'value': null } } }", fakeId);
            const parameterValues: ParameterValueDefinition[] = dt.parameterValues;
            assert(parameterValues);
            assert.deepStrictEqual(parameterValues.length, 1);
            const pd0: ParameterValueDefinition = parameterValues[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.value?.toFriendlyString(), "null");
        });

        test("JSON stringValue with one parameter definition with no value", () => {
            const dt = new DeploymentParameters("{ 'parameters': { 'num': { } } }", fakeId);
            const parameterValues: ParameterValueDefinition[] = dt.parameterValues;
            assert(parameterValues);
            assert.deepStrictEqual(parameterValues.length, 1);
            const pd0: ParameterValueDefinition = parameterValues[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.value, undefined);
        });

        test("JSON stringValue with one parameter definition defined as a string", () => {
            const dt = new DeploymentParameters("{ 'parameters': { 'num': 'whoops' } } }", fakeId);
            const parameterValues: ParameterValueDefinition[] = dt.parameterValues;
            assert(parameterValues);
            assert.deepStrictEqual(parameterValues.length, 1);
            const pd0: ParameterValueDefinition = parameterValues[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.value, undefined);
        });
    });
});
