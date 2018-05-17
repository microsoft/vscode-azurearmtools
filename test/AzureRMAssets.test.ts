// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length

import * as assert from "assert";

import { networkTest } from "./networkTest";

import { AzureRMAssets, FunctionMetadata, FunctionsMetadata, VersionRedirect } from "../src/AzureRMAssets";
import { SurveyMetadata } from "../src/SurveyMetadata";

suite("AzureRMAssets", () => {
    // Re-enable as part of https://github.com/Microsoft/vscode-azurearmtools/issues/51
    // networkTest("getSurveyMetadata()", () => {
    //     return AzureRMAssets.getSurveyMetadata().then((surveyMetadata: SurveyMetadata) => {
    //         assert(surveyMetadata, "Expected surveyMetadata to be defined and not-null");
    //         assert(surveyMetadata.surveyLink);
    //     });
    // });

    networkTest("getFunctionMetadata()", async () => {
        const functionMetadataArray = (await AzureRMAssets.getFunctionsMetadata()).functionMetadata;
        assert(functionMetadataArray);
        assert(functionMetadataArray.length > 0, `Expected to get at least 1 function metadata, but got ${functionMetadataArray.length} instead.`);
    });

    suite("FunctionMetadata", () => {
        test("constructor(string,string,string)", () => {
            const metadata = new FunctionMetadata("a", "b", "c", 1, 2, []);
            assert.deepStrictEqual(metadata.name, "a");
            assert.deepStrictEqual(metadata.usage, "b");
            assert.deepStrictEqual(metadata.description, "c");
            assert.deepStrictEqual(metadata.minimumArguments, 1);
            assert.deepStrictEqual(metadata.maximumArguments, 2);
            assert.deepStrictEqual(metadata.returnValueMembers, []);
        });

        test("findByName", () => {
            const metadata = new FunctionsMetadata([new FunctionMetadata("hi", "", "", 0, 0, []), new FunctionMetadata("MyFunction", "", "", 0, 0, [])]);

            assert.equal(metadata.findbyName("MyFunction").name, "MyFunction");
            assert.equal(metadata.findbyName("myfunction").name, "MyFunction");
            assert.equal(metadata.findbyName("MYFUNCTION").name, "MyFunction");

            assert.equal(metadata.findbyName("MyFunction2"), undefined);
        });

        test("findByPrefix", () => {
            const metadata = new FunctionsMetadata([
                new FunctionMetadata("One", "", "", 0, 0, []),
                new FunctionMetadata("Onerous", "", "", 0, 0, []),
                new FunctionMetadata("Two", "", "", 0, 0, [])
            ]);

            assert.deepStrictEqual(metadata.filterByPrefix("MyFunction"), []);

            assert.deepStrictEqual(metadata.filterByPrefix("On").map(meta => meta.name), ["One", "Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("on").map(meta => meta.name), ["One", "Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("ONE").map(meta => meta.name), ["One", "Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("Oner").map(meta => meta.name), ["Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("Onerous").map(meta => meta.name), ["Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("Onerousy"), []);
        });

        suite("parameters", () => {
            test("with no parameters in usage", () => {
                const metadata = new FunctionMetadata("a", "a()", "description", 1, 2, []);
                assert.deepStrictEqual(metadata.parameters, []);
            });

            test("with one parameter in usage", () => {
                const metadata = new FunctionMetadata("a", "a(b)", "description", 1, 2, []);
                assert.deepStrictEqual(metadata.parameters, ["b"]);
            });

            test("with two parameters in usage", () => {
                const metadata = new FunctionMetadata("a", "a(b, c )", "description", 1, 2, []);
                assert.deepStrictEqual(metadata.parameters, ["b", "c"]);
            });
        });

        suite("fromString(string)", () => {
            test("with null", () => {
                assert.deepStrictEqual(FunctionMetadata.fromString(null), []);
            });

            test("with undefined", () => {
                assert.deepStrictEqual(FunctionMetadata.fromString(undefined), []);
            });

            test("with empty string", () => {
                assert.deepStrictEqual(FunctionMetadata.fromString(""), []);
            });

            test("with non-JSON string", () => {
                assert.deepStrictEqual(FunctionMetadata.fromString("hello there"), []);
            });

            test("with empty object", () => {
                assert.deepStrictEqual(FunctionMetadata.fromString("{}"), []);
            });

            test("with empty functionSignatures property", () => {
                assert.deepStrictEqual(FunctionMetadata.fromString("{ 'functionSignatures': [] }"), []);
            });

            test("with one function signature with only name property", () => {
                assert.deepStrictEqual(FunctionMetadata.fromString(`{ "functionSignatures": [ { "name": "a", "expectedUsage": "z", "description": "1" } ] }`),
                    [
                        new FunctionMetadata("a", "z", "1", undefined, undefined, [])
                    ]);
            });

            test("with two function signatures with only name property", () => {
                assert.deepStrictEqual(FunctionMetadata.fromString(`{ "functionSignatures": [ { "name": "a", "expectedUsage": "z" }, { "name": "b", "expectedUsage": "y", "description": "7" } ] }`),
                    [
                        new FunctionMetadata("a", "z", undefined, undefined, undefined, []),
                        new FunctionMetadata("b", "y", "7", undefined, undefined, [])
                    ]);
            });

            test("with actual ExpressionMetadata.json file contents", () => {
                const fileContents: string =
                    `{
                "$schema": "expressionMetadata.schema.json",
                "functionSignatures": [
                    {
                    "name": "add",
                    "expectedUsage": "add(operand1, operand2)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "base64",
                    "expectedUsage": "base64(inputString)",
                    "minimumArguments": 1,
                    "maximumArguments": 1
                    },
                    {
                    "name": "concat",
                    "expectedUsage": "concat(arg1, arg2, arg3, ...)",
                    "minimumArguments": 0,
                    "maximumArguments": null
                    },
                    {
                    "name": "copyIndex",
                    "expectedUsage": "copyIndex([offset])",
                    "minimumArguments": 0,
                    "maximumArguments": 1
                    },
                    {
                    "name": "deployment",
                    "expectedUsage": "deployment()",
                    "minimumArguments": 0,
                    "maximumArguments": 0
                    },
                    {
                    "name": "div",
                    "expectedUsage": "div(operand1, operand2)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "int",
                    "expectedUsage": "int(valueToConvert)",
                    "minimumArguments": 1,
                    "maximumArguments": 1
                    },
                    {
                    "name": "length",
                    "expectedUsage": "length(array\/string)",
                    "minimumArguments": 1,
                    "maximumArguments": 1
                    },
                    {
                    "name": "listKeys",
                    "expectedUsage": "listKeys(resourceName\/resourceIdentifier, apiVersion)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "listPackage",
                    "expectedUsage": "listPackage(resourceId, apiVersion)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "mod",
                    "expectedUsage": "mod(operand1, operand2)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "mul",
                    "expectedUsage": "mul(operand1, operand2)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "padLeft",
                    "expectedUsage": "padLeft(stringToPad, totalLength, paddingCharacter)",
                    "minimumArguments": 3,
                    "maximumArguments": 3
                    },
                    {
                    "name": "parameters",
                    "expectedUsage": "parameters(parameterName)",
                    "minimumArguments": 1,
                    "maximumArguments": 1
                    },
                    {
                    "name": "providers",
                    "expectedUsage": "providers(providerNamespace, [resourceType])",
                    "minimumArguments": 1,
                    "maximumArguments": 2
                    },
                    {
                    "name": "reference",
                    "expectedUsage": "reference(resourceName\/resourceIdentifier, [apiVersion])",
                    "minimumArguments": 1,
                    "maximumArguments": 2
                    },
                    {
                    "name": "replace",
                    "expectedUsage": "replace(originalString, oldCharacter, newCharacter)",
                    "minimumArguments": 3,
                    "maximumArguments": 3
                    },
                    {
                    "name": "resourceGroup",
                    "expectedUsage": "resourceGroup()",
                    "minimumArguments": 0,
                    "maximumArguments": 0,
                    "returnValueMembers": [
                        { "name": "id" },
                        { "name": "name" },
                        { "name": "location" },
                        { "name": "properties" },
                        { "name": "tags" }
                    ]
                    },
                    {
                    "name": "resourceId",
                    "expectedUsage": "resourceId([subscriptionId], [resourceGroupName], resourceType, resourceName1, [resourceName2]...)",
                    "minimumArguments": 2,
                    "maximumArguments": null
                    },
                    {
                    "name": "split",
                    "expectedUsage": "split(inputString, delimiter)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "string",
                    "expectedUsage": "string(valueToConvert)",
                    "minimumArguments": 1,
                    "maximumArguments": 1
                    },
                    {
                    "name": "sub",
                    "expectedUsage": "sub(operand1, operand2)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "subscription",
                    "expectedUsage": "subscription()",
                    "minimumArguments": 0,
                    "maximumArguments": 0,
                    "returnValueMembers": [
                        { "name": "id" },
                        { "name": "subscriptionId" }
                    ]
                    },
                    {
                    "name": "substring",
                    "expectedUsage": "substring(stringToParse, startIndex, length)",
                    "minimumArguments": 1,
                    "maximumArguments": 3
                    },
                    {
                    "name": "toLower",
                    "expectedUsage": "toLower(string)",
                    "minimumArguments": 1,
                    "maximumArguments": 1
                    },
                    {
                    "name": "toUpper",
                    "expectedUsage": "toUpper(string)",
                    "minimumArguments": 1,
                    "maximumArguments": 1
                    },
                    {
                        "name": "trim",
                        "expectedUsage": "trim(stringToTrim)",
                        "minimumArguments": 1,
                        "maximumArguments": 1
                    },
                    {
                    "name": "uniqueString",
                    "expectedUsage": "uniqueString(stringForCreatingUniqueString, ...)",
                    "minimumArguments": 1,
                    "maximumArguments": null
                    },
                    {
                    "name": "uri",
                    "expectedUsage": "uri(baseUri, relativeUri)",
                    "minimumArguments": 2,
                    "maximumArguments": 2
                    },
                    {
                    "name": "variables",
                    "expectedUsage": "variables(variableName)",
                    "minimumArguments": 1,
                    "maximumArguments": 1
                    }
                ]
                }`;
                const functionMetadata: FunctionMetadata[] = FunctionMetadata.fromString(fileContents);
                assert(functionMetadata);
                assert(functionMetadata.length > 0);
            })
        });
    });
});
