// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { TemplateScope } from "../documents/templates/scopes/TemplateScope";
import * as assets from "../language/expressions/AzureRMAssets";
import { FunctionCallValue, TleVisitor, Value } from "../language/expressions/TLE";
import { Issue } from "../language/Issue";
import { Span } from "../language/Span";
import { UnrecognizedBuiltinFunctionIssue, UnrecognizedUserFunctionIssue, UnrecognizedUserNamespaceIssue } from "./UnrecognizedFunctionIssues";

/**
 * A TLE visitor that finds references to undefined functions.
 */
export class UnrecognizedFunctionVisitor extends TleVisitor {
    private _errors: Issue[] = [];
    constructor(private _scope: TemplateScope, private _tleFunctions: assets.FunctionsMetadata) {
        super();
    }
    public get errors(): Issue[] {
        return this._errors;
    }
    public visitFunctionCall(tleFunction: FunctionCallValue): void {
        const functionName: string | undefined = tleFunction.name;
        // tslint:disable-next-line: strict-boolean-expressions
        const functionNameSpan: Span | undefined = tleFunction.nameToken && tleFunction.nameToken.span;
        if (functionName && functionNameSpan) {
            if (tleFunction.namespaceToken) {
                // User-defined function reference
                const namespaceName: string = tleFunction.namespaceToken.stringValue;
                const namespaceSpan: Span = tleFunction.namespaceToken.span;
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
    public static visit(scope: TemplateScope, tleValue: Value | undefined, tleFunctions: assets.FunctionsMetadata): UnrecognizedFunctionVisitor {
        let visitor = new UnrecognizedFunctionVisitor(scope, tleFunctions);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
