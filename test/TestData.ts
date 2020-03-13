// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fs from 'fs';
import { ITest, ITestCallbackContext } from 'mocha';
import * as path from 'path';
import { AzureRMAssets, Completion, Language } from "../extension.bundle";
import { ITestPreparation, ITestPreparationResult, testWithPrep } from './support/testWithPrep';

// By default we use the test metadata for tests
export function useTestFunctionMetadata(): void {
    let testMetadata = fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'TestData.ExpressionMetadata.json'));
    AzureRMAssets.setFunctionsMetadata(testMetadata.toString());
    console.log("Installed test function metadata");
}

export function useRealFunctionMetadata(): void {
    AzureRMAssets.setFunctionsMetadata(undefined);
    console.log("Re-installing real function metadata");
}

export class UseRealFunctionMetadata implements ITestPreparation {
    public static readonly instance: UseRealFunctionMetadata = new UseRealFunctionMetadata();

    public pretest(this: ITestCallbackContext): ITestPreparationResult {
        useRealFunctionMetadata();
        return {
            postTest: useTestFunctionMetadata
        };
    }
}

export async function runWithRealFunctionMetadata(callback: () => Promise<unknown>): Promise<unknown> {
    try {
        useRealFunctionMetadata();
        // tslint:disable-next-line: no-unsafe-any
        return await callback();
    } finally {
        useTestFunctionMetadata();
    }
}

export function testWithRealFunctionMetadata(expectation: string, callback?: (this: ITestCallbackContext) => Promise<unknown>): ITest {
    return testWithPrep(expectation, [UseRealFunctionMetadata.instance], callback);
}

export const allTestDataCompletionNames = new Set<string>(allTestDataExpectedCompletions(0, 0).map(item => item.name));

export function allTestDataExpectedCompletions(startIndex: number, length: number): Completion.Item[] {
    return [
        expectedAddCompletion(startIndex, length),
        expectedBase64Completion(startIndex, length),
        expectedConcatCompletion(startIndex, length),
        expectedCopyIndexCompletion(startIndex, length),
        expectedDeploymentCompletion(startIndex, length),
        expectedDivCompletion(startIndex, length),
        expectedEqualsCompletion(startIndex, length),
        expectedIntCompletion(startIndex, length),
        expectedLengthCompletion(startIndex, length),
        expectedListKeysCompletion(startIndex, length),
        expectedListPackageCompletion(startIndex, length),
        expectedModCompletion(startIndex, length),
        expectedMulCompletion(startIndex, length),
        expectedPadLeftCompletion(startIndex, length),
        expectedParametersCompletion(startIndex, length),
        expectedProvidersCompletion(startIndex, length),
        expectedReferenceCompletion(startIndex, length),
        expectedReplaceCompletion(startIndex, length),
        expectedResourceGroupCompletion(startIndex, length),
        expectedResourceIdCompletion(startIndex, length),
        expectedSkipCompletion(startIndex, length),
        expectedSplitCompletion(startIndex, length),
        expectedStringCompletion(startIndex, length),
        expectedSubCompletion(startIndex, length),
        expectedSubscriptionCompletion(startIndex, length),
        expectedSubscriptionResourceIdCompletion(startIndex, length),
        expectedSubstringCompletion(startIndex, length),
        expectedTakeCompletion(startIndex, length),
        expectedToLowerCompletion(startIndex, length),
        expectedToUpperCompletion(startIndex, length),
        expectedTrimCompletion(startIndex, length),
        expectedUniqueStringCompletion(startIndex, length),
        expectedUriCompletion(startIndex, length),
        expectedVariablesCompletion(startIndex, length)
    ];
}

export function expectedAddCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("add", "add($0)", new Language.Span(startIndex, length), "(function) add(operand1, operand2)", "Returns the sum of the two provided integers.", Completion.CompletionKind.Function);
}

export function expectedBase64Completion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("base64", "base64($0)", new Language.Span(startIndex, length), "(function) base64(inputString)", "Returns the base64 representation of the input string.", Completion.CompletionKind.Function);
}

export function expectedConcatCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("concat", "concat($0)", new Language.Span(startIndex, length), "(function) concat(arg1, arg2, arg3, ...)", "Combines multiple values and returns the concatenated result. This function can take any number of arguments, and can accept either strings or arrays for the parameters.", Completion.CompletionKind.Function);
}

export function expectedCopyIndexCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("copyIndex", "copyIndex($0)", new Language.Span(startIndex, length), "(function) copyIndex([offset]) or copyIndex(loopName, [offset])", "Returns the current index of an iteration loop.\nThis function is always used with a copy object.", Completion.CompletionKind.Function);
}

