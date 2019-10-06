// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assets from "../AzureRMAssets";
import { assert } from "../fixed_assert";
import { IncorrectArgumentsCountIssue } from "../IncorrectArgumentsCountIssue";
import { TemplateScope } from "../TemplateScope";
import { FunctionCallValue, Value, Visitor } from "../TLE";
import { UserFunctionNamespaceDefinition } from "../UserFunctionNamespaceDefinition";

/**
 * A TLE visitor that creates errors if an incorrect number of arguments are used when calling a
 * TLE function.
 */
export class IncorrectFunctionArgumentCountVisitor extends Visitor {
    private _errors: IncorrectArgumentsCountIssue[] = [];

    constructor(private _tleFunctions: assets.FunctionsMetadata, private _scope: TemplateScope) {
        super();
    }

    public get errors(): IncorrectArgumentsCountIssue[] {
        return this._errors;
    }

    public visitFunctionCall(tleFunction: FunctionCallValue): void {
        let actualFullFunctionName: string;
        let minimumArguments: number | undefined;
        let maximumArguments: number | undefined;

        if (tleFunction.namespaceToken) {
            const namespaceName: string = tleFunction.namespaceToken.stringValue.toString();
            const nsDefinition: UserFunctionNamespaceDefinition | undefined = this._scope.getFunctionNamespaceDefinition(namespaceName);

            // If not found, will be handled by the UnrecognizedFunctionVisitor visitor
            if (!nsDefinition) {
                return;
            }

            const functionName: string = tleFunction.nameToken.stringValue.toString();
            const functionDefinition = nsDefinition.getMemberDefinition(functionName);
            if (!functionDefinition) {
                return;
            }

            actualFullFunctionName = functionDefinition.fullName;
            minimumArguments = maximumArguments = functionDefinition.parameterDefinitions.length;
        } else {
            // Built-in function call
            const parsedFunctionName: string = tleFunction.nameToken.stringValue;
            let functionMetadata: assets.FunctionMetadata | undefined = this._tleFunctions.findbyName(parsedFunctionName);
            if (!functionMetadata) {
                return;
            }
            actualFullFunctionName = functionMetadata.name;

            minimumArguments = functionMetadata.minimumArguments;
            // tslint:disable-next-line:max-line-length
            assert(minimumArguments !== null && minimumArguments !== undefined, `TLE function metadata for '${actualFullFunctionName}' has a null or undefined minimum argument value.`);

            maximumArguments = functionMetadata.maximumArguments;
            assert(tleFunction.argumentExpressions);
        }

        const functionCallArgumentCount: number = tleFunction.argumentExpressions.length;

        let message: string | undefined;
        if (minimumArguments === maximumArguments) {
            if (functionCallArgumentCount !== minimumArguments) {
                message = `The function '${actualFullFunctionName}' takes ${minimumArguments} ${this.getArgumentsString(minimumArguments)}.`;
            }
        } else if (maximumArguments === null || maximumArguments === undefined) {
            if (functionCallArgumentCount < minimumArguments) {
                message = `The function '${actualFullFunctionName}' takes at least ${minimumArguments} ${this.getArgumentsString(minimumArguments)}.`;
            }
        } else {
            assert(minimumArguments < maximumArguments);
            if (functionCallArgumentCount < minimumArguments || maximumArguments < functionCallArgumentCount) {
                // tslint:disable-next-line:max-line-length
                message = `The function '${actualFullFunctionName}' takes between ${minimumArguments} and ${maximumArguments} ${this.getArgumentsString(maximumArguments)}.`;
            }
        }

        if (message) {
            let issue = new IncorrectArgumentsCountIssue(tleFunction.getSpan(), message, actualFullFunctionName, tleFunction.argumentExpressions.length, minimumArguments, maximumArguments);
            this._errors.push(issue);
        }

        super.visitFunctionCall(tleFunction);
    }

    private getArgumentsString(argumentCount: number): string {
        return `argument${argumentCount === 1 ? "" : "s"}`;
    }

    public static visit(tleValue: Value | null, tleFunctions: assets.FunctionsMetadata, scope: TemplateScope): IncorrectFunctionArgumentCountVisitor {
        const visitor = new IncorrectFunctionArgumentCountVisitor(tleFunctions, scope);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
