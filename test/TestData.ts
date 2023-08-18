// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fs from 'fs';
import { Context, Test } from 'mocha';
import * as path from 'path';
import { AzureRMAssets, Completion, Span } from "../extension.bundle";
import { writeToLog } from './support/testLog';
import { ITestPreparation, ITestPreparationResult, testWithPrep } from './support/testWithPrep';

// By default we use the test metadata for tests
export function useTestFunctionMetadata(): void {
    const testMetadata = fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'TestData.ExpressionMetadata.json'));
    AzureRMAssets.setFunctionsMetadata(testMetadata.toString());
    writeToLog("Installed test function metadata");
}

export function useRealFunctionMetadata(): void {
    AzureRMAssets.setFunctionsMetadata(undefined);
    writeToLog("Re-installing real function metadata");
}

export class UseRealFunctionMetadata implements ITestPreparation {
    public static readonly instance: UseRealFunctionMetadata = new UseRealFunctionMetadata();

    public pretest(this: Context): ITestPreparationResult {
        useRealFunctionMetadata();
        return {
            postTestActions: useTestFunctionMetadata
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

export function testWithRealFunctionMetadata(expectation: string, callback?: (this: Context) => Promise<unknown>): Test {
    return testWithPrep(expectation, [UseRealFunctionMetadata.instance], callback);
}

export const allTestDataCompletionNames = new Set<string>(allTestDataExpectedCompletions(0, 0).map(item => item.label));

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

export function newCompletionItem(
    label: string,
    insertText: string,
    span: Span,
    kind: Completion.CompletionKind,
    detail?: string,
    documentation?: string
): Completion.Item {
    return new Completion.Item({
        label,
        insertText,
        span,
        kind,
        detail,
        documentation
    });
}

export function expectedAddCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("add", "add", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) add(operand1, operand2)", "Returns the sum of the two provided integers.");
}

export function expectedBase64Completion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("base64", "base64", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) base64(inputString)", "Returns the base64 representation of the input string.");
}

export function expectedConcatCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("concat", "concat", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) concat(arg1, arg2, arg3, ...)", "Combines multiple values and returns the concatenated result. This function can take any number of arguments, and can accept either strings or arrays for the parameters.");
}

export function expectedCopyIndexCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("copyIndex", "copyIndex", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) copyIndex([offset]) or copyIndex(loopName, [offset])", "Returns the current index of an iteration loop.\nThis function is always used with a copy object.");
}

export function expectedDeploymentCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("deployment", "deployment", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) deployment() [object]", "Returns information about the current deployment operation. This function returns the object that is passed during deployment. The properties in the returned object will differ based on whether the deployment object is passed as a link or as an in-line object.");
}

export function expectedDivCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("div", "div", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) div(operand1, operand2)", "Returns the integer division of the two provided integers.");
}

export function expectedEqualsCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("equals", "equals", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) equals(arg1, arg2)", "Checks whether two values equal each other.");
}

export function expectedIntCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("int", "int", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) int(valueToConvert)", "Converts the specified value to Integer.");
}

export function expectedLengthCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("length", "length", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) length(array/string)", "Returns the number of elements in an array or the number of characters in a string. You can use this function with an array to specify the number of iterations when creating resources.");
}

export function expectedListKeysCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("listKeys", "listKeys", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) listKeys(resourceName/resourceIdentifier, apiVersion) [object]", "Returns the keys of a storage account. The resourceId can be specified by using the resourceId function or by using the format providerNamespace/resourceType/resourceName. You can use the function to get the primary (key[0]) and secondary key (key[1]).");
}

export function expectedListPackageCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("listPackage", "listPackage", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) listPackage(resourceName\/resourceIdentifier, apiVersion)", "Lists the virtual network gateway package. The resourceId can be specified by using the resourceId function or by using the format providerNamespace/resourceType/resourceName.");
}

export function expectedModCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("mod", "mod", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) mod(operand1, operand2)", "Returns the remainder of the integer division using the two provided integers.");
}

export function expectedMulCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("mul", "mul", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) mul(operand1, operand2)", "Returns the multiplication of the two provided integers.");
}

export function expectedPadLeftCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("padLeft", "padLeft", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) padLeft(stringToPad, totalLength, paddingCharacter)", "Returns a right-aligned string by adding characters to the left until reaching the total specified length.");
}

export function expectedParametersCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("parameters", "parameters", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) parameters(parameterName)", "Returns a parameter value. The specified parameter name must be defined in the parameters section of the template.");
}

