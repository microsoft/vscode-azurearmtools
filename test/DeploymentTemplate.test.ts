// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length insecure-random
// tslint:disable:object-literal-key-quotes no-function-expression no-non-null-assertion align no-http-string

import * as assert from "assert";
import { randomBytes } from "crypto";
import { ISuiteCallbackContext, ITestCallbackContext } from "mocha";
import { Uri } from "vscode";
import { parseError } from "vscode-azureextensionui";
import { DefinitionKind, DeploymentTemplateDoc, getVSCodeRangeFromSpan, Histogram, INamedDefinition, IncorrectArgumentsCountIssue, IParameterDefinition, Issue, IssueKind, IVariableDefinition, Json, LineColPos, ReferenceInVariableDefinitionsVisitor, ReferenceList, Span, TemplateScope, UnrecognizedUserFunctionIssue, UnrecognizedUserNamespaceIssue } from "../extension.bundle";
import { diagnosticSources, IDeploymentTemplate, testDiagnostics } from "./support/diagnostics";
import { parseTemplate } from "./support/parseTemplate";
import { stringify } from "./support/stringify";
import { writeToLog } from "./support/testLog";
import { testWithLanguageServer } from "./support/testWithLanguageServer";
import { DISABLE_SLOW_TESTS } from "./testConstants";

const fakeId = Uri.file("https://fake-id");

