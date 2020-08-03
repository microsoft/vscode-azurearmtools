// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name

import * as assert from "assert";
import { Uri } from "vscode";
import { DeploymentTemplate, FunctionCountVisitor, Histogram, TemplateScope, TLE, TopLevelTemplateScope } from "../extension.bundle";

suite("FunctionCountVisitor", () => {
    const dt = new DeploymentTemplate("", Uri.file("/doc"));
    const emptyScope: TemplateScope = new TopLevelTemplateScope(dt, undefined, "empty");

    function testFunctionCountsVisitor(expressionWithoutQuotes: string, expectedFunctionCounts: { [key: string]: number }): void {
        const tleParseResult = TLE.Parser.parse(`"${expressionWithoutQuotes}"`, emptyScope);
        const visitor = FunctionCountVisitor.visit(tleParseResult.expression);

        const expected = new Histogram();
        for (let propName of Object.getOwnPropertyNames(expectedFunctionCounts)) {
            expected.add(propName, expectedFunctionCounts[propName]);
        }

        assert.deepStrictEqual(visitor.functionCounts, expected);
    }

    test("no args", () => {
        testFunctionCountsVisitor("[func1()]", {
            "func1": 1,
            "func1(0)": 1
        });
    });

    test("one arg", () => {
        testFunctionCountsVisitor("[func1('a')]", {
            "func1": 1,
            "func1(1)": 1
        });
    });

    test("one arg called 2x", () => {
        testFunctionCountsVisitor("[add(func1('a'),func1(1))]", {
            "add": 1,
            "add(2)": 1,
            "func1": 2,
            "func1(1)": 2
        });
    });

    test("one arg once, two args once", () => {
        testFunctionCountsVisitor("[add(func1('a', 2),func1(1))]", {
            "add": 1,
            "add(2)": 1,
            "func1": 2,
            "func1(1)": 1,
            "func1(2)": 1
        });
    });

    test("user function", () => {
        testFunctionCountsVisitor("[udf.func1([])]", {
            "udf.func1": 1,
            "udf.func1(1)": 1
        });
    });
});