export function expectedDeploymentCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("deployment", "deployment()$0", new Language.Span(startIndex, length), "(function) deployment() [object]", "Returns information about the current deployment operation. This function returns the object that is passed during deployment. The properties in the returned object will differ based on whether the deployment object is passed as a link or as an in-line object.", Completion.CompletionKind.Function);
}

export function expectedDivCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("div", "div($0)", new Language.Span(startIndex, length), "(function) div(operand1, operand2)", "Returns the integer division of the two provided integers.", Completion.CompletionKind.Function);
}

export function expectedEqualsCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("equals", "equals($0)", new Language.Span(startIndex, length), "(function) equals(arg1, arg2)", "Checks whether two values equal each other.", Completion.CompletionKind.Function);
}

export function expectedIntCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("int", "int($0)", new Language.Span(startIndex, length), "(function) int(valueToConvert)", "Converts the specified value to Integer.", Completion.CompletionKind.Function);
}

export function expectedLengthCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("length", "length($0)", new Language.Span(startIndex, length), "(function) length(array/string)", "Returns the number of elements in an array or the number of characters in a string. You can use this function with an array to specify the number of iterations when creating resources.", Completion.CompletionKind.Function);
}

export function expectedListKeysCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("listKeys", "listKeys($0)", new Language.Span(startIndex, length), "(function) listKeys(resourceName/resourceIdentifier, apiVersion) [object]", "Returns the keys of a storage account. The resourceId can be specified by using the resourceId function or by using the format providerNamespace/resourceType/resourceName. You can use the function to get the primary (key[0]) and secondary key (key[1]).", Completion.CompletionKind.Function);
}

export function expectedListPackageCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("listPackage", "listPackage($0)", new Language.Span(startIndex, length), "(function) listPackage(resourceName\/resourceIdentifier, apiVersion)", "Lists the virtual network gateway package. The resourceId can be specified by using the resourceId function or by using the format providerNamespace/resourceType/resourceName.", Completion.CompletionKind.Function);
}

export function expectedModCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("mod", "mod($0)", new Language.Span(startIndex, length), "(function) mod(operand1, operand2)", "Returns the remainder of the integer division using the two provided integers.", Completion.CompletionKind.Function);
}

export function expectedMulCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("mul", "mul($0)", new Language.Span(startIndex, length), "(function) mul(operand1, operand2)", "Returns the multiplication of the two provided integers.", Completion.CompletionKind.Function);
}

export function expectedPadLeftCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("padLeft", "padLeft($0)", new Language.Span(startIndex, length), "(function) padLeft(stringToPad, totalLength, paddingCharacter)", "Returns a right-aligned string by adding characters to the left until reaching the total specified length.", Completion.CompletionKind.Function);
}

export function expectedParametersCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("parameters", "parameters($0)", new Language.Span(startIndex, length), "(function) parameters(parameterName)", "Returns a parameter value. The specified parameter name must be defined in the parameters section of the template.", Completion.CompletionKind.Function);
}

export function expectedProvidersCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("providers", "providers($0)", new Language.Span(startIndex, length), "(function) providers(providerNamespace, [resourceType])", "Return information about a resource provider and its supported resource types. If not type is provided, all of the supported types are returned.", Completion.CompletionKind.Function);
}

export function expectedReferenceCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("reference", "reference($0)", new Language.Span(startIndex, length), "(function) reference(resourceName/resourceIdentifier, [apiVersion], ['Full'])", "Enables an expression to derive its value from another resource's runtime state.", Completion.CompletionKind.Function);
}

export function expectedReplaceCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("replace", "replace($0)", new Language.Span(startIndex, length), "(function) replace(originalString, oldCharacter, newCharacter)", "Returns a new string with all instances of one character in the specified string replaced by another character.", Completion.CompletionKind.Function);
}

export function expectedResourceGroupCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("resourceGroup", "resourceGroup()$0", new Language.Span(startIndex, length), "(function) resourceGroup() [object]", "Returns a structured object that represents the current resource group.", Completion.CompletionKind.Function);
}

export function expectedResourceIdCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("resourceId", "resourceId($0)", new Language.Span(startIndex, length), "(function) resourceId([subscriptionId], [resourceGroupName], resourceType, resourceName1, [resourceName2]...)", "Returns the unique identifier of a resource. You use this function when the resource name is ambiguous or not provisioned within the same template.", Completion.CompletionKind.Function);
}

