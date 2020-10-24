// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { TLE } from "../../extension.bundle";
import { UserFunctionDefinition } from "../documents/templates/UserFunctionDefinition";
import { UserFunctionNamespaceDefinition } from "../documents/templates/UserFunctionNamespaceDefinition";
import { assert } from "../fixed_assert";
import * as assets from "../language/expressions/AzureRMAssets";
import { Issue } from "../language/Issue";
import { IncorrectArgumentsCountIssue } from "./IncorrectArgumentsCountIssue";

export function validateUserFunctionCallArgCounts(tleFunction: TLE.FunctionCallValue, nsDefinition: UserFunctionNamespaceDefinition, functionDefinition: UserFunctionDefinition): Issue | undefined {
    let actualFullFunctionName: string;
    let minimumArguments: number;
    let maximumArguments: number | undefined;

    actualFullFunctionName = functionDefinition.fullName;
    minimumArguments = maximumArguments = functionDefinition.parameterDefinitions.length;

    return getFunctionArgumentCountError(actualFullFunctionName, minimumArguments, maximumArguments, tleFunction);
}

export function validateBuiltInFunctionCallArgCounts(tleFunction: TLE.FunctionCallValue, functionMetadata: assets.BuiltinFunctionMetadata): Issue | undefined {
    let actualFullFunctionName: string;
    let minimumArguments: number;
    let maximumArguments: number | undefined;

    actualFullFunctionName = functionMetadata.fullName;

    minimumArguments = functionMetadata.minimumArguments;
    assert(typeof minimumArguments === 'number', `TLE function metadata for '${actualFullFunctionName}' has a null or undefined minimum argument value.`);

    maximumArguments = functionMetadata.maximumArguments;
    assert(tleFunction.argumentExpressions); //asdf remove

    return getFunctionArgumentCountError(actualFullFunctionName, minimumArguments, maximumArguments, tleFunction);
}

function getFunctionArgumentCountError(
    actualFullFunctionName: string,
    minimumArguments: number,
    maximumArguments: number | undefined,
    tleFunction: TLE.FunctionCallValue
): Issue | undefined {
    const functionCallArgumentCount: number = tleFunction.argumentExpressions.length;

    let message: string | undefined;
    if (minimumArguments === maximumArguments) {
        if (functionCallArgumentCount !== minimumArguments) {
            message = `The function '${actualFullFunctionName}' takes ${minimumArguments} ${getArgumentsString(minimumArguments)}.`;
        }
    } else if (typeof maximumArguments !== 'number') {
        if (functionCallArgumentCount < minimumArguments) {
            message = `The function '${actualFullFunctionName}' takes at least ${minimumArguments} ${getArgumentsString(minimumArguments)}.`;
        }
    } else {
        assert(minimumArguments < maximumArguments);
        if (functionCallArgumentCount < minimumArguments || maximumArguments < functionCallArgumentCount) {
            // tslint:disable-next-line:max-line-length
            message = `The function '${actualFullFunctionName}' takes between ${minimumArguments} and ${maximumArguments} ${getArgumentsString(maximumArguments)}.`;
        }
    }

    if (message) {
        let issue = new IncorrectArgumentsCountIssue(tleFunction.getSpan(), message, actualFullFunctionName, tleFunction.argumentExpressions.length, minimumArguments, maximumArguments);
        return issue;
    }
}

function getArgumentsString(argumentCount: number): string {
    return `argument${argumentCount === 1 ? "" : "s"}`;
}