export function expectedProvidersCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("providers", "providers", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) providers(providerNamespace, [resourceType])", "Return information about a resource provider and its supported resource types. If not type is provided, all of the supported types are returned.");
}

export function expectedReferenceCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("reference", "reference", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) reference(resourceName/resourceIdentifier, [apiVersion], ['Full'])", "Enables an expression to derive its value from another resource's runtime state.");
}

export function expectedReplaceCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("replace", "replace", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) replace(originalString, oldCharacter, newCharacter)", "Returns a new string with all instances of one character in the specified string replaced by another character.");
}

export function expectedResourceGroupCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("resourceGroup", "resourceGroup", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) resourceGroup() [object]", "Returns a structured object that represents the current resource group.");
}

export function expectedResourceIdCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("resourceId", "resourceId", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) resourceId([subscriptionId], [resourceGroupName], resourceType, resourceName1, [resourceName2]...)", "Returns the unique identifier of a resource. You use this function when the resource name is ambiguous or not provisioned within the same template.");
}

export function expectedSkipCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("skip", "skip", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) skip(originalValue, numberToSkip)", "Returns an array or string with all of the elements or characters after the specified number in the array or string.");
}

export function expectedSplitCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("split", "split", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) split(inputString, delimiter)", "Returns an array of strings that contains the substrings of the input string that are delimited by the sent delimiters.");
}

export function expectedStringCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("string", "string", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) string(valueToConvert)", "Converts the specified value to String.");
}

export function expectedSubCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("sub", "sub", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) sub(operand1, operand2)", "Returns the subtraction of the two provided integers.");
}

export function expectedSubscriptionCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("subscription", "subscription", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) subscription() [object]", "Returns details about the subscription.");
}

export function expectedSubscriptionResourceIdCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("subscriptionResourceId", "subscriptionResourceId", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) subscriptionResourceId([subscriptionId], resourceType, resourceName1, [resourceName2]...)", "Returns the unique resource identifier of a subscription scoped resource. You use this function to create a resourceId for a given resource as required by a property value.");
}

export function expectedSubstringCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("substring", "substring", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) substring(stringToParse, startIndex, length)", "Returns a substring that starts at the specified character position and contains the specified number of characters.");
}

export function expectedTakeCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("take", "take", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) take(originalValue, numberToTake)", "Returns an array or string with the specified number of elements or characters from the start of the array or string.");
}

export function expectedToLowerCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("toLower", "toLower", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) toLower(string)", "Converts the specified string to lower case.");
}

export function expectedToUpperCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("toUpper", "toUpper", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) toUpper(string)", "Converts the specified string to upper case.");
}

export function expectedTrimCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("trim", "trim", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) trim(stringToTrim)", "Removes all leading and trailing white-space characters from the specified string.");
}

export function expectedUniqueStringCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("uniqueString", "uniqueString", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) uniqueString(stringForCreatingUniqueString, ...)", "Performs a 64-bit hash of the provided strings to create a unique string. This function is helpful when you need to create a unique name for a resource. You provide parameter values that represent the level of uniqueness for the result. You can specify whether the name is unique for your subscription, resource group, or deployment.");
}

export function expectedUriCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("uri", "uri", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) uri(baseUri, relativeUri)", "Creates an absolute URI by combining the baseUri and the relativeUri string.");
}

export function expectedVariablesCompletion(startIndex: number, length: number): Completion.Item {
    return newCompletionItem("variables", "variables", new Span(startIndex, length), Completion.CompletionKind.tleFunction, "(function) variables(variableName)", "Returns the value of variable. The specified variable name must be defined in the variables section of the template.");
}

export function parameterCompletion(parameterName: string, startIndex: number, length: number, includeRightParenthesis: boolean = true): Completion.Item {
    return newCompletionItem(`'${parameterName}'`, `'${parameterName}'${includeRightParenthesis ? ")" : ""}`, new Span(startIndex, length), Completion.CompletionKind.tleParameter, "(parameter)", undefined);
}

export function propertyCompletion(propertyName: string, startIndex: number, length: number): Completion.Item {
    return newCompletionItem(propertyName, `${propertyName}`, new Span(startIndex, length), Completion.CompletionKind.tleProperty, "(property)");
}

export function variableCompletion(variableName: string, startIndex: number, length: number, includeRightParenthesis: boolean = true): Completion.Item {
    return newCompletionItem(`'${variableName}'`, `'${variableName}'${includeRightParenthesis ? ")" : ""}`, new Span(startIndex, length), Completion.CompletionKind.tleVariable, "(variable)");
}
