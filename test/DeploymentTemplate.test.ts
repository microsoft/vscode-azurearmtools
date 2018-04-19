// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import * as Json from "../src/JSON";
import * as language from "../src/Language";
import * as Reference from "../src/Reference";

import { DeploymentTemplate } from "../src/DeploymentTemplate";
import { Histogram } from "../src/Histogram";
import { ReferenceInVariableDefinitionJSONVisitor } from "../src/DeploymentTemplate";
import { ParameterDefinition } from "../src/ParameterDefinition";

suite("DeploymentTemplate", () => {
    suite("constructor(string)", () => {
        test("Null stringValue", () => {
            assert.throws(() => { new DeploymentTemplate(null, "id"); });
        });

        test("Undefined stringValue", () => {
            assert.throws(() => { new DeploymentTemplate(undefined, "id"); });
        });

        test("Empty stringValue", () => {
            const dt = new DeploymentTemplate("", "id");
            assert.deepStrictEqual("", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.parameterDefinitions);
            assert.equal(null, dt.schemaUri);
        });

        test("Non-JSON stringValue", () => {
            const dt = new DeploymentTemplate("I'm not a JSON file", "id");
            assert.deepStrictEqual("I'm not a JSON file", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.parameterDefinitions);
            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with number parameters definition", () => {
            const dt = new DeploymentTemplate("{ 'parameters': 21 }", "id");
            assert.deepStrictEqual("{ 'parameters': 21 }", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.parameterDefinitions);
            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with empty object parameters definition", () => {
            const dt = new DeploymentTemplate("{ 'parameters': {} }", "id");
            assert.deepStrictEqual("{ 'parameters': {} }", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.parameterDefinitions);
            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with one parameter definition", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'num': { 'type': 'number' } } }", "id");
            assert.deepStrictEqual("{ 'parameters': { 'num': { 'type': 'number' } } }", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            const parameterDefinitions: ParameterDefinition[] = dt.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: ParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.name.toString(), "num");
            assert.deepStrictEqual(pd0.description, null);
            assert.deepStrictEqual(pd0.span, new language.Span(18, 27));
            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with one parameter definition with null description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': null } } } }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            const parameterDefinitions: ParameterDefinition[] = dt.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: ParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.name.toString(), "num");
            assert.deepStrictEqual(pd0.description, null);
            assert.deepStrictEqual(pd0.span, new language.Span(18, 64));
            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with one parameter definition with empty description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': '' } } } }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            const parameterDefinitions: ParameterDefinition[] = dt.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: ParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.name.toString(), "num");
            assert.deepStrictEqual(pd0.description, "");
            assert.deepStrictEqual(pd0.span, new language.Span(18, 62));
            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with one parameter definition with non-empty description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': 'num description' } } } }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            const parameterDefinitions: ParameterDefinition[] = dt.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: ParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.name.toString(), "num");
            assert.deepStrictEqual(pd0.description, "num description");
            assert.deepStrictEqual(pd0.span, new language.Span(18, 77));
            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with number variable definitions", () => {
            const dt = new DeploymentTemplate("{ 'variables': 12 }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual("{ 'variables': 12 }", dt.documentText);
            assert.deepStrictEqual([], dt.variableDefinitions);
            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with one variable definition", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'variables': { 'a': 'A' } }", "id");
            assert.deepStrictEqual(dt.documentId, "id");
            assert.deepStrictEqual(dt.documentText, "{ 'variables': { 'a': 'A' } }");
            assert.deepStrictEqual(dt.variableDefinitions.length, 1);
            assert.deepStrictEqual(dt.variableDefinitions[0].name.toString(), "a");

            const variableDefinition: Json.StringValue = Json.asStringValue(dt.variableDefinitions[0].value);
            assert(variableDefinition);
            assert.deepStrictEqual(variableDefinition.span, new language.Span(22, 3));
            assert.deepStrictEqual(variableDefinition.toString(), "A");

            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with two variable definitions", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'a': 'A', 'b': 2 } }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual("{ 'variables': { 'a': 'A', 'b': 2 } }", dt.documentText);
            assert.deepStrictEqual(dt.variableDefinitions.length, 2);

            assert.deepStrictEqual(dt.variableDefinitions[0].name.toString(), "a");
            const a: Json.StringValue = Json.asStringValue(dt.variableDefinitions[0].value);
            assert(a);
            assert.deepStrictEqual(a.span, new language.Span(22, 3));
            assert.deepStrictEqual(a.toString(), "A");

            assert.deepStrictEqual(dt.variableDefinitions[1].name.toString(), "b");
            const b: Json.NumberValue = Json.asNumberValue(dt.variableDefinitions[1].value);
            assert(b);
            assert.deepStrictEqual(b.span, new language.Span(32, 1));

            assert.equal(null, dt.schemaUri);
        });

        test("JSON stringValue with $schema property", () => {
            const dt = new DeploymentTemplate("{ '$schema': 'a' }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual("a", dt.schemaUri);
            assert.deepStrictEqual("a", dt.schemaUri);
        });
    });

    suite("hasValidSchemaUri()", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplate("", "id");
            assert.equal(false, dt.hasValidSchemaUri());
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplate("{}", "id");
            assert.equal(false, dt.hasValidSchemaUri());
        });

        test("with empty schema", () => {
            const dt = new DeploymentTemplate("{ '$schema': '' }", "id");
            assert.equal(false, dt.hasValidSchemaUri());
        });

        test("with invalid schema uri", () => {
            const dt = new DeploymentTemplate("{ '$schema': 'www.bing.com' }", "id");
            assert.equal(false, dt.hasValidSchemaUri());
        });

        test("with valid schema uri", () => {
            const dt = new DeploymentTemplate("{ '$schema': 'https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#' }", "id");
            assert.equal(true, dt.hasValidSchemaUri());
        });
    });

    suite("errors", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplate("", "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(errors, []);
            });
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplate("{}", "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(errors, []);
            });
        });

        test("with one property deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': 'value' }", "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(errors, []);
            });
        });

        test("with one TLE parse error deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[concat()' }", "id");
            const expectedErrors = [
                new language.Issue(new language.Span(20, 1), "Expected a right square bracket (']').")
            ];
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one undefined parameter error deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[parameters(\"test\")]' }", "id");
            const expectedErrors = [
                new language.Issue(new language.Span(23, 6), "Undefined parameter reference: \"test\"")
            ];
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one undefined variable error deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[variables(\"test\")]' }", "id");
            const expectedErrors = [
                new language.Issue(new language.Span(22, 6), "Undefined variable reference: \"test\"")
            ];
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one unrecognized function error deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[blah(\"test\")]' }", "id");
            const expectedErrors = [
                new language.Issue(new language.Span(12, 4), "Unrecognized function name 'blah'.")
            ];
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with reference() call in variable definition", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new language.Issue(new language.Span(24, 9), "reference() cannot be invoked inside of a variable definition.")]
                );
            });
        });

        test("with reference() call inside a different expression in a variable definition", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[concat(reference('test'))]" } }`, "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new language.Issue(new language.Span(31, 9), "reference() cannot be invoked inside of a variable definition.")]);
            });
        });

        test("with unnamed property access on variable reference", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": {} }, "z": "[variables('a').]" }`, "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new language.Issue(new language.Span(50, 1), "Expected a literal value.")]);
            });
        });

        test("with property access on variable reference without variable name", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": {} }, "z": "[variables().b]" }`, "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new language.Issue(new language.Span(35, 11), "The function 'variables' takes 1 argument.")]);
            });
        });

        test("with property access on string variable reference", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "A" }, "z": "[variables('a').b]" }`, "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new language.Issue(new language.Span(51, 1), `Property "b" is not a defined property of "variables('a')".`)]);
            });
        });

        test("with undefined variable reference child property", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": {} }, "z": "[variables('a').b]" }`, "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new language.Issue(new language.Span(50, 1), `Property "b" is not a defined property of "variables('a')".`)]);
            });
        });

        test("with undefined variable reference grandchild property", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": { "b": {} } }, "z": "[variables('a').b.c]" }`, "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new language.Issue(new language.Span(61, 1), `Property "c" is not a defined property of "variables('a').b".`)]);
            });
        });

        test("with undefined variable reference child and grandchild properties", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": { "d": {} } }, "z": "[variables('a').b.c]" }`, "id");
            return dt.errors.then((errors: language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new language.Issue(new language.Span(59, 1), `Property "b" is not a defined property of "variables('a')".`)]);
            });
        });
    });

    suite("warnings", () => {
        test("with unused parameter", () => {
            const dt = new DeploymentTemplate(`{ "parameters": { "a": {} } }`, "id");
            assert.deepStrictEqual(
                dt.warnings,
                [new language.Issue(new language.Span(18, 3), "The parameter 'a' is never used.")]);
        });

        test("with no unused parameters", () => {
            const dt = new DeploymentTemplate(`{ "parameters": { "a": {} }, "b": "[parameters('a')] }`, "id");
            assert.deepStrictEqual(dt.warnings, []);
            assert.deepStrictEqual(dt.warnings, []);
        });

        test("with unused variable", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "A" } }`, "id");
            assert.deepStrictEqual(
                dt.warnings,
                [new language.Issue(new language.Span(17, 3), "The variable 'a' is never used.")]);
        });

        test("with no unused variables", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "A" }, "b": "[variables('a')] }`, "id");
            assert.deepStrictEqual(dt.warnings, []);
            assert.deepStrictEqual(dt.warnings, []);
        });
    });

    suite("get functionCounts()", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplate("", "id");
            const expectedHistogram = new Histogram();
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplate("{}", "id");
            const expectedHistogram = new Histogram();
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
        });

        test("with one property object deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': 'value' }", "id");
            const expectedHistogram = new Histogram();
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
        });

        test("with one TLE function deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[concat()]' }", "id");
            const expectedHistogram = new Histogram();
            expectedHistogram.add("concat");
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
        });

        test("with two TLE functions in different TLEs deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[concat()]', 'height': '[add()]' }", "id");
            const expectedHistogram = new Histogram();
            expectedHistogram.add("concat");
            expectedHistogram.add("add");
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
            assert.deepStrictEqual(expectedHistogram, dt.functionCounts);
        });
    });

    suite("get jsonParseResult()", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplate("", "id");
            assert(dt.jsonParseResult);
            assert.equal(0, dt.jsonParseResult.tokenCount);
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplate("{}", "id");
            assert(dt.jsonParseResult);
            assert.equal(2, dt.jsonParseResult.tokenCount);
        });
    });

    suite("get parameterDefinitions()", () => {
        test("with no parameters property", () => {
            const dt = new DeploymentTemplate("{}", "id");
            assert.deepStrictEqual(dt.parameterDefinitions, []);
        });

        test("with null parameters property", () => {
            const dt = new DeploymentTemplate("{ 'parameters': null }", "id");
            assert.deepStrictEqual(dt.parameterDefinitions, []);
        });

        test("with string parameters property", () => {
            const dt = new DeploymentTemplate("{ 'parameters': 'hello' }", "id");
            assert.deepStrictEqual(dt.parameterDefinitions, []);
        });

        test("with number parameters property", () => {
            const dt = new DeploymentTemplate("{ 'parameters': 1 }", "id");
            assert.deepStrictEqual(dt.parameterDefinitions, []);
        });

        test("with empty object parameters property", () => {
            const dt = new DeploymentTemplate("{ 'parameters': {} }", "id");
            assert.deepStrictEqual(dt.parameterDefinitions, []);
        });

        test("with empty object parameter", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'a': {} } }", "id");
            const parameterDefinitions: ParameterDefinition[] = dt.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: ParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.name.toString(), "a");
            assert.deepStrictEqual(pd0.description, null);
            assert.deepStrictEqual(pd0.span, new language.Span(18, 7));
        });

        test("with parameter with metadata but no description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'a': { 'metadata': {} } } }", "id");
            const parameterDefinitions: ParameterDefinition[] = dt.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: ParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.name.toString(), "a");
            assert.deepStrictEqual(pd0.description, null);
            assert.deepStrictEqual(pd0.span, new language.Span(18, 23));
        });

        test("with parameter with metadata and description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'a': { 'metadata': { 'description': 'b' } } } }", "id");
            const parameterDefinitions: ParameterDefinition[] = dt.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: ParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.name.toString(), "a");
            assert.deepStrictEqual(pd0.description, "b");
            assert.deepStrictEqual(pd0.span, new language.Span(18, 43));
        });
    });

    suite("getParameterDefinition(string)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.throws(() => { dt.getParameterDefinition(null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.throws(() => { dt.getParameterDefinition(undefined); });
        });

        test("with empty", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.throws(() => { dt.getParameterDefinition(""); });
        });

        test("with no parameters definition", () => {
            const dt = new DeploymentTemplate("{}", "id");
            assert.deepStrictEqual(null, dt.getParameterDefinition("spam"));
        });

        test("with unquoted non-match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.deepStrictEqual(null, dt.getParameterDefinition("spam"));
        });

        test("with one-sided-quote non-match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.deepStrictEqual(null, dt.getParameterDefinition("'spam"));
        });

        test("with quoted non-match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.deepStrictEqual(null, dt.getParameterDefinition("'spam'"));
        });

        test("with unquoted match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            const apples: ParameterDefinition = dt.getParameterDefinition("apples");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.span, new language.Span(18, 30));
            assert.deepStrictEqual(apples.name.span, new language.Span(18, 8), "Wrong name.span");
            assert.deepStrictEqual(apples.name.unquotedSpan, new language.Span(19, 6), "Wrong name.unquotedSpan");
        });

        test("with one-sided-quote match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            const apples: ParameterDefinition = dt.getParameterDefinition("'apples");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.span, new language.Span(18, 30));
        });

        test("with quoted match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            const apples: ParameterDefinition = dt.getParameterDefinition("'apples'");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.span, new language.Span(18, 30));
        });

        test("with case insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            const apples: ParameterDefinition = dt.getParameterDefinition("'APPLES'");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.span, new language.Span(18, 30));
        });

        test("with case sensitive and insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'APPLES': { 'type': 'integer' } } }", "id");
            const APPLES: ParameterDefinition = dt.getParameterDefinition("'APPLES'");
            assert(APPLES);
            assert.deepStrictEqual(APPLES.name.toString(), "APPLES");
            assert.deepStrictEqual(APPLES.description, null);
            assert.deepStrictEqual(APPLES.span, new language.Span(50, 31));

            const apples: ParameterDefinition = dt.getParameterDefinition("'APPles'");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.span, new language.Span(18, 30));
        });
    });

    suite("findParameterDefinitionsWithPrefix(string)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.throws(() => { dt.findParameterDefinitionsWithPrefix(null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.throws(() => { dt.findParameterDefinitionsWithPrefix(undefined); });
        });

        test("with empty", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");

            const matches: ParameterDefinition[] = dt.findParameterDefinitionsWithPrefix("");
            assert(matches);
            assert.deepStrictEqual(matches.length, 2);

            const match0: ParameterDefinition = matches[0];
            assert(match0);
            assert.deepStrictEqual(match0.name.toString(), "apples");
            assert.deepStrictEqual(match0.description, null);
            assert.deepStrictEqual(match0.span, new language.Span(18, 30));

            const match1: ParameterDefinition = matches[1];
            assert(match1);
            assert.deepStrictEqual(match1.name.toString(), "bananas");
            assert.deepStrictEqual(match1.description, null);
            assert.deepStrictEqual(match1.span, new language.Span(50, 32));
        });

        test("with prefix of one of the parameters", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");

            const matches: ParameterDefinition[] = dt.findParameterDefinitionsWithPrefix("ap");
            assert(matches);
            assert.deepStrictEqual(matches.length, 1);

            const match0: ParameterDefinition = matches[0];
            assert(match0);
            assert.deepStrictEqual(match0.name.toString(), "apples");
            assert.deepStrictEqual(match0.description, null);
            assert.deepStrictEqual(match0.span, new language.Span(18, 30));
        });

        test("with prefix of none of the parameters", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.deepStrictEqual(dt.findParameterDefinitionsWithPrefix("ca"), []);
        });

        test("with case insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");

            const matches: ParameterDefinition[] = dt.findParameterDefinitionsWithPrefix("APP");
            assert(matches);
            assert.deepStrictEqual(matches.length, 1);

            const match0: ParameterDefinition = matches[0];
            assert(match0);
            assert.deepStrictEqual(match0.name.toString(), "apples");
            assert.deepStrictEqual(match0.description, null);
            assert.deepStrictEqual(match0.span, new language.Span(18, 30));
        });

        test("with case sensitive and insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'APPLES': { 'type': 'integer' } } }", "id");

            const matches: ParameterDefinition[] = dt.findParameterDefinitionsWithPrefix("APP");
            assert(matches);
            assert.deepStrictEqual(matches.length, 2);

            const match0: ParameterDefinition = matches[0];
            assert(match0);
            assert.deepStrictEqual(match0.name.toString(), "apples");
            assert.deepStrictEqual(match0.description, null);
            assert.deepStrictEqual(match0.span, new language.Span(18, 30));

            const match1: ParameterDefinition = matches[1];
            assert(match1);
            assert.deepStrictEqual(match1.name.toString(), "APPLES");
            assert.deepStrictEqual(match1.description, null);
            assert.deepStrictEqual(match1.span, new language.Span(50, 31));
        });
    });

    suite("getVariableDefinition(string)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.throws(() => { dt.getVariableDefinition(null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.throws(() => { dt.getVariableDefinition(undefined); });
        });

        test("with empty", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.throws(() => { dt.getVariableDefinition(""); });
        });

        test("with no variables definition", () => {
            const dt = new DeploymentTemplate("{}", "id");
            assert.deepStrictEqual(null, dt.getVariableDefinition("spam"));
        });

        test("with unquoted non-match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.deepStrictEqual(null, dt.getVariableDefinition("spam"));
        });

        test("with one-sided-quote non-match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.deepStrictEqual(null, dt.getVariableDefinition("'spam"));
        });

        test("with quoted non-match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.deepStrictEqual(null, dt.getVariableDefinition("'spam'"));
        });

        test("with unquoted match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");

            const apples: Json.Property = dt.getVariableDefinition("apples");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");

            const value: Json.Value = Json.asStringValue(apples.value);
            assert(value);
            assert.deepStrictEqual(value.span, new language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with one-sided-quote match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");

            const apples: Json.Property = dt.getVariableDefinition("'apples");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");

            const value: Json.StringValue = Json.asStringValue(apples.value);
            assert(value);
            assert.deepStrictEqual(value.span, new language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with quoted match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");

            const apples: Json.Property = dt.getVariableDefinition("'apples'");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");

            const value: Json.StringValue = Json.asStringValue(apples.value);
            assert(value);
            assert.deepStrictEqual(value.span, new language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with case insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");

            const apples: Json.Property = dt.getVariableDefinition("'APPLES");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");

            const value: Json.StringValue = Json.asStringValue(apples.value);
            assert(value);
            assert.deepStrictEqual(value.span, new language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with case sensitive and insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'APPLES': 'good' } }", "id");

            const APPLES: Json.Property = dt.getVariableDefinition("'APPLES'");
            assert(APPLES);
            assert.deepStrictEqual(APPLES.name.toString(), "APPLES");

            const APPLESvalue: Json.StringValue = Json.asStringValue(APPLES.value);
            assert(APPLESvalue);
            assert.deepStrictEqual(APPLESvalue.span, new language.Span(44, 6));
            assert.deepStrictEqual(APPLESvalue.toString(), "good");

            const apples: Json.Property = dt.getVariableDefinition("'APPles'");
            assert(apples);
            assert.deepStrictEqual(apples.name.toString(), "apples");

            const value: Json.StringValue = Json.asStringValue(apples.value);
            assert(value);
            assert.deepStrictEqual(value.span, new language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });
    });

    suite("findVariableDefinitionsWithPrefix(string)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");
            assert.throws(() => { dt.findVariableDefinitionsWithPrefix(null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");
            assert.throws(() => { dt.findVariableDefinitionsWithPrefix(undefined); });
        });

        test("with empty", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");

            const definitions: Json.Property[] = dt.findVariableDefinitionsWithPrefix("");
            assert.deepStrictEqual(definitions.length, 2);

            const apples: Json.Property = definitions[0];
            assert.deepStrictEqual(apples.name.toString(), "apples");
            const applesValue: Json.StringValue = Json.asStringValue(apples.value);
            assert(applesValue);
            assert.deepStrictEqual(applesValue.span, new language.Span(27, 8));
            assert.deepStrictEqual(applesValue.toString(), "APPLES");

            const bananas: Json.Property = definitions[1];
            assert.deepStrictEqual(bananas.name.toString(), "bananas");
            const bananasValue: Json.NumberValue = Json.asNumberValue(bananas.value);
            assert.deepStrictEqual(bananasValue.span, new language.Span(48, 2));
        });

        test("with prefix of one of the variables", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");

            const definitions: Json.Property[] = dt.findVariableDefinitionsWithPrefix("ap");
            assert.deepStrictEqual(definitions.length, 1);

            const apples: Json.Property = definitions[0];
            assert.deepStrictEqual(apples.name.toString(), "apples");
            const applesValue: Json.StringValue = Json.asStringValue(apples.value);
            assert(applesValue);
            assert.deepStrictEqual(applesValue.span, new language.Span(27, 8));
            assert.deepStrictEqual(applesValue.toString(), "APPLES");
        });

        test("with prefix of none of the variables", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");
            assert.deepStrictEqual([], dt.findVariableDefinitionsWithPrefix("ca"));
        });
    });

    suite("getContextFromDocumentLineAndColumnIndexes(number, number)", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplate("", "id");
            const context = dt.getContextFromDocumentLineAndColumnIndexes(0, 0);
            assert(context);
            assert.equal(0, context.documentLineIndex);
            assert.equal(0, context.documentColumnIndex);
            assert.equal(0, context.documentCharacterIndex);
        });
    });

    suite("findReferences(Reference.Type, string)", () => {
        test("with null type", () => {
            const dt = new DeploymentTemplate("", "id");
            assert.throws(() => { dt.findReferences(null, "rName"); });
        });

        test("with undefined type", () => {
            const dt = new DeploymentTemplate("", "id");
            assert.throws(() => { dt.findReferences(undefined, "rName"); });
        });

        test("with null name", () => {
            const dt = new DeploymentTemplate("", "id");
            const list: Reference.List = dt.findReferences(Reference.ReferenceKind.Parameter, null);
            assert(list);
            assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Parameter);
            assert.deepStrictEqual(list.spans, []);
        });

        test("with undefined name", () => {
            const dt = new DeploymentTemplate("", "id");
            const list: Reference.List = dt.findReferences(Reference.ReferenceKind.Parameter, undefined);
            assert(list);
            assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Parameter);
            assert.deepStrictEqual(list.spans, []);
        });

        test("with empty name", () => {
            const dt = new DeploymentTemplate("", "id");
            const list: Reference.List = dt.findReferences(Reference.ReferenceKind.Parameter, "");
            assert(list);
            assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Parameter);
            assert.deepStrictEqual(list.spans, []);
        });

        test("with parameter type and no matching parameter definition", () => {
            const dt = new DeploymentTemplate(`{ "parameters": { "pName": {} } }`, "id");
            const list: Reference.List = dt.findReferences(Reference.ReferenceKind.Parameter, "dontMatchMe");
            assert(list);
            assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Parameter);
            assert.deepStrictEqual(list.spans, []);
        });

        test("with parameter type and matching parameter definition", () => {
            const dt = new DeploymentTemplate(`{ "parameters": { "pName": {} } }`, "id");
            const list: Reference.List = dt.findReferences(Reference.ReferenceKind.Parameter, "pName");
            assert(list);
            assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Parameter);
            assert.deepStrictEqual(list.spans, [new language.Span(19, 5)]);
        });

        test("with variable type and no matching variable definition", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "vName": {} } }`, "id");
            const list: Reference.List = dt.findReferences(Reference.ReferenceKind.Variable, "dontMatchMe");
            assert(list);
            assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Variable);
            assert.deepStrictEqual(list.spans, []);
        });

        test("with variable type and matching variable definition", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "vName": {} } }`, "id");
            const list: Reference.List = dt.findReferences(Reference.ReferenceKind.Variable, "vName");
            assert(list);
            assert.deepStrictEqual(list.kind, Reference.ReferenceKind.Variable);
            assert.deepStrictEqual(list.spans, [new language.Span(18, 5)]);
        });
    });
});