export function expectedSkipCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("skip", "skip($0)", new Language.Span(startIndex, length), "(function) skip(originalValue, numberToSkip)", "Returns an array or string with all of the elements or characters after the specified number in the array or string.", Completion.CompletionKind.Function);
}

export function expectedSplitCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("split", "split($0)", new Language.Span(startIndex, length), "(function) split(inputString, delimiter)", "Returns an array of strings that contains the substrings of the input string that are delimited by the sent delimiters.", Completion.CompletionKind.Function);
}

export function expectedStringCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("string", "string($0)", new Language.Span(startIndex, length), "(function) string(valueToConvert)", "Converts the specified value to String.", Completion.CompletionKind.Function);
}

export function expectedSubCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("sub", "sub($0)", new Language.Span(startIndex, length), "(function) sub(operand1, operand2)", "Returns the subtraction of the two provided integers.", Completion.CompletionKind.Function);
}

export function expectedSubscriptionCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("subscription", "subscription()$0", new Language.Span(startIndex, length), "(function) subscription() [object]", "Returns details about the subscription.", Completion.CompletionKind.Function);
}

export function expectedSubscriptionResourceIdCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("subscriptionResourceId", "subscriptionResourceId($0)", new Language.Span(startIndex, length), "(function) subscriptionResourceId([subscriptionId], resourceType, resourceName1, [resourceName2]...)", "Returns the unique resource identifier of a subscription scoped resource. You use this function to create a resourceId for a given resource as required by a property value.", Completion.CompletionKind.Function);
}

export function expectedSubstringCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("substring", "substring($0)", new Language.Span(startIndex, length), "(function) substring(stringToParse, startIndex, length)", "Returns a substring that starts at the specified character position and contains the specified number of characters.", Completion.CompletionKind.Function);
}

export function expectedTakeCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("take", "take($0)", new Language.Span(startIndex, length), "(function) take(originalValue, numberToTake)", "Returns an array or string with the specified number of elements or characters from the start of the array or string.", Completion.CompletionKind.Function);
}

export function expectedToLowerCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("toLower", "toLower($0)", new Language.Span(startIndex, length), "(function) toLower(string)", "Converts the specified string to lower case.", Completion.CompletionKind.Function);
}

export function expectedToUpperCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("toUpper", "toUpper($0)", new Language.Span(startIndex, length), "(function) toUpper(string)", "Converts the specified string to upper case.", Completion.CompletionKind.Function);
}

export function expectedTrimCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("trim", "trim($0)", new Language.Span(startIndex, length), "(function) trim(stringToTrim)", "Removes all leading and trailing white-space characters from the specified string.", Completion.CompletionKind.Function);
}

export function expectedUniqueStringCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("uniqueString", "uniqueString($0)", new Language.Span(startIndex, length), "(function) uniqueString(stringForCreatingUniqueString, ...)", "Performs a 64-bit hash of the provided strings to create a unique string. This function is helpful when you need to create a unique name for a resource. You provide parameter values that represent the level of uniqueness for the result. You can specify whether the name is unique for your subscription, resource group, or deployment.", Completion.CompletionKind.Function);
}

export function expectedUriCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("uri", "uri($0)", new Language.Span(startIndex, length), "(function) uri(baseUri, relativeUri)", "Creates an absolute URI by combining the baseUri and the relativeUri string.", Completion.CompletionKind.Function);
}

export function expectedVariablesCompletion(startIndex: number, length: number): Completion.Item {
    return new Completion.Item("variables", "variables($0)", new Language.Span(startIndex, length), "(function) variables(variableName)", "Returns the value of variable. The specified variable name must be defined in the variables section of the template.", Completion.CompletionKind.Function);
}

export function parameterCompletion(parameterName: string, startIndex: number, length: number, includeRightParenthesis: boolean = true): Completion.Item {
    return new Completion.Item(`'${parameterName}'`, `'${parameterName}'${includeRightParenthesis ? ")" : ""}$0`, new Language.Span(startIndex, length), "(parameter)", undefined, Completion.CompletionKind.Parameter);
}

export function propertyCompletion(propertyName: string, startIndex: number, length: number): Completion.Item {
    return new Completion.Item(propertyName, `${propertyName}$0`, new Language.Span(startIndex, length), "(property)", "", Completion.CompletionKind.Property);
}

export function variableCompletion(variableName: string, startIndex: number, length: number, includeRightParenthesis: boolean = true): Completion.Item {
    return new Completion.Item(`'${variableName}'`, `'${variableName}'${includeRightParenthesis ? ")" : ""}$0`, new Language.Span(startIndex, length), "(variable)", "", Completion.CompletionKind.Variable);
}
