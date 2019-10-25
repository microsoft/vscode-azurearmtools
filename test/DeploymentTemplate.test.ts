// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length insecure-random
// tslint:disable:object-literal-key-quotes no-function-expression no-non-null-assertion align

import * as assert from "assert";
import { randomBytes } from "crypto";
import { ISuiteCallbackContext, ITestCallbackContext } from "mocha";
import { DefinitionKind, DeploymentTemplate, Histogram, INamedDefinition, IncorrectArgumentsCountIssue, IParameterDefinition, IVariableDefinition, Json, Language, ReferenceInVariableDefinitionsVisitor, ReferenceList, TemplateScope, UnrecognizedUserFunctionIssue, UnrecognizedUserNamespaceIssue } from "../extension.bundle";
import { IDeploymentTemplate, sources, testDiagnostics } from "./support/diagnostics";
import { parseTemplate } from "./support/parseTemplate";
import { stringify } from "./support/stringify";
import { testWithLanguageServer } from "./support/testWithLanguageServer";
import { DISABLE_SLOW_TESTS } from "./testConstants";

suite("DeploymentTemplate", () => {

    function findReferences(dt: DeploymentTemplate, definitionKind: DefinitionKind, definitionName: string, scope: TemplateScope): ReferenceList {
        // tslint:disable-next-line: no-unnecessary-initializer
        let definition: INamedDefinition | null | undefined;

        // tslint:disable-next-line: switch-default
        switch (definitionKind) {
            case DefinitionKind.BuiltinFunction:
                break;
            case DefinitionKind.Namespace:
                break;
            case DefinitionKind.Parameter:
                definition = scope.getParameterDefinition(definitionName);
                break;
            case DefinitionKind.UserFunction:
                break;
            case DefinitionKind.Variable:
                definition = scope.getVariableDefinition(definitionName);
                break;
        }

        assert(definition !== undefined, "Test scenario NYI");
        if (definition === null) {
            return new ReferenceList(definitionKind, []);
        }

        return dt.findReferences(definition!);
    }

    suite("constructor(string)", () => {
        test("Null stringValue", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { new DeploymentTemplate(<any>null, "id"); });
        });

        test("Undefined stringValue", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { new DeploymentTemplate(<any>undefined, "id"); });
        });

        test("Empty stringValue", () => {
            const dt = new DeploymentTemplate("", "id");
            assert.deepStrictEqual("", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.topLevelScope.parameterDefinitions);
        });

        test("Non-JSON stringValue", () => {
            const dt = new DeploymentTemplate("I'm not a JSON file", "id");
            assert.deepStrictEqual("I'm not a JSON file", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.topLevelScope.parameterDefinitions);
        });

        test("JSON stringValue with number parameters definition", () => {
            const dt = new DeploymentTemplate("{ 'parameters': 21 }", "id");
            assert.deepStrictEqual("{ 'parameters': 21 }", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.topLevelScope.parameterDefinitions);
        });

        test("JSON stringValue with empty object parameters definition", () => {
            const dt = new DeploymentTemplate("{ 'parameters': {} }", "id");
            assert.deepStrictEqual("{ 'parameters': {} }", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.topLevelScope.parameterDefinitions);
        });

        test("JSON stringValue with one parameter definition", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'num': { 'type': 'number' } } }", "id");
            assert.deepStrictEqual("{ 'parameters': { 'num': { 'type': 'number' } } }", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.description, null);
            assert.deepStrictEqual(pd0.fullSpan, new Language.Span(18, 27));
        });

        test("JSON stringValue with one parameter definition with null description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': null } } } }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.description, null);
            assert.deepStrictEqual(pd0.fullSpan, new Language.Span(18, 64));
        });

        test("JSON stringValue with one parameter definition with empty description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': '' } } } }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.description, "");
            assert.deepStrictEqual(pd0.fullSpan, new Language.Span(18, 62));
        });

        test("JSON stringValue with one parameter definition with non-empty description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': 'num description' } } } }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.description, "num description");
            assert.deepStrictEqual(pd0.fullSpan, new Language.Span(18, 77));
        });

        test("JSON stringValue with number variable definitions", () => {
            const dt = new DeploymentTemplate("{ 'variables': 12 }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual("{ 'variables': 12 }", dt.documentText);
            assert.deepStrictEqual([], dt.topLevelScope.variableDefinitions);
        });

        test("JSON stringValue with one variable definition", () => {
            const dt: DeploymentTemplate = new DeploymentTemplate("{ 'variables': { 'a': 'A' } }", "id");
            assert.deepStrictEqual(dt.documentId, "id");
            assert.deepStrictEqual(dt.documentText, "{ 'variables': { 'a': 'A' } }");
            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions.length, 1);
            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions[0].nameValue.toString(), "a");

            const variableDefinition: Json.StringValue | null = Json.asStringValue(dt.topLevelScope.variableDefinitions[0].value);
            if (!variableDefinition) { throw new Error("failed"); }
            assert.deepStrictEqual(variableDefinition.span, new Language.Span(22, 3));
            assert.deepStrictEqual(variableDefinition.toString(), "A");
        });

        test("JSON stringValue with two variable definitions", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'a': 'A', 'b': 2 } }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual("{ 'variables': { 'a': 'A', 'b': 2 } }", dt.documentText);
            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions.length, 2);

            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions[0].nameValue.toString(), "a");
            const a: Json.StringValue | null = Json.asStringValue(dt.topLevelScope.variableDefinitions[0].value);
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Language.Span(22, 3));
            assert.deepStrictEqual(a.toString(), "A");

            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions[1].nameValue.toString(), "b");
            const b: Json.NumberValue | null = Json.asNumberValue(dt.topLevelScope.variableDefinitions[1].value);
            if (!b) { throw new Error("failed"); }
            assert.deepStrictEqual(b.span, new Language.Span(32, 1));
        });
    });

    suite("errors", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplate("", "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, []);
            });
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplate("{}", "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, []);
            });
        });

        test("with one property deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': 'value' }", "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, []);
            });
        });

        test("with one TLE parse error deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[concat()' }", "id");
            const expectedErrors = [
                new Language.Issue(new Language.Span(20, 1), "Expected a right square bracket (']').")
            ];
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one undefined parameter error deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[parameters(\"test\")]' }", "id");
            const expectedErrors = [
                new Language.Issue(new Language.Span(23, 6), "Undefined parameter reference: \"test\"")
            ];
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one undefined variable error deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': '[variables(\"test\")]' }", "id");
            const expectedErrors = [
                new Language.Issue(new Language.Span(22, 6), "Undefined variable reference: \"test\"")
            ];
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one unrecognized user namespace error deployment template", () => {
            const dt = new DeploymentTemplate("{ \"name\": \"[namespace.blah('test')]\" }", "id");
            const expectedErrors = [
                new UnrecognizedUserNamespaceIssue(new Language.Span(12, 9), "namespace")
            ];
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one unrecognized user function error deployment template", () => {
            const dt = new DeploymentTemplate(
                stringify({
                    "name": "[contoso.blah('prefix')]",
                    "functions": [
                        {
                            "namespace": "contoso",
                            "members": {
                                "uniqueName": {
                                    "parameters": [
                                        {
                                            "name": "namePrefix",
                                            "type": "string"
                                        }
                                    ],
                                    "output": {
                                        "type": "string",
                                        "value": "[concat('a')]"
                                    }
                                }
                            }
                        }
                    ]
                }),
                "id");
            const expectedErrors = [
                new UnrecognizedUserFunctionIssue(new Language.Span(22, 4), "contoso", "blah")
            ];
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one user function referenced in deployment template", () => {
            const dt = new DeploymentTemplate(
                `{
                 "name": "[contoso.uniqueName('prefix')]",
                 "functions": [
                    {
                      "namespace": "contoso",
                      "members": {
                        "uniqueName": {
                          "parameters": [
                            {
                              "name": "namePrefix",
                              "type": "string"
                            }
                          ]
                        }
                      }
                    }
                  ]
                }`,
                "id");
            const expectedErrors = [
            ];
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("with one user function where function name matches a built-in function name", async () => {
            await parseTemplate(
                // tslint:disable-next-line:no-any
                <IDeploymentTemplate><any>{
                    "name": "[contoso.reference()]", // This is not a call to the built-in "reference" function
                    "functions": [
                        {
                            "namespace": "contoso",
                            "members": {
                                "reference": {
                                }
                            }
                        }
                    ]
                },
                []);
        });

        test("with one unrecognized user function where function name matches a built-in function name", () => {
            const dt = new DeploymentTemplate(
                stringify({
                    "name": "[contoso.reference()]",
                    "functions": [
                        {
                            "namespace": "contoso",
                            "members": {
                                "uniqueName": {
                                    "parameters": [
                                        {
                                            "name": "whatever",
                                            "type": "string"
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }),
                "id");
            const expectedErrors = [
                new UnrecognizedUserFunctionIssue(new Language.Span(22, 9), "contoso", "reference")
            ];
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(errors, expectedErrors);
            });
        });

        test("can't reference variables from within user function", async () => {
            const dt = new DeploymentTemplate(
                stringify(
                    {
                        "name": "hello",
                        "variables": {
                            "nope": "nope"
                        },
                        "functions": [
                            {
                                "namespace": "contoso",
                                "members": {
                                    "foo": {
                                        "output": {
                                            "type": "string",
                                            "value": "[concat(variables('nope'))]"
                                        }
                                    }
                                }
                            }
                        ]
                    }),
                "id");
            const expectedErrors = [
                new Language.Issue(new Language.Span(243, 6), "User functions cannot reference variables")
            ];
            const errors: Language.Issue[] = await dt.errorsPromise;
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("with reference() call in variable definition", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new Language.Issue(new Language.Span(24, 9), "reference() cannot be invoked inside of a variable definition.")]
                );
            });
        });

        test("Calling user function with name 'reference' okay in variables", async () => {
            const template =
                // tslint:disable-next-line:no-any
                <IDeploymentTemplate><any>{
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "functions": [
                        {
                            "namespace": "udf",
                            "members": {
                                "reference": {
                                    "output": {
                                        "value": true,
                                        "type": "BOOL"
                                    }
                                }
                            }
                        }
                    ],
                    "resources": [
                    ],
                    "variables": {
                        "v1": "[udf.reference()]"
                    },
                    "outputs": {
                        "v1Output": {
                            "type": "bool",
                            "value": "[variables('v1')]"
                        }
                    }
                };

            await parseTemplate(template, []);
        });

        test("with reference() call inside a different expression in a variable definition", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "[concat(reference('test'))]" } }`, "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new Language.Issue(new Language.Span(31, 9), "reference() cannot be invoked inside of a variable definition.")]);
            });
        });

        test("with unnamed property access on variable reference", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": {} }, "z": "[variables('a').]" }`, "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new Language.Issue(new Language.Span(50, 1), "Expected a literal value.")]);
            });
        });

        test("with property access on variable reference without variable name", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": {} }, "z": "[variables().b]" }`, "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new IncorrectArgumentsCountIssue(new Language.Span(35, 11), "The function 'variables' takes 1 argument.", "variables", 0, 1, 1)]);
            });
        });

        test("with property access on string variable reference", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "A" }, "z": "[variables('a').b]" }`, "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new Language.Issue(new Language.Span(51, 1), `Property "b" is not a defined property of "variables('a')".`)]);
            });
        });

        test("with undefined variable reference child property", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": {} }, "z": "[variables('a').b]" }`, "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new Language.Issue(new Language.Span(50, 1), `Property "b" is not a defined property of "variables('a')".`)]);
            });
        });

        test("with undefined variable reference grandchild property", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": { "b": {} } }, "z": "[variables('a').b.c]" }`, "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new Language.Issue(new Language.Span(61, 1), `Property "c" is not a defined property of "variables('a').b".`)]);
            });
        });

        test("with undefined variable reference child and grandchild properties", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": { "d": {} } }, "z": "[variables('a').b.c]" }`, "id");
            return dt.errorsPromise.then((errors: Language.Issue[]) => {
                assert.deepStrictEqual(
                    errors,
                    [new Language.Issue(new Language.Span(59, 1), `Property "b" is not a defined property of "variables('a')".`)]);
            });
        });
    });

    suite("warnings", () => {
        test("with unused parameter", () => {
            const dt = new DeploymentTemplate(`{ "parameters": { "a": {} } }`, "id");
            assert.deepStrictEqual(
                dt.warnings,
                [new Language.Issue(new Language.Span(18, 3), "The parameter 'a' is never used.")]);
        });

        test("with no unused parameters", async () => {
            const dt = new DeploymentTemplate(`{ "parameters": { "a": {} }, "b": "[parameters('a')] }`, "id");
            assert.deepStrictEqual(dt.warnings, []);
            assert.deepStrictEqual(dt.warnings, []);
        });

        test("with unused variable", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "a": "A" } }`, "id");
            assert.deepStrictEqual(
                dt.warnings,
                [new Language.Issue(new Language.Span(17, 3), "The variable 'a' is never used.")]);
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
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplate("{}", "id");
            const expectedHistogram = new Histogram();
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with one property object deployment template", () => {
            const dt = new DeploymentTemplate("{ 'name': 'value' }", "id");
            const expectedHistogram = new Histogram();
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with one TLE function used multiple times in deployment template", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'name': '[concat()]', 'name2': '[concat(1, 2)]', 'name3': '[concat(2, 3)]' } }", "id");
            const expectedHistogram = new Histogram();
            expectedHistogram.add("concat");
            expectedHistogram.add("concat");
            expectedHistogram.add("concat");
            expectedHistogram.add("concat(0)");
            expectedHistogram.add("concat(2)");
            expectedHistogram.add("concat(2)");
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with two TLE functions in different TLEs deployment template", () => {
            const dt = new DeploymentTemplate(`{ "name": "[concat()]", "height": "[add()]" }`, "id");
            const expectedHistogram = new Histogram();
            expectedHistogram.add("concat");
            expectedHistogram.add("concat(0)");
            expectedHistogram.add("add");
            expectedHistogram.add("add(0)");
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with the same string repeated in multiple places (each use should get counted once, even though the strings are the exact same and may be cached)", () => {
            const dt = new DeploymentTemplate("{ 'name': '[concat()]', 'height': '[concat()]', 'width': \"[concat()]\" }", "id");
            assert.deepStrictEqual(3, dt.getFunctionCounts().getCount("concat(0)"));
            assert.deepStrictEqual(3, dt.getFunctionCounts().getCount("concat"));
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
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with null parameters property", () => {
            const dt = new DeploymentTemplate("{ 'parameters': null }", "id");
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with string parameters property", () => {
            const dt = new DeploymentTemplate("{ 'parameters': 'hello' }", "id");
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with number parameters property", () => {
            const dt = new DeploymentTemplate("{ 'parameters': 1 }", "id");
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with empty object parameters property", () => {
            const dt = new DeploymentTemplate("{ 'parameters': {} }", "id");
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with empty object parameter", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'a': {} } }", "id");
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "a");
            assert.deepStrictEqual(pd0.description, null);
            assert.deepStrictEqual(pd0.fullSpan, new Language.Span(18, 7));
        });

        test("with parameter with metadata but no description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'a': { 'metadata': {} } } }", "id");
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "a");
            assert.deepStrictEqual(pd0.description, null);
            assert.deepStrictEqual(pd0.fullSpan, new Language.Span(18, 23));
        });

        test("with parameter with metadata and description", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'a': { 'metadata': { 'description': 'b' } } } }", "id");
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "a");
            assert.deepStrictEqual(pd0.description, "b");
            assert.deepStrictEqual(pd0.fullSpan, new Language.Span(18, 43));
        });
    });

    suite("getParameterDefinition(string)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { dt.topLevelScope.getParameterDefinition(<any>null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { dt.topLevelScope.getParameterDefinition(<any>undefined); });
        });

        test("with empty", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.throws(() => { dt.topLevelScope.getParameterDefinition(""); });
        });

        test("with no parameters definition", () => {
            const dt = new DeploymentTemplate("{}", "id");
            assert.deepStrictEqual(null, dt.topLevelScope.getParameterDefinition("spam"));
        });

        test("with unquoted non-match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.deepStrictEqual(null, dt.topLevelScope.getParameterDefinition("spam"));
        });

        test("with one-sided-quote non-match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.deepStrictEqual(null, dt.topLevelScope.getParameterDefinition("'spam"));
        });

        test("with quoted non-match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.deepStrictEqual(null, dt.topLevelScope.getParameterDefinition("'spam'"));
        });

        test("with unquoted match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            const apples: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("apples");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.fullSpan, new Language.Span(18, 30));
            assert.deepStrictEqual(apples.nameValue.span, new Language.Span(18, 8), "Wrong name.span");
            assert.deepStrictEqual(apples.nameValue.unquotedSpan, new Language.Span(19, 6), "Wrong name.unquotedSpan");
        });

        test("with one-sided-quote match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            const apples: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("'apples");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.fullSpan, new Language.Span(18, 30));
        });

        test("with quoted match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            const apples: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("'apples'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.fullSpan, new Language.Span(18, 30));
        });

        test("with case insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            const apples: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("'APPLES'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            assert.deepStrictEqual(apples.description, null);
            assert.deepStrictEqual(apples.fullSpan, new Language.Span(18, 30));
        });

        test("with multiple case insensitive matches", () => {
            const dt = new DeploymentTemplate(
                stringify(
                    {
                        'parameters': {
                            'apples': { 'type': 'string' },
                            'APPLES': { 'type': 'integer' },
                            'Apples': { 'type': 'securestring' }
                        }
                    }),
                "id");

            // Should always match the last one defined when multiple have the same name
            const APPLES: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("'APPLES'");
            if (!APPLES) { throw new Error("failed"); }
            assert.deepStrictEqual(APPLES.nameValue.toString(), "Apples");

            const apples: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("'APPles'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "Apples");
        });

        // CONSIDER: Does JavaScript support this?  It's low priority
        // test("with case insensitive match, Unicode", () => {
        //     // Should always match the last one defined when multiple have the same name
        //     const dt = new DeploymentTemplate("{ 'parameters': { 'Strasse': { 'type': 'string' }, 'Straße': { 'type': 'integer' } } }", "id");
        //     const strasse: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("'Strasse'");
        //     if (!strasse) { throw new Error("failed"); }
        //     assert.deepStrictEqual(strasse.nameValue.toString(), "Straße");

        //     const straße: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("'Straße'");
        //     if (!straße) { throw new Error("failed"); }
        //     assert.deepStrictEqual(straße.nameValue.toString(), "Straße");

        //     const straße2: IParameterDefinition | null = dt.topLevelScope.getParameterDefinition("'STRASSE'");
        //     if (!straße2) { throw new Error("failed"); }
        //     assert.deepStrictEqual(straße2.nameValue.toString(), "Straße");
        // });
    });

    suite("findParameterDefinitionsWithPrefix(string)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { dt.topLevelScope.findParameterDefinitionsWithPrefix(<any>null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { dt.topLevelScope.findParameterDefinitionsWithPrefix(<any>undefined); });
        });

        test("with empty", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");

            const matches: IParameterDefinition[] = dt.topLevelScope.findParameterDefinitionsWithPrefix("");
            assert(matches);
            assert.deepStrictEqual(matches.length, 2);

            const match0: IParameterDefinition = matches[0];
            assert(match0);
            assert.deepStrictEqual(match0.nameValue.toString(), "apples");
            assert.deepStrictEqual(match0.description, null);
            assert.deepStrictEqual(match0.fullSpan, new Language.Span(18, 30));

            const match1: IParameterDefinition = matches[1];
            assert(match1);
            assert.deepStrictEqual(match1.nameValue.toString(), "bananas");
            assert.deepStrictEqual(match1.description, null);
            assert.deepStrictEqual(match1.fullSpan, new Language.Span(50, 32));
        });

        test("with prefix of one of the parameters", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");

            const matches: IParameterDefinition[] = dt.topLevelScope.findParameterDefinitionsWithPrefix("ap");
            assert(matches);
            assert.deepStrictEqual(matches.length, 1);

            const match0: IParameterDefinition = matches[0];
            assert(match0);
            assert.deepStrictEqual(match0.nameValue.toString(), "apples");
            assert.deepStrictEqual(match0.description, null);
            assert.deepStrictEqual(match0.fullSpan, new Language.Span(18, 30));
        });

        test("with prefix of none of the parameters", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");
            assert.deepStrictEqual(dt.topLevelScope.findParameterDefinitionsWithPrefix("ca"), []);
        });

        test("with case insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", "id");

            const matches: IParameterDefinition[] = dt.topLevelScope.findParameterDefinitionsWithPrefix("APP");
            assert(matches);
            assert.deepStrictEqual(matches.length, 1);

            const match0: IParameterDefinition = matches[0];
            assert(match0);
            assert.deepStrictEqual(match0.nameValue.toString(), "apples");
            assert.deepStrictEqual(match0.description, null);
            assert.deepStrictEqual(match0.fullSpan, new Language.Span(18, 30));
        });

        test("with case sensitive and insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'parameters': { 'apples': { 'type': 'string' }, 'APPLES': { 'type': 'integer' } } }", "id");

            const matches: IParameterDefinition[] = dt.topLevelScope.findParameterDefinitionsWithPrefix("APP");
            assert(matches);
            assert.deepStrictEqual(matches.length, 2);

            const match0: IParameterDefinition = matches[0];
            assert(match0);
            assert.deepStrictEqual(match0.nameValue.toString(), "apples");
            assert.deepStrictEqual(match0.description, null);
            assert.deepStrictEqual(match0.fullSpan, new Language.Span(18, 30));

            const match1: IParameterDefinition = matches[1];
            assert(match1);
            assert.deepStrictEqual(match1.nameValue.toString(), "APPLES");
            assert.deepStrictEqual(match1.description, null);
            assert.deepStrictEqual(match1.fullSpan, new Language.Span(50, 31));
        });
    });

    suite("getVariableDefinition(string)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { dt.topLevelScope.getVariableDefinition(<any>null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { dt.topLevelScope.getVariableDefinition(<any>undefined); });
        });

        test("with empty", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.throws(() => { dt.topLevelScope.getVariableDefinition(""); });
        });

        test("with no variables definition", () => {
            const dt = new DeploymentTemplate("{}", "id");
            assert.deepStrictEqual(null, dt.topLevelScope.getVariableDefinition("spam"));
        });

        test("with unquoted non-match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.deepStrictEqual(null, dt.topLevelScope.getVariableDefinition("spam"));
        });

        test("with one-sided-quote non-match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.deepStrictEqual(null, dt.topLevelScope.getVariableDefinition("'spam"));
        });

        test("with quoted non-match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");
            assert.deepStrictEqual(null, dt.topLevelScope.getVariableDefinition("'spam'"));
        });

        test("with unquoted match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");

            const apples: IVariableDefinition | null = dt.topLevelScope.getVariableDefinition("apples");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");

            const value: Json.Value | null = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.span, new Language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with one-sided-quote match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");

            const apples: IVariableDefinition | null = dt.topLevelScope.getVariableDefinition("'apples");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");

            const value: Json.StringValue | null = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.span, new Language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with quoted match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");

            const apples: IVariableDefinition | null = dt.topLevelScope.getVariableDefinition("'apples'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");

            const value: Json.StringValue | null = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.span, new Language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with case insensitive match", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", "id");

            const apples: IVariableDefinition | null = dt.topLevelScope.getVariableDefinition("'APPLES");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");

            const value: Json.StringValue | null = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.span, new Language.Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with multiple case insensitive matches", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'yum', 'APPLES': 'good' } }", "id");

            // Should always find the last definition, because that's what Azure does
            const APPLES: IVariableDefinition | null = dt.topLevelScope.getVariableDefinition("'APPLES'");
            if (!APPLES) { throw new Error("failed"); }
            assert.deepStrictEqual(APPLES.nameValue.toString(), "APPLES");

            const applesValue: Json.StringValue | null = Json.asStringValue(APPLES.value);
            if (!applesValue) { throw new Error("failed"); }
            assert.deepStrictEqual(applesValue.toString(), "good");

            const apples: IVariableDefinition | null = dt.topLevelScope.getVariableDefinition("'APPles'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "APPLES");

            const value: Json.StringValue | null = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.toString(), "good");
        });
    }); // end suite getVariableDefinition

    suite("findVariableDefinitionsWithPrefix(string)", () => {
        test("with null", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { dt.topLevelScope.findVariableDefinitionsWithPrefix(<any>null); });
        });

        test("with undefined", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");
            // tslint:disable-next-line:no-any
            assert.throws(() => { dt.topLevelScope.findVariableDefinitionsWithPrefix(<any>undefined); });
        });

        test("with empty", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");

            const definitions: IVariableDefinition[] = dt.topLevelScope.findVariableDefinitionsWithPrefix("");
            assert.deepStrictEqual(definitions.length, 2);

            const apples: IVariableDefinition = definitions[0];
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            const applesValue: Json.StringValue | null = Json.asStringValue(apples.value);
            if (!applesValue) { throw new Error("failed"); }
            assert.deepStrictEqual(applesValue.span, new Language.Span(27, 8));
            assert.deepStrictEqual(applesValue.toString(), "APPLES");

            const bananas: IVariableDefinition = definitions[1];
            assert.deepStrictEqual(bananas.nameValue.toString(), "bananas");
            const bananasValue: Json.NumberValue | null = Json.asNumberValue(bananas.value);
            assert.deepStrictEqual(bananasValue!.span, new Language.Span(48, 2));
        });

        test("with prefix of one of the variables", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");

            const definitions: IVariableDefinition[] = dt.topLevelScope.findVariableDefinitionsWithPrefix("ap");
            assert.deepStrictEqual(definitions.length, 1);

            const apples: IVariableDefinition = definitions[0];
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            const applesValue: Json.StringValue | null = Json.asStringValue(apples.value);
            if (!applesValue) { throw new Error("failed"); }
            assert.deepStrictEqual(applesValue.span, new Language.Span(27, 8));
            assert.deepStrictEqual(applesValue.toString(), "APPLES");
        });

        test("with prefix of none of the variables", () => {
            const dt = new DeploymentTemplate("{ 'variables': { 'apples': 'APPLES', 'bananas': 88 } }", "id");
            assert.deepStrictEqual([], dt.topLevelScope.findVariableDefinitionsWithPrefix("ca"));
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
        test("with parameter type and no matching parameter definition", () => {
            const dt = new DeploymentTemplate(`{ "parameters": { "pName": {} } }`, "id");
            const list: ReferenceList = findReferences(dt, DefinitionKind.Parameter, "dontMatchMe", dt.topLevelScope);
            assert(list);
            assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
            assert.deepStrictEqual(list.spans, []);
        });

        test("with parameter type and matching parameter definition", () => {
            const dt = new DeploymentTemplate(`{ "parameters": { "pName": {} } }`, "id");
            const list: ReferenceList = findReferences(dt, DefinitionKind.Parameter, "pName", dt.topLevelScope);
            assert(list);
            assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
            assert.deepStrictEqual(list.spans, [new Language.Span(19, 5)]);
        });

        test("with variable type and no matching variable definition", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "vName": {} } }`, "id");
            const list: ReferenceList = findReferences(dt, DefinitionKind.Variable, "dontMatchMe", dt.topLevelScope);
            assert(list);
            assert.deepStrictEqual(list.kind, DefinitionKind.Variable);
            assert.deepStrictEqual(list.spans, []);
        });

        test("with variable type and matching variable definition", () => {
            const dt = new DeploymentTemplate(`{ "variables": { "vName": {} } }`, "id");
            const list: ReferenceList = findReferences(dt, DefinitionKind.Variable, "vName", dt.topLevelScope);
            assert(list);
            assert.deepStrictEqual(list.kind, DefinitionKind.Variable);
            assert.deepStrictEqual(list.spans, [new Language.Span(18, 5)]);
        });

    }); // findReferences

    suite("ReferenceInVariableDefinitionJSONVisitor", () => {
        suite("constructor(DeploymentTemplate)", () => {
            test("with null", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new ReferenceInVariableDefinitionsVisitor(<any>null); });
            });

            test("with undefined", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new ReferenceInVariableDefinitionsVisitor(<any>undefined); });
            });

            test("with deploymentTemplate", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                assert.deepStrictEqual(visitor.referenceSpans, []);
            });

            testWithLanguageServer("expecting error: reference in variable definition", async function (this: ITestCallbackContext): Promise<void> {
                await testDiagnostics(
                    {
                        "variables": {
                            "a": "[reference('test')]"
                        },
                    },
                    {
                        includeSources: [sources.expressions]
                    },
                    [
                        "Error: reference() cannot be invoked inside of a variable definition. (arm-template (expressions))",
                        "Warning: The variable 'a' is never used. (arm-template (expressions))"
                    ]);
            });

            testWithLanguageServer("expecting error: reference in variable definition inside user function", async function (this: ITestCallbackContext): Promise<void> {
                await testDiagnostics(
                    {
                        "variables": {
                            "a": "[reference('test')]"
                        },
                    },
                    {
                        includeSources: [sources.expressions]
                    },
                    [
                        "Error: reference() cannot be invoked inside of a variable definition. (arm-template (expressions))",
                        "Warning: The variable 'a' is never used. (arm-template (expressions))"
                    ]);
            });
        });

        suite("visitStringValue(Json.StringValue)", () => {
            test("with null", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                // tslint:disable-next-line:no-any
                assert.throws(() => { visitor.visitStringValue(<any>null); });
            });

            test("with undefined", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                // tslint:disable-next-line:no-any
                assert.throws(() => { visitor.visitStringValue(<any>undefined); });
            });

            test("with non-TLE string", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                const variables: Json.StringValue = Json.asObjectValue(dt.jsonParseResult.value)!.properties[0].nameValue;
                visitor.visitStringValue(variables);
                assert.deepStrictEqual(visitor.referenceSpans, []);
            });

            test("with TLE string with reference() call", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "a": "[reference('test')]" } }`, "id");
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                const dtObject: Json.ObjectValue | null = Json.asObjectValue(dt.jsonParseResult.value);
                const variablesObject: Json.ObjectValue | null = Json.asObjectValue(dtObject!.getPropertyValue("variables"));
                const tle: Json.StringValue | null = Json.asStringValue(variablesObject!.getPropertyValue("a"));

                visitor.visitStringValue(tle!);
                assert.deepStrictEqual(visitor.referenceSpans, [new Language.Span(24, 9)]);
            });

            test("with TLE string with reference() call inside concat() call", () => {
                const dt = new DeploymentTemplate(`{ "variables": { "a": "[concat(reference('test'))]" } }`, "id");
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                const dtObject: Json.ObjectValue | null = Json.asObjectValue(dt.jsonParseResult.value);
                const variablesObject: Json.ObjectValue | null = Json.asObjectValue(dtObject!.getPropertyValue("variables"));
                const tle: Json.StringValue | null = Json.asStringValue(variablesObject!.getPropertyValue("a"));

                visitor.visitStringValue(tle!);
                assert.deepStrictEqual(visitor.referenceSpans, [new Language.Span(31, 9)]);
            });
        });
    });

    suite("Incomplete JSON shouldn't cause crash", function (this: ISuiteCallbackContext): void {
        this.timeout(60000);

        async function exercisePositionContextAtEveryPointInTheDoc(json: string): Promise<void> {
            await exercisePositionContextAtRandomPointsInTheDoc(json, json.length + 1); // length+1 so we include past the last character as a position
        }

        async function exercisePositionContextAtRandomPointsInTheDoc(json: string, numberOfIndicesToTest: number): Promise<void> {
            if (numberOfIndicesToTest < 1) {
                // Take it as a probability of doing a single sample
                if (Math.random() > numberOfIndicesToTest) {
                    return;
                }
            }

            for (let i = 0; i < numberOfIndicesToTest; ++i) {
                let index = i;
                if (numberOfIndicesToTest <= json.length) {
                    index = Math.floor(Math.random() * (json.length + 1)); // length+1 so we include past the last character as a position
                }

                // console.log(`Testing index ${index}`);
                try {
                    // Just make sure nothing throws
                    let dt = new DeploymentTemplate(json, "id");
                    let pc = dt.getContextFromDocumentCharacterIndex(index);
                    pc.getReferences();
                    pc.getSignatureHelp();
                    pc.tleInfo;
                    pc.getReferenceSiteInfo();
                    pc.getHoverInfo();
                    pc.getCompletionItems();
                } catch (err) {
                    throw new Error(`exercisePositionContextAtRandomPointsInTheDoc: Threw at index ${i}:\n${json.slice(i)}<***HERE***>${json.slice(i)}`);
                }
            }
        }

        const template: string =
            `{
        "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            "location": { "type": "string" },
            "networkInterfaceName": {
                "type": "string"
            },
        },
        "variables": {
            "vnetId": "[resourceId(resourceGroup().name,'Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
        },
        "resources": [
            {
                "name": "[parameters('networkInterfaceName')]",
                "type": "Microsoft.Network/networkInterfaces",
                "apiVersion": "2018-10-01",
                "location": "[parameters('location')]",
                "dependsOn": [
                    "[concat('Microsoft.Network/networkSecurityGroups/', parameters('networkSecurityGroupName'))]",
                    "[concat('Microsoft.Network/virtualNetworks/', parameters('virtualNetworkName'))]",
                    "[concat('Microsoft.Network/publicIpAddresses/', parameters('publicIpAddressName'))]"
                ],
                "properties": {
                    "$test-commandToExecute": "[concat('cd /hub*/docker-compose; sudo docker-compose down -t 60; sudo -s source /set_hub_url.sh ', reference(parameters('publicIpName')).dnsSettings.fqdn, ';  sudo docker volume rm ''dockercompose_cert-volume''; sudo docker-compose up')]",
                    "ipConfigurations": [
                        {
                            "name": "ipconfig1",
                            "properties": {
                                "subnet": {
                                    "id": "[variables('subnetRef')]"
                                },
                                "privateIPAllocationMethod": "Dynamic",
                                "publicIpAddress": {
                                    "id": "[resourceId(resourceGroup().name, 'Microsoft.Network/publicIpAddresses', parameters('publicIpAddressName'))]"
                                }
                            }
                        }
                    ]
                },
                "tags": {}
            }
        ],
        "outputs": {
            "adminUsername": {
                "type": "string",
                "value": "[parameters('adminUsername')]"
            }
        }
    }
    `;

        test("https://github.com/Microsoft/vscode-azurearmtools/issues/193", async () => {
            // Just make sure nothing throws
            let modifiedTemplate = template.replace('"type": "string"', '"type": string');
            let dt = await parseTemplate(modifiedTemplate);
            findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
            findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
            dt.getFunctionCounts();
        });

        test("Unended string", async () => {
            const json = "{ \"";
            let dt = await parseTemplate(json);
            findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
            findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
            dt.getFunctionCounts();
        });

        test("No top-level object", async () => {
            const json = "\"hello\"";
            let dt = await parseTemplate(json);
            findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
            findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
            dt.getFunctionCounts();
        });

        test("Malformed property name", async () => {
            const json = `
        {
            "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            : {
                "nsgId": "something",
                "vnetId": "[resourceId(resourceGrou2p().name,'Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
                "subnetRef": "[concat(variables('vne2tId'), '/subnets/', parameters('subnetName'))]"
            }
        }`;
            let dt = await parseTemplate(json);
            findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
            findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
            dt.getFunctionCounts();
        });

        test("Malformed property", async () => {
            const json = `
        {
            "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            /*missing prop name and colon*/ {
                "nsgId": "something",
                "vnetId": "[resourceId(resourceGrou2p().name,'Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
                "subnetRef": "[concat(variables('vne2tId'), '/subnets/', parameters('subnetName'))]"
            }
        }`;
            let dt = await parseTemplate(json);
            findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
            findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
            dt.getFunctionCounts();
        });

        test("typing character by character", async function (this: ITestCallbackContext): Promise<void> {
            if (DISABLE_SLOW_TESTS) {
                this.skip();
                return;
            }

            // Just make sure nothing throws
            for (let i = 0; i < template.length; ++i) {
                let partialTemplate = template.slice(0, i);
                let dt = await parseTemplate(partialTemplate);
                findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
                findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
                dt.getFunctionCounts();

                await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
            }
        });

        test("typing backwards character by character", async function (this: ITestCallbackContext): Promise<void> {
            if (DISABLE_SLOW_TESTS) {
                this.skip();
                return;
            }

            // Just make sure nothing throws
            for (let i = 0; i < template.length; ++i) {
                let partialTemplate = template.slice(i);
                let dt = await parseTemplate(partialTemplate);
                findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
                findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
                dt.getFunctionCounts();

                await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
            }
        });

        test("try parsing the document with a single character deleted (repeat through the whole document)", async function (this: ITestCallbackContext): Promise<void> {
            if (DISABLE_SLOW_TESTS) {
                this.skip();
                return;
            }

            // Just make sure nothing throws
            for (let i = 0; i < template.length; ++i) {
                // Remove the single character at position i
                let partialTemplate = template.slice(0, i) + template.slice(i + 1);
                let dt = await parseTemplate(partialTemplate);
                findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
                findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
                dt.getFunctionCounts();

                await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
            }
        });

        test("exercise PositionContext at every point in the full json", async function (this: ITestCallbackContext): Promise<void> {
            if (DISABLE_SLOW_TESTS) {
                this.skip();
                return;
            }

            // Just make sure nothing throws
            await exercisePositionContextAtEveryPointInTheDoc(template);
        });

        test("Random modifications", async function (this: ITestCallbackContext): Promise<void> {
            if (DISABLE_SLOW_TESTS) {
                this.skip();
                return;
            }

            // Just make sure nothing throws
            let modifiedTemplate: string = template;

            for (let i = 0; i < 1000; ++i) {
                if (modifiedTemplate.length > 0 && Math.random() < 0.5) {
                    // Delete some characters
                    let position = Math.random() * (modifiedTemplate.length - 1);
                    let length = Math.random() * Math.max(5, modifiedTemplate.length);
                    modifiedTemplate = modifiedTemplate.slice(position, position + length);
                } else {
                    // Insert some characters
                    let position = Math.random() * modifiedTemplate.length;
                    let length = Math.random() * 5;
                    let s = randomBytes(length).toString();
                    modifiedTemplate = modifiedTemplate.slice(0, position) + s + modifiedTemplate.slice(position);
                }

                let dt = await parseTemplate(modifiedTemplate);
                findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
                findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
                dt.getFunctionCounts();

                await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
            }
        });
    }); //Incomplete JSON shouldn't cause crash
});
