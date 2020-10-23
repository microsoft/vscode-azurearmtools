// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { isNullOrUndefined } from "util";
import { TemplateScope } from "../documents/templates/scopes/TemplateScope";
import { UserFunctionNamespaceDefinition } from "../documents/templates/UserFunctionNamespaceDefinition";
import { assert } from "../fixed_assert";
import * as assets from "../language/expressions/AzureRMAssets";
import { FunctionCallValue, TleVisitor, Value } from "../language/expressions/TLE";
import { IncorrectArgumentsCountIssue } from "./IncorrectArgumentsCountIssue";

/**
 * A TLE visitor that creates errors if an incorrect number of arguments are used when calling a
 * TLE function.
 */
export class IncorrectFunctionArgumentCountVisitor extends TleVisitor {
    private _errors: IncorrectArgumentsCountIssue[] = [];

    constructor(private readonly _scope: TemplateScope, private readonly _tleFunctions: assets.FunctionsMetadata) {
        super();
    }

    public get errors(): IncorrectArgumentsCountIssue[] {
        return this._errors;
    }

    public visitFunctionCall(tleFunction: FunctionCallValue): void {
        let actualFullFunctionName: string;
        let minimumArguments: number;
        let maximumArguments: number | undefined;

        const functionName: string | undefined = tleFunction.name;
        if (!functionName) {
            return;
        }

        if (tleFunction.namespaceToken) {
            const namespaceName: string = tleFunction.namespaceToken.stringValue.toString();
            const nsDefinition: UserFunctionNamespaceDefinition | undefined = this._scope.getFunctionNamespaceDefinition(namespaceName);

            // If not found, will be handled by the UnrecognizedFunctionVisitor visitor
            if (!nsDefinition) {
                return;
            }

            const functionDefinition = nsDefinition.getMemberDefinition(functionName);
            if (!functionDefinition) {
                return;
            }

            actualFullFunctionName = functionDefinition.fullName;
            minimumArguments = maximumArguments = functionDefinition.parameterDefinitions.length;
        } else {
            // Built-in function call
            let functionMetadata: assets.BuiltinFunctionMetadata | undefined = this._tleFunctions.findbyName(functionName);
            if (!functionMetadata) {
                return;
            }
            actualFullFunctionName = functionMetadata.fullName;

            minimumArguments = functionMetadata.minimumArguments;
            // tslint:disable-next-line:max-line-length
            assert(!isNullOrUndefined(minimumArguments), `TLE function metadata for '${actualFullFunctionName}' has a null or undefined minimum argument value.`);

            maximumArguments = functionMetadata.maximumArguments;
            assert(tleFunction.argumentExpressions);
        }

        const functionCallArgumentCount: number = tleFunction.argumentExpressions.length;

        let message: string | undefined;
        if (minimumArguments === maximumArguments) {
            if (functionCallArgumentCount !== minimumArguments) {
                message = `The function '${actualFullFunctionName}' takes ${minimumArguments} ${this.getArgumentsString(minimumArguments)}.`;
            }
        } else if (isNullOrUndefined(maximumArguments)) {
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

    public static visit(scope: TemplateScope, tleValue: Value | undefined, tleFunctions: assets.FunctionsMetadata): IncorrectFunctionArgumentCountVisitor {
        const visitor = new IncorrectFunctionArgumentCountVisitor(scope, tleFunctions);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
