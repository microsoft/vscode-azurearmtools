// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import { createExpressionCompletionsTest } from "./support/createCompletionsTest";

suite("Function return value completions", () => {
    suite("Must match full function name, not just a prefix", () => {
        createExpressionCompletionsTest(
            '[resourceGrou().!]',
            []);
    });

    suite("Built-in function return value completions", () => {

        // REMEMBER: These are using TestData.ExpressionMetadata.json, not real metadata

        createExpressionCompletionsTest(
            '[resourceGroup().!]',
            ["id", "properties", "name", "location", "tags"]);
        createExpressionCompletionsTest(
            '[subscription().!]',
            ["displayName", "id", "subscriptionId", "tenantId"]);
        createExpressionCompletionsTest(
            '[DEployment().!]',
            ["name", "properties"]);
        createExpressionCompletionsTest(
            '[listKeys().!]',
            ["keys"]);
    });

    suite("Completions with property prefix", () => {
        createExpressionCompletionsTest(
            '[subscription().d!]',
            ["displayName"]);
        createExpressionCompletionsTest(
            '[subscription().DI!]',
            ["displayName"]);
    });
});
