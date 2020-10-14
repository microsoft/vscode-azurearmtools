// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import { createExpressionCompletionsTest } from "./support/createCompletionsTest";

suite("Function return value completions", () => {
    suite("Must match full function name, not just a prefix", () => {
        createExpressionCompletionsTest(
            '[resourceGrou().<!cursor!>]',
            []);
    });

    suite("Built-in function return value completions", () => {

        // REMEMBER: These are using TestData.ExpressionMetadata.json, not real metadata

        createExpressionCompletionsTest(
            '[resourceGroup().<!cursor!>]',
            ["id", "properties", "name", "location", "tags"]);
        createExpressionCompletionsTest(
            '[subscription().<!cursor!>]',
            ["displayName", "id", "subscriptionId", "tenantId"]);
        createExpressionCompletionsTest(
            '[DEployment().<!cursor!>]',
            ["name", "properties"]);
        createExpressionCompletionsTest(
            '[listKeys().<!cursor!>]',
            ["keys"]);
    });

    suite("Completions with property prefix", () => {
        createExpressionCompletionsTest(
            '[subscription().d<!cursor!>]',
            ["displayName"]);
        createExpressionCompletionsTest(
            '[subscription().DI<!cursor!>]',
            ["displayName"]);
    });
});