suite("DeploymentTemplate", () => {

    function findReferences(dt: DeploymentTemplateDoc, definitionKind: DefinitionKind, definitionName: string, scope: TemplateScope): ReferenceList {
        // tslint:disable-next-line: no-unnecessary-initializer
        let definition: INamedDefinition | undefined;

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
            default:
                assert.fail("Test scenario NYI");
        }

        if (!definition) {
            return new ReferenceList(definitionKind, []);
        }

        return dt.findReferencesToDefinition(definition!);
    }

    suite("constructor(string)", () => {
        test("Null stringValue", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { new DeploymentTemplateDoc(<any>undefined, fakeId, 0); });
        });

        test("Undefined stringValue", () => {
            // tslint:disable-next-line:no-any
            assert.throws(() => { new DeploymentTemplateDoc(<any>undefined, fakeId, 0); });
        });

        test("Empty stringValue", () => {
            const dt = new DeploymentTemplateDoc("", fakeId, 0);
            assert.deepStrictEqual("", dt.documentText);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            assert.deepStrictEqual([], dt.topLevelScope.parameterDefinitions);
        });

        test("Non-JSON stringValue", () => {
            const dt = new DeploymentTemplateDoc("I'm not a JSON file", fakeId, 0);
            assert.deepStrictEqual("I'm not a JSON file", dt.documentText);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            assert.deepStrictEqual([], dt.topLevelScope.parameterDefinitions);
        });

        test("JSON stringValue with number parameters definition", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': 21 }", fakeId, 0);
            assert.deepStrictEqual("{ 'parameters': 21 }", dt.documentText);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            assert.deepStrictEqual([], dt.topLevelScope.parameterDefinitions);
        });

        test("JSON stringValue with empty object parameters definition", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': {} }", fakeId, 0);
            assert.deepStrictEqual("{ 'parameters': {} }", dt.documentText);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            assert.deepStrictEqual([], dt.topLevelScope.parameterDefinitions);
        });

        test("JSON stringValue with one parameter definition", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'num': { 'type': 'number' } } }", fakeId, 0);
            assert.deepStrictEqual("{ 'parameters': { 'num': { 'type': 'number' } } }", dt.documentText);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.description, undefined);
            assert.deepStrictEqual(pd0.fullSpan, new Span(18, 27));
        });

        test("JSON stringValue with one parameter definition with undefined description", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': null } } } }", fakeId, 0);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.description, undefined);
            assert.deepStrictEqual(pd0.fullSpan, new Span(18, 64));
        });

        test("JSON stringValue with one parameter definition with empty description", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': '' } } } }", fakeId, 0);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.description, "");
            assert.deepStrictEqual(pd0.fullSpan, new Span(18, 62));
        });

        test("JSON stringValue with one parameter definition with non-empty description", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'num': { 'type': 'number', 'metadata': { 'description': 'num description' } } } }", fakeId, 0);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.description, "num description");
            assert.deepStrictEqual(pd0.fullSpan, new Span(18, 77));
        });

        test("JSON stringValue with number variable definitions", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': 12 }", fakeId, 0);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            assert.deepStrictEqual("{ 'variables': 12 }", dt.documentText);
            assert.deepStrictEqual([], dt.topLevelScope.variableDefinitions);
        });

        test("JSON stringValue with one variable definition", () => {
            const dt: DeploymentTemplateDoc = new DeploymentTemplateDoc("{ 'variables': { 'a': 'A' } }", fakeId, 0);
            assert.deepStrictEqual(dt.documentUri, fakeId);
            assert.deepStrictEqual(dt.documentText, "{ 'variables': { 'a': 'A' } }");
            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions.length, 1);
            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions[0].nameValue.toString(), "a");

            const variableDefinition: Json.StringValue | undefined = Json.asStringValue(dt.topLevelScope.variableDefinitions[0].value);
            if (!variableDefinition) { throw new Error("failed"); }
            assert.deepStrictEqual(variableDefinition.span, new Span(22, 3));
            assert.deepStrictEqual(variableDefinition.toString(), "A");
        });

        test("JSON stringValue with two variable definitions", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'a': 'A', 'b': 2 } }", fakeId, 0);
            assert.deepStrictEqual(fakeId.fsPath, dt.documentUri.fsPath);
            assert.deepStrictEqual("{ 'variables': { 'a': 'A', 'b': 2 } }", dt.documentText);
            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions.length, 2);

            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions[0].nameValue.toString(), "a");
            const a: Json.StringValue | undefined = Json.asStringValue(dt.topLevelScope.variableDefinitions[0].value);
            if (!a) { throw new Error("failed"); }
            assert.deepStrictEqual(a.span, new Span(22, 3));
            assert.deepStrictEqual(a.toString(), "A");

            assert.deepStrictEqual(dt.topLevelScope.variableDefinitions[1].nameValue.toString(), "b");
            const b: Json.NumberValue | undefined = Json.asNumberValue(dt.topLevelScope.variableDefinitions[1].value);
            if (!b) { throw new Error("failed"); }
            assert.deepStrictEqual(b.span, new Span(32, 1));
        });
    });

    suite("errors", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplateDoc("", fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, []);
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplateDoc("{}", fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, []);
        });

        test("with one property deployment template", () => {
            const dt = new DeploymentTemplateDoc("{ 'name': 'value' }", fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, []);
        });

        test("with one TLE parse error deployment template", () => {
            const dt = new DeploymentTemplateDoc("{ 'name': '[concat()' }", fakeId, 0);
            const expectedErrors = [
                new Issue(new Span(20, 1), "Expected a right square bracket (']').", IssueKind.tleSyntax)
            ];
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("with one undefined parameter error deployment template", () => {
            const dt = new DeploymentTemplateDoc("{ 'name': '[parameters(\"test\")]' }", fakeId, 0);
            const expectedErrors = [
                new Issue(new Span(23, 6), "Undefined parameter reference: \"test\"", IssueKind.undefinedParam)
            ];
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("with one undefined variable error deployment template", () => {
            const dt = new DeploymentTemplateDoc("{ 'name': '[variables(\"test\")]' }", fakeId, 0);
            const expectedErrors = [
                new Issue(new Span(22, 6), "Undefined variable reference: \"test\"", IssueKind.undefinedVar)
            ];
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("with one unrecognized user namespace error deployment template", () => {
            const dt = new DeploymentTemplateDoc("{ \"name\": \"[namespace.blah('test')]\" }", fakeId, 0);
            const expectedErrors = [
                new UnrecognizedUserNamespaceIssue(new Span(12, 9), "namespace")
            ];
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("with one unrecognized user function error deployment template", () => {
            const dt = new DeploymentTemplateDoc(
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
                fakeId, 0);
            const expectedErrors = [
                new UnrecognizedUserFunctionIssue(new Span(22, 4), "contoso", "blah")
            ];
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("with one user function referenced in deployment template", () => {
            const dt = new DeploymentTemplateDoc(
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
                fakeId, 0);
            const expectedErrors: string[] = [
            ];
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("with one user function where function name matches a built-in function name", async () => {
            parseTemplate(
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
            const dt = new DeploymentTemplateDoc(
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
                fakeId, 0);
            const expectedErrors = [
                new UnrecognizedUserFunctionIssue(new Span(22, 9), "contoso", "reference")
            ];
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("can't reference variables from within user function", async () => {
            const dt = new DeploymentTemplateDoc(
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
                fakeId, 0);
            const expectedErrors = [
                new Issue(new Span(243, 6), "User functions cannot reference variables", IssueKind.varInUdf)
            ];
            const errors: Issue[] = dt.getErrors(undefined);
            assert.deepStrictEqual(errors, expectedErrors);
        });

        test("with reference() call in variable definition", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "[reference('test')]" } }`, fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(
                errors,
                [new Issue(new Span(24, 9), "reference() cannot be invoked inside of a variable definition.", IssueKind.referenceInVar)]
            );
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

            parseTemplate(template, []);
        });

        test("with reference() call inside a different expression in a variable definition", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "[concat(reference('test'))]" } }`, fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(
                errors,
                [new Issue(new Span(31, 9), "reference() cannot be invoked inside of a variable definition.", IssueKind.referenceInVar)]);
        });

        test("with unnamed property access on variable reference", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": {} }, "z": "[variables('a').]" }`, fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(
                errors,
                [new Issue(new Span(50, 1), "Expected a literal value.", IssueKind.tleSyntax)]);
        });

        test("with property access on variable reference without variable name", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": {} }, "z": "[variables().b]" }`, fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(
                errors,
                [new IncorrectArgumentsCountIssue(new Span(35, 11), "The function 'variables' takes 1 argument.", "variables", 0, 1, 1)]);
        });

        test("with property access on string variable reference", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "A" }, "z": "[variables('a').b]" }`, fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(
                errors,
                [new Issue(new Span(51, 1), `Property "b" is not a defined property of "variables('a')".`, IssueKind.undefinedVarProp)]);
        });

        test("with undefined variable reference child property", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": {} }, "z": "[variables('a').b]" }`, fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(
                errors,
                [new Issue(new Span(50, 1), `Property "b" is not a defined property of "variables('a')".`, IssueKind.undefinedVarProp)]);
        });

        test("with undefined variable reference grandchild property", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": { "b": {} } }, "z": "[variables('a').b.c]" }`, fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(
                errors,
                [new Issue(new Span(61, 1), `Property "c" is not a defined property of "variables('a').b".`, IssueKind.undefinedVarProp)]);
        });

        test("with undefined variable reference child and grandchild properties", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": { "d": {} } }, "z": "[variables('a').b.c]" }`, fakeId, 0);
            const errors = dt.getErrors(undefined);
            assert.deepStrictEqual(
                errors,
                [new Issue(new Span(59, 1), `Property "b" is not a defined property of "variables('a')".`, IssueKind.undefinedVarProp)]);
        });
    });

    suite("warnings", () => {
        test("with unused parameter", () => {
            const dt = new DeploymentTemplateDoc(`{ "parameters": { "a": {} } }`, fakeId, 0);
            assert.deepStrictEqual(
                dt.getWarnings(),
                [new Issue(new Span(18, 3), "The parameter 'a' is never used.", IssueKind.unusedParam)]);
        });

        test("with no unused parameters", async () => {
            const dt = new DeploymentTemplateDoc(`{ "parameters": { "a": {} }, "b": "[parameters('a')] }`, fakeId, 0);
            assert.deepStrictEqual(dt.getWarnings(), []);
            assert.deepStrictEqual(dt.getWarnings(), []);
        });

        test("with unused variable", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "A" } }`, fakeId, 0);
            assert.deepStrictEqual(
                dt.getWarnings(),
                [new Issue(new Span(17, 3), "The variable 'a' is never used.", IssueKind.unusedVar)]);
        });

        test("with no unused variables", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "A" }, "b": "[variables('a')] }`, fakeId, 0);
            assert.deepStrictEqual(dt.getWarnings(), []);
            assert.deepStrictEqual(dt.getWarnings(), []);
        });
    });

    suite("get functionCounts()", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplateDoc("", fakeId, 0);
            const expectedHistogram = new Histogram();
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplateDoc("{}", fakeId, 0);
            const expectedHistogram = new Histogram();
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with one property object deployment template", () => {
            const dt = new DeploymentTemplateDoc("{ 'name': 'value' }", fakeId, 0);
            const expectedHistogram = new Histogram();
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with one TLE function used multiple times in deployment template", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'name': '[concat()]', 'name2': '[concat(1, 2)]', 'name3': '[concat(2, 3)]' } }", fakeId, 0);
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
            const dt = new DeploymentTemplateDoc(`{ "name": "[concat()]", "height": "[add()]" }`, fakeId, 0);
            const expectedHistogram = new Histogram();
            expectedHistogram.add("concat");
            expectedHistogram.add("concat(0)");
            expectedHistogram.add("add");
            expectedHistogram.add("add(0)");
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
            assert.deepStrictEqual(expectedHistogram, dt.getFunctionCounts());
        });

        test("with the same string repeated in multiple places (each use should get counted once, even though the strings are the exact same and may be cached)", () => {
            const dt = new DeploymentTemplateDoc("{ 'name': '[concat()]', 'height': '[concat()]', 'width': \"[concat()]\" }", fakeId, 0);
            assert.deepStrictEqual(3, dt.getFunctionCounts().getCount("concat(0)"));
            assert.deepStrictEqual(3, dt.getFunctionCounts().getCount("concat"));
        });
    });

    suite("get jsonParseResult()", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplateDoc("", fakeId, 0);
            assert(dt.jsonParseResult);
            assert.equal(0, dt.jsonParseResult.tokenCount);
        });

        test("with empty object deployment template", () => {
            const dt = new DeploymentTemplateDoc("{}", fakeId, 0);
            assert(dt.jsonParseResult);
            assert.equal(2, dt.jsonParseResult.tokenCount);
        });

        test("With comments", () => {
            const dt = new DeploymentTemplateDoc(
                `// Look, Ma
                    {
                        // No hands!
                        /* This is not the right schema
                        "$schema": "http://schema.ohwell.azure.com/schemas/2015-01-01/wrongTemplate.json#",
                        */
                        "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                        "contentVersion": "1.0.0.0",
                        "parameters": {
                            "storageAccountName": {
                                "type": "string"
                            }
                        }
                    }`,
                fakeId,
                0
            );

            assert.equal(dt.schemaUri, "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#");
            assert.notEqual(dt.topLevelScope.getParameterDefinition("storageAccountName"), null);
        });
    });

    suite("get parameterDefinitions()", () => {
        test("with no parameters property", () => {
            const dt = new DeploymentTemplateDoc("{}", fakeId, 0);
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with undefined parameters property", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': undefined }", fakeId, 0);
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with string parameters property", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': 'hello' }", fakeId, 0);
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with number parameters property", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': 1 }", fakeId, 0);
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with empty object parameters property", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': {} }", fakeId, 0);
            assert.deepStrictEqual(dt.topLevelScope.parameterDefinitions, []);
        });

        test("with empty object parameter", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'a': {} } }", fakeId, 0);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "a");
            assert.deepStrictEqual(pd0.description, undefined);
            assert.deepStrictEqual(pd0.fullSpan, new Span(18, 7));
        });

        test("with parameter with metadata but no description", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'a': { 'metadata': {} } } }", fakeId, 0);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "a");
            assert.deepStrictEqual(pd0.description, undefined);
            assert.deepStrictEqual(pd0.fullSpan, new Span(18, 23));
        });

        test("with parameter with metadata and description", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'a': { 'metadata': { 'description': 'b' } } } }", fakeId, 0);
            const parameterDefinitions: IParameterDefinition[] = dt.topLevelScope.parameterDefinitions;
            assert(parameterDefinitions);
            assert.deepStrictEqual(parameterDefinitions.length, 1);
            const pd0: IParameterDefinition = parameterDefinitions[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "a");
            assert.deepStrictEqual(pd0.description, "b");
            assert.deepStrictEqual(pd0.fullSpan, new Span(18, 43));
        });
    });

    suite("getParameterDefinition(string)", () => {
        test("with empty", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getParameterDefinition("''"));
        });

        test("with empty string literal", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getParameterDefinition("''"));
        });

        test("with no parameters definition", () => {
            const dt = new DeploymentTemplateDoc("{}", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getParameterDefinition("spam"));
        });

        test("with unquoted non-match", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getParameterDefinition("spam"));
        });

        test("with one-sided-quote non-match", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getParameterDefinition("'spam"));
        });

        test("with quoted non-match", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getParameterDefinition("'spam'"));
        });

        test("with unquoted match", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            const apples: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("apples");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            assert.deepStrictEqual(apples.description, undefined);
            assert.deepStrictEqual(apples.fullSpan, new Span(18, 30));
            assert.deepStrictEqual(apples.nameValue.span, new Span(18, 8), "Wrong name.span");
            assert.deepStrictEqual(apples.nameValue.unquotedSpan, new Span(19, 6), "Wrong name.unquotedSpan");
        });

        test("with one-sided-quote match", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            const apples: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("'apples");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            assert.deepStrictEqual(apples.description, undefined);
            assert.deepStrictEqual(apples.fullSpan, new Span(18, 30));
        });

        test("with quoted match", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            const apples: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("'apples'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            assert.deepStrictEqual(apples.description, undefined);
            assert.deepStrictEqual(apples.fullSpan, new Span(18, 30));
        });

        test("with case insensitive match", () => {
            const dt = new DeploymentTemplateDoc("{ 'parameters': { 'apples': { 'type': 'string' }, 'bananas': { 'type': 'integer' } } }", fakeId, 0);
            const apples: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("'APPLES'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");
            assert.deepStrictEqual(apples.description, undefined);
            assert.deepStrictEqual(apples.fullSpan, new Span(18, 30));
        });

        test("with multiple case insensitive matches", () => {
            const dt = new DeploymentTemplateDoc(
                stringify(
                    {
                        'parameters': {
                            'apples': { 'type': 'string' },
                            'APPLES': { 'type': 'integer' },
                            'Apples': { 'type': 'securestring' }
                        }
                    }),
                fakeId, 0);

            // Should always match the last one defined when multiple have the same name
            const APPLES: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("'APPLES'");
            if (!APPLES) { throw new Error("failed"); }
            assert.deepStrictEqual(APPLES.nameValue.toString(), "Apples");

            const apples: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("'APPles'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "Apples");
        });

        // CONSIDER: Does JavaScript support this?  It's low priority
        // test("with case insensitive match, Unicode", () => {
        //     // Should always match the last one defined when multiple have the same name
        //     const dt = new DeploymentTemplate("{ 'parameters': { 'Strasse': { 'type': 'string' }, 'Straße': { 'type': 'integer' } } }",fakeId, 0);
        //     const strasse: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("'Strasse'");
        //     if (!strasse) { throw new Error("failed"); }
        //     assert.deepStrictEqual(strasse.nameValue.toString(), "Straße");

        //     const straße: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("'Straße'");
        //     if (!straße) { throw new Error("failed"); }
        //     assert.deepStrictEqual(straße.nameValue.toString(), "Straße");

        //     const straße2: IParameterDefinition | undefined = dt.topLevelScope.getParameterDefinition("'STRASSE'");
        //     if (!straße2) { throw new Error("failed"); }
        //     assert.deepStrictEqual(straße2.nameValue.toString(), "Straße");
        // });
    });

    suite("getVariableDefinition(string)", () => {
        test("with empty", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getVariableDefinition(""));
        });

        test("with empty string literal", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getVariableDefinition("''"));
        });

        test("with no variables definition", () => {
            const dt = new DeploymentTemplateDoc("{}", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getVariableDefinition("spam"));
        });

        test("with unquoted non-match", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getVariableDefinition("spam"));
        });

        test("with one-sided-quote non-match", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getVariableDefinition("'spam"));
        });

        test("with quoted non-match", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);
            assert.deepStrictEqual(undefined, dt.topLevelScope.getVariableDefinition("'spam'"));
        });

        test("with unquoted match", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);

            const apples: IVariableDefinition | undefined = dt.topLevelScope.getVariableDefinition("apples");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");

            const value: Json.Value | undefined = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.span, new Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with one-sided-quote match", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);

            const apples: IVariableDefinition | undefined = dt.topLevelScope.getVariableDefinition("'apples");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");

            const value: Json.StringValue | undefined = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.span, new Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with quoted match", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);

            const apples: IVariableDefinition | undefined = dt.topLevelScope.getVariableDefinition("'apples'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");

            const value: Json.StringValue | undefined = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.span, new Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with case insensitive match", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'bananas': 'good' } }", fakeId, 0);

            const apples: IVariableDefinition | undefined = dt.topLevelScope.getVariableDefinition("'APPLES");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "apples");

            const value: Json.StringValue | undefined = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.span, new Span(27, 5));
            assert.deepStrictEqual(value.toString(), "yum");
        });

        test("with multiple case insensitive matches", () => {
            const dt = new DeploymentTemplateDoc("{ 'variables': { 'apples': 'yum', 'APPLES': 'good' } }", fakeId, 0);

            // Should always find the last definition, because that's what Azure does
            const APPLES: IVariableDefinition | undefined = dt.topLevelScope.getVariableDefinition("'APPLES'");
            if (!APPLES) { throw new Error("failed"); }
            assert.deepStrictEqual(APPLES.nameValue.toString(), "APPLES");

            const applesValue: Json.StringValue | undefined = Json.asStringValue(APPLES.value);
            if (!applesValue) { throw new Error("failed"); }
            assert.deepStrictEqual(applesValue.toString(), "good");

            const apples: IVariableDefinition | undefined = dt.topLevelScope.getVariableDefinition("'APPles'");
            if (!apples) { throw new Error("failed"); }
            assert.deepStrictEqual(apples.nameValue.toString(), "APPLES");

            const value: Json.StringValue | undefined = Json.asStringValue(apples.value);
            if (!value) { throw new Error("failed"); }
            assert.deepStrictEqual(value.toString(), "good");
        });
    }); // end suite getVariableDefinition

    suite("getContextFromDocumentLineAndColumnIndexes(number, number)", () => {
        test("with empty deployment template", () => {
            const dt = new DeploymentTemplateDoc("", fakeId, 0);
            const context = dt.getContextFromDocumentLineAndColumnIndexes(0, 0, undefined);
            assert(context);
            assert.equal(0, context.documentLineIndex);
            assert.equal(0, context.documentColumnIndex);
            assert.equal(0, context.documentCharacterIndex);
        });
    });

    suite("findReferences(Reference.Type, string)", () => {
        test("with parameter type and no matching parameter definition", () => {
            const dt = new DeploymentTemplateDoc(`{ "parameters": { "pName": {} } }`, fakeId, 0);
            const list: ReferenceList = findReferences(dt, DefinitionKind.Parameter, "dontMatchMe", dt.topLevelScope);
            assert(list);
            assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
            assert.deepStrictEqual(list.references, []);
        });

        test("with parameter type and matching parameter definition", () => {
            const dt = new DeploymentTemplateDoc(`{ "parameters": { "pName": {} } }`, fakeId, 0);
            const list: ReferenceList = findReferences(dt, DefinitionKind.Parameter, "pName", dt.topLevelScope);
            assert(list);
            assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
            assert.deepStrictEqual(list.references.map(r => r.span), [new Span(19, 5)]);
        });

        test("with variable type and no matching variable definition", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "vName": {} } }`, fakeId, 0);
            const list: ReferenceList = findReferences(dt, DefinitionKind.Variable, "dontMatchMe", dt.topLevelScope);
            assert(list);
            assert.deepStrictEqual(list.kind, DefinitionKind.Variable);
            assert.deepStrictEqual(list.references.map(r => r.span), []);
        });

        test("with variable type and matching variable definition", () => {
            const dt = new DeploymentTemplateDoc(`{ "variables": { "vName": {} } }`, fakeId, 0);
            const list: ReferenceList = findReferences(dt, DefinitionKind.Variable, "vName", dt.topLevelScope);
            assert(list);
            assert.deepStrictEqual(list.kind, DefinitionKind.Variable);
            assert.deepStrictEqual(list.references.map(r => r.span), [new Span(18, 5)]);
        });

    }); // findReferences

    suite("ReferenceInVariableDefinitionJSONVisitor", () => {
        suite("constructor(DeploymentTemplate)", () => {
            test("with undefined", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new ReferenceInVariableDefinitionsVisitor(<any>undefined); });
            });

            test("with deploymentTemplate", () => {
                const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "[reference('test')]" } }`, fakeId, 0);
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
                        includeSources: [diagnosticSources.expressions]
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
                        includeSources: [diagnosticSources.expressions]
                    },
                    [
                        "Error: reference() cannot be invoked inside of a variable definition. (arm-template (expressions))",
                        "Warning: The variable 'a' is never used. (arm-template (expressions))"
                    ]);
            });
        });

        suite("visitStringValue(Json.StringValue)", () => {
            test("with undefined", () => {
                const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "[reference('test')]" } }`, fakeId, 0);
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                // tslint:disable-next-line:no-any
                assert.throws(() => { visitor.visitStringValue(<any>undefined); });
            });

            test("with undefined", () => {
                const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "[reference('test')]" } }`, fakeId, 0);
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                // tslint:disable-next-line:no-any
                assert.throws(() => { visitor.visitStringValue(<any>undefined); });
            });

            test("with non-TLE string", () => {
                const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "[reference('test')]" } }`, fakeId, 0);
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                const variables: Json.StringValue = Json.asObjectValue(dt.jsonParseResult.value)!.properties[0].nameValue;
                visitor.visitStringValue(variables);
                assert.deepStrictEqual(visitor.referenceSpans, []);
            });

            test("with TLE string with reference() call", () => {
                const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "[reference('test')]" } }`, fakeId, 0);
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                const dtObject: Json.ObjectValue | undefined = Json.asObjectValue(dt.jsonParseResult.value);
                const variablesObject: Json.ObjectValue | undefined = Json.asObjectValue(dtObject!.getPropertyValue("variables"));
                const tle: Json.StringValue | undefined = Json.asStringValue(variablesObject!.getPropertyValue("a"));

                visitor.visitStringValue(tle!);
                assert.deepStrictEqual(visitor.referenceSpans, [new Span(24, 9)]);
            });

            test("with TLE string with reference() call inside concat() call", () => {
                const dt = new DeploymentTemplateDoc(`{ "variables": { "a": "[concat(reference('test'))]" } }`, fakeId, 0);
                const visitor = new ReferenceInVariableDefinitionsVisitor(dt);
                const dtObject: Json.ObjectValue | undefined = Json.asObjectValue(dt.jsonParseResult.value);
                const variablesObject: Json.ObjectValue | undefined = Json.asObjectValue(dtObject!.getPropertyValue("variables"));
                const tle: Json.StringValue | undefined = Json.asStringValue(variablesObject!.getPropertyValue("a"));

                visitor.visitStringValue(tle!);
                assert.deepStrictEqual(visitor.referenceSpans, [new Span(31, 9)]);
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

                writeToLog(`Testing index ${index}`);
                try {
                    // Just make sure nothing throws
                    let dt = new DeploymentTemplateDoc(json, fakeId, 0);
                    let pc = dt.getContextFromDocumentCharacterIndex(index, undefined);
                    pc.getReferences();
                    pc.getSignatureHelp();
                    pc.tleInfo;
                    pc.getReferenceSiteInfo(true);
                    pc.getHoverInfo();
                    pc.getEnclosingParent();
                    pc.getFunctionCallArgumentIndex(undefined);
                    pc.getInsertionContext({});
                    pc.getInsertionParent();
                    pc.getScope();
                    dt.getCodeActions(undefined, getVSCodeRangeFromSpan(dt, new Span(index, 0)), { diagnostics: [] });
                    /*const items =*/ await pc.getCompletionItems(undefined, 4);
                    // tslint:disable-next-line: no-suspicious-comment
                    /* TODO: https://github.com/microsoft/vscode-azurearmtools/issues/1030
                    items.items.map(i => toVsCodeCompletionItem(dt, i, getVSCodePositionFromPosition(pc.documentPosition)));
                    */                } catch (err) {
                    throw new Error(`exercisePositionContextAtRandomPointsInTheDoc: Threw at index ${i}:\n${json.slice(i)}<***HERE***>${json.slice(i)}

${err}`);
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
            let dt = parseTemplate(modifiedTemplate);
            findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
            findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
            dt.getFunctionCounts();
        });

        test("Unended string", async () => {
            const json = "{ \"";
            let dt = parseTemplate(json);
            findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
            findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
            dt.getFunctionCounts();
        });

        test("No top-level object", async () => {
            const json = "\"hello\"";
            let dt = parseTemplate(json);
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
            let dt = parseTemplate(json);
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
            let dt = parseTemplate(json);
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
                let dt = parseTemplate(partialTemplate);
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
                let dt = parseTemplate(partialTemplate);
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
                let dt = parseTemplate(partialTemplate);
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

            for (let i = 0; i < 5000; ++i) {
                const previousTemplate = modifiedTemplate;
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

                let dt: DeploymentTemplateDoc;
                try {
                    dt = parseTemplate(modifiedTemplate);
                } catch (err) {
                    if (parseError(err).message.includes('Malformed marker')) {
                        // We messed up the markers in the template (testcase issue).  Revert this modification and try again
                        // next loop
                        modifiedTemplate = previousTemplate;
                        dt = parseTemplate(modifiedTemplate);
                    } else {
                        // Valid failure
                        throw err;
                    }
                }

                findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
                findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
                dt.getFunctionCounts();

                await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
            }
        });
    }); //Incomplete JSON shouldn't cause crash

    suite("getMultilineStringCount", () => {
        test("TLE strings", async () => {
            const dt = parseTemplate(`{
                "abc": "[abc
                def]",
                "xyz": "[xyz
                    qrs]"
            }`);
            assert.equal(dt.getMultilineStringCount(), 2);
        });

        test("JSON strings", async () => {
            const dt = parseTemplate(`{
                "abc": "abc
                def"
            }`);
            assert.equal(dt.getMultilineStringCount(), 1);
        });

        test("don't count escaped \\n, \\r", async () => {
            const dt = parseTemplate(`{
                "abc": "abc\\r\\ndef"
            }`);
            assert.equal(dt.getMultilineStringCount(), 0);
        });

    });

    suite("getMaxLineLength", () => {
        test("getMaxLineLength", async () => {
            const dt = parseTemplate(`{
//345678
//345678901234567890
//345
}`);

            const maxLineLength = dt.getMaxLineLength();

            // Max line length isn't quite exact - it can also includes line break characters
            assert(maxLineLength >= 20 && maxLineLength <= 20 + 2);
        });
    });

    suite("getCommentsCount()", () => {
        test("no comments", async () => {
            // tslint:disable-next-line:no-any
            const dt = parseTemplate(<any>{
                "$schema": "foo",
                "contentVersion": "1.2.3 /*not a comment*/",
                "whoever": "1.2.3 //not a comment"
            });

            assert.equal(dt.getCommentCount(), 0);
        });

        test("block comments", async () => {
            // tslint:disable-next-line:no-any
            const dt = parseTemplate(`{
                "$schema": "foo",
                /* This is
                    a comment */
                "contentVersion": "1.2.3",
                "whoever": "1.2.3" /* This is a comment */
            }`);

            assert.equal(dt.getCommentCount(), 2);
        });

        test("single-line comments", async () => {
            // tslint:disable-next-line:no-any
            const dt = parseTemplate(`{
                "$schema": "foo", // This is a comment
                "contentVersion": "1.2.3", // Another comment
                "whoever": "1.2.3" // This is a comment
            }`);

            assert.equal(dt.getCommentCount(), 3);
        });
    });

    suite("apiProfile", () => {
        test("no apiProfile", async () => {
            const dt = parseTemplate({
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"
            });
            assert.equal(dt.apiProfile, undefined);
        });

        test("empty apiProfile", async () => {
            const dt = parseTemplate({
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                apiProfile: ""
            });

            assert.equal(dt.apiProfile, "");
        });

        test("non-string apiProfile", async () => {
            // tslint:disable-next-line: no-any
            const dt = parseTemplate(<IDeploymentTemplate><any>{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                apiProfile: false
            });

            assert.equal(dt.apiProfile, undefined);
        });

        test("valid apiProfile", async () => {
            const dt = parseTemplate({
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "apiProfile": "2018–03-01-hybrid"
            });

            assert.equal(dt.apiProfile, "2018–03-01-hybrid");
        });
    });

    suite("getDocumentPosition", () => {
        function createGetDocumentPositionTest(json: string, index: number, expectedPosition: LineColPos): void {
            test(`${JSON.stringify(json)}, index=${index}`, async () => {
                const dt = parseTemplate(json);
                const pos: LineColPos = dt.getDocumentPosition(index);
                assert.deepEqual(pos, expectedPosition);
            });
        }

        suite('empty', () => {
            createGetDocumentPositionTest('', 0, new LineColPos(0, 0));
        });

        suite('two lines', async () => {
            createGetDocumentPositionTest('a\n', 0, new LineColPos(0, 0));
            createGetDocumentPositionTest('a\n', 1, new LineColPos(0, 1));
            createGetDocumentPositionTest('a\n', 2, new LineColPos(1, 0));
            createGetDocumentPositionTest('a\n', 3, new LineColPos(1, 0));

            createGetDocumentPositionTest('a\r\n', 0, new LineColPos(0, 0));
            createGetDocumentPositionTest('a\r\n', 1, new LineColPos(0, 1));
            createGetDocumentPositionTest('a\r\n', 2, new LineColPos(0, 2));
            createGetDocumentPositionTest('a\r\n', 3, new LineColPos(1, 0));
            createGetDocumentPositionTest('a\r\n', 4, new LineColPos(1, 0));
        });

        suite('last line', async () => {
            createGetDocumentPositionTest('a\nbc', 0, new LineColPos(0, 0));
            createGetDocumentPositionTest('a\nbc', 1, new LineColPos(0, 1));
            createGetDocumentPositionTest('a\nbc', 2, new LineColPos(1, 0));
            createGetDocumentPositionTest('a\nbc', 3, new LineColPos(1, 1));
            createGetDocumentPositionTest('a\nbc', 4, new LineColPos(1, 2));
            createGetDocumentPositionTest('a\nbc', 5, new LineColPos(1, 2));

            createGetDocumentPositionTest('a\r\nbc', 0, new LineColPos(0, 0));
            createGetDocumentPositionTest('a\r\nbc', 1, new LineColPos(0, 1));
            createGetDocumentPositionTest('a\r\nbc', 2, new LineColPos(0, 2));
            createGetDocumentPositionTest('a\r\nbc', 3, new LineColPos(1, 0));
            createGetDocumentPositionTest('a\r\nbc', 4, new LineColPos(1, 1));
            createGetDocumentPositionTest('a\r\nbc', 5, new LineColPos(1, 2));
            createGetDocumentPositionTest('a\r\nbc', 5, new LineColPos(1, 2));
        });
    });
});