suite("ReferenceInVariableDefinitionJSONVisitor", () => {
    suite("constructor(DeploymentTemplate)", () => {
        test("with null", () => {
            assert.throws(() => { new ReferenceInVariableDefinitionJSONVisitor(null); });
        });

        test("with undefined", () => {
            assert.throws(() => { new ReferenceInVariableDefinitionJSONVisitor(undefined); });
        });

        test("with deploymentTemplate", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
            const visitor = new ReferenceInVariableDefinitionJSONVisitor(dt);
            assert.deepStrictEqual(visitor.referenceSpans, []);
        });
    });

    suite("visitStringValue(Json.StringValue)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
            const visitor = new ReferenceInVariableDefinitionJSONVisitor(dt);
            assert.throws(() => { visitor.visitStringValue(null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
            const visitor = new ReferenceInVariableDefinitionJSONVisitor(dt);
            assert.throws(() => { visitor.visitStringValue(undefined); });
        });

        test("with non-TLE string", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
            const visitor = new ReferenceInVariableDefinitionJSONVisitor(dt);
            const variables: Json.StringValue = Json.asObjectValue(dt.jsonParseResult.value).properties[0].name;
            visitor.visitStringValue(variables);
            assert.deepStrictEqual(visitor.referenceSpans, []);
        });

        test("with TLE string with reference() call", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
            const visitor = new ReferenceInVariableDefinitionJSONVisitor(dt);
            const dtObject: Json.ObjectValue = Json.asObjectValue(dt.jsonParseResult.value);
            const variablesObject: Json.ObjectValue = Json.asObjectValue(dtObject.getPropertyValue("variables"));
            const tle: Json.StringValue = Json.asStringValue(variablesObject.getPropertyValue("a"));

            visitor.visitStringValue(tle);
            assert.deepStrictEqual(visitor.referenceSpans, [new language.Span(24, 9)]);
        });

        test("with TLE string with reference() call inside concat() call", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[concat(reference('test'))]" } }`, "id");
            const visitor = new ReferenceInVariableDefinitionJSONVisitor(dt);
            const dtObject: Json.ObjectValue = Json.asObjectValue(dt.jsonParseResult.value);
            const variablesObject: Json.ObjectValue = Json.asObjectValue(dtObject.getPropertyValue("variables"));
            const tle: Json.StringValue = Json.asStringValue(variablesObject.getPropertyValue("a"));

            visitor.visitStringValue(tle);
            assert.deepStrictEqual(visitor.referenceSpans, [new language.Span(31, 9)]);
        });
    });
});
