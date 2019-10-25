// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assets from "../AzureRMAssets";
import * as language from '../Language';
import { TemplateScope } from "../TemplateScope";
import { FunctionCallValue, Value, Visitor } from "../TLE";
import { UnrecognizedBuiltinFunctionIssue, UnrecognizedUserFunctionIssue, UnrecognizedUserNamespaceIssue } from "../UnrecognizedFunctionIssues";

/**
 * A TLE visitor that finds references to undefined functions.
 */
export class UnrecognizedFunctionVisitor extends Visitor {
    private _errors: language.Issue[] = [];
    constructor(private _scope: TemplateScope, private _tleFunctions: assets.FunctionsMetadata) {
        super();
    }
    public get errors(): language.Issue[] {
        return this._errors;
    }
    public visitFunctionCall(tleFunction: FunctionCallValue): void {
        const functionName: string | null = tleFunction.name;
        // tslint:disable-next-line: strict-boolean-expressions
        const functionNameSpan: language.Span | null = tleFunction.nameToken && tleFunction.nameToken.span;
        if (functionName && functionNameSpan) {
            if (tleFunction.namespaceToken) {
                // User-defined function reference
                const namespaceName: string = tleFunction.namespaceToken.stringValue;
                const namespaceSpan: language.Span = tleFunction.namespaceToken.span;
                let namespaceDefinition = this._scope.getFunctionNamespaceDefinition(namespaceName);
                if (!namespaceDefinition) {
                    // Namespace not found
                    this._errors.push(new UnrecognizedUserNamespaceIssue(namespaceSpan, namespaceName));
                } else {
                    // Name not found within namespace
                    let funcDefinition = namespaceDefinition.getMemberDefinition(functionName);
                    if (!funcDefinition) {
                        this._errors.push(new UnrecognizedUserFunctionIssue(functionNameSpan, namespaceName, functionName));
                    }
                }
            } else {
                // Built-in function
                const functionMetadata: assets.BuiltinFunctionMetadata | undefined = this._tleFunctions.findbyName(functionName);
                if (!functionMetadata) {
                    this._errors.push(new UnrecognizedBuiltinFunctionIssue(functionNameSpan, functionName));
                }
            }
        }

        super.visitFunctionCall(tleFunction);
    }
    public static visit(scope: TemplateScope, tleValue: Value | null, tleFunctions: assets.FunctionsMetadata): UnrecognizedFunctionVisitor {
        let visitor = new UnrecognizedFunctionVisitor(scope, tleFunctions);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
