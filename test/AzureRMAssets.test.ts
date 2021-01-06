// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:max-func-body-length no-non-null-assertion

import * as assert from "assert";
import { AzureRMAssets, BuiltinFunctionMetadata, FunctionsMetadata } from "../extension.bundle";
import { networkTest } from "./networkTest.test";

suite("AzureRMAssets", () => {
    networkTest("getFunctionMetadata()", async () => {
        const functionMetadataArray = AzureRMAssets.getFunctionsMetadata().functionMetadata;
        assert(functionMetadataArray);
        assert(functionMetadataArray.length > 0, `Expected to get at least 1 function metadata, but got ${functionMetadataArray.length} instead.`);
    });

    suite("FunctionMetadata", () => {
        test("constructor(string,string,string)", () => {
            const metadata = new BuiltinFunctionMetadata("a", "b", "c", 1, 2, [], undefined);
            assert.deepStrictEqual(metadata.fullName, "a");
            assert.deepStrictEqual(metadata.usage, "b");
            assert.deepStrictEqual(metadata.description, "c");
            assert.deepStrictEqual(metadata.minimumArguments, 1);
            assert.deepStrictEqual(metadata.maximumArguments, 2);
            assert.deepStrictEqual(metadata.returnValueMembers, []);
        });

        test("findByName", () => {
            const metadata = new FunctionsMetadata(
                [new BuiltinFunctionMetadata("hi", "", "", 0, 0, [], undefined), new BuiltinFunctionMetadata("MyFunction", "", "", 0, 0, [], undefined)]);

            assert.equal(metadata.findbyName("MyFunction")!.fullName, "MyFunction");
            assert.equal(metadata.findbyName("myfunction")!.fullName, "MyFunction");
            assert.equal(metadata.findbyName("MYFUNCTION")!.fullName, "MyFunction");

            assert.equal(metadata.findbyName("MyFunction2"), undefined);
        });

        test("findByPrefix", () => {
            const metadata = new FunctionsMetadata([
                new BuiltinFunctionMetadata("One", "", "", 0, 0, [], undefined),
                new BuiltinFunctionMetadata("Onerous", "", "", 0, 0, [], undefined),
                new BuiltinFunctionMetadata("Two", "", "", 0, 0, [], undefined)
            ]);

            assert.deepStrictEqual(metadata.filterByPrefix("MyFunction"), []);

            assert.deepStrictEqual(metadata.filterByPrefix("On").map(meta => meta.fullName), ["One", "Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("on").map(meta => meta.fullName), ["One", "Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("ONE").map(meta => meta.fullName), ["One", "Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("Oner").map(meta => meta.fullName), ["Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("Onerous").map(meta => meta.fullName), ["Onerous"]);
            assert.deepStrictEqual(metadata.filterByPrefix("Onerousy"), []);
        });

        suite("parameters", () => {
            test("with no parameters in usage", () => {
                const metadata = new BuiltinFunctionMetadata("a", "a()", "description", 1, 2, [], []);
                assert.deepStrictEqual(metadata.parameters, []);
            });

            test("with one parameter in usage", () => {
                const metadata = new BuiltinFunctionMetadata("a", "a(b)", "description", 1, 2, [], undefined);
                assert.deepStrictEqual(metadata.parameters, [{ name: "b", type: undefined }]);
            });

            test("with two parameters in usage", () => {
                const metadata = new BuiltinFunctionMetadata("a", "a(b, c )", "description", 1, 2, [], undefined);
                assert.deepStrictEqual(metadata.parameters, [{ name: "b", type: undefined }, { name: "c", type: undefined }]);
            });
        });

        suite("fromString(string)", () => {
            test("with null", () => {
                // tslint:disable-next-line:no-any
                assert.deepStrictEqual(BuiltinFunctionMetadata.fromString(<any>null), []);
            });

            test("with undefined", () => {
                // tslint:disable-next-line:no-any
                assert.deepStrictEqual(BuiltinFunctionMetadata.fromString(<any>undefined), []);
            });

            test("with empty string", () => {
                assert.deepStrictEqual(BuiltinFunctionMetadata.fromString(""), []);
            });

            test("with non-JSON string", () => {
                assert.deepStrictEqual(BuiltinFunctionMetadata.fromString("hello there"), []);
            });

            test("with empty object", () => {
                assert.deepStrictEqual(BuiltinFunctionMetadata.fromString("{}"), []);
            });

            test("with empty functionSignatures property", () => {
                assert.deepStrictEqual(BuiltinFunctionMetadata.fromString("{ 'functionSignatures': [] }"), []);
            });

            test("with one function signature with only name property", () => {
                assert.deepStrictEqual(
                    BuiltinFunctionMetadata.fromString(`{ "functionSignatures": [ { "name": "a", "expectedUsage": "z", "description": "1" } ] }`),
                    [
                        // tslint:disable-next-line:no-any
                        new BuiltinFunctionMetadata("a", "z", "1", <any>undefined, <any>undefined, [], undefined)
                    ]);
            });

            test("with two function signatures with only name property", () => {
                assert.deepStrictEqual(
                    // tslint:disable-next-line:max-line-length
                    BuiltinFunctionMetadata.fromString(`{ "functionSignatures": [ { "name": "a", "expectedUsage": "z" }, { "name": "b", "expectedUsage": "y", "description": "7" } ] }`),
                    [
                        // tslint:disable-next-line:no-any
                        new BuiltinFunctionMetadata("a", "z", <any>undefined, <any>undefined, <any>undefined, [], undefined),
                        // tslint:disable-next-line:no-any
                        new BuiltinFunctionMetadata("b", "y", "7", <any>undefined, <any>undefined, [], undefined)
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
                    "expectedUsage": "listPackage(resourceName\/resourceIdentifier, apiVersion)",
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
                const functionMetadata: BuiltinFunctionMetadata[] = BuiltinFunctionMetadata.fromString(fileContents);
                assert(functionMetadata);
                assert(functionMetadata.length > 0);
            });
        });
    });
});
