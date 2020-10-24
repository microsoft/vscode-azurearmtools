// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { TLE } from "../../extension.bundle";
import { templateKeys } from "../constants";
import { TemplateScope } from "../documents/templates/scopes/TemplateScope";
import { UserFunctionDefinition } from "../documents/templates/UserFunctionDefinition";
import { UserFunctionNamespaceDefinition } from "../documents/templates/UserFunctionNamespaceDefinition";
import { BuiltinFunctionMetadata, FunctionsMetadata } from "../language/expressions/AzureRMAssets";
import { FunctionCallValue, StringValue, TleVisitor, Value } from "../language/expressions/TLE";
import { INamedDefinition } from "../language/INamedDefinition";
import { Issue } from "../language/Issue";
import { IssueKind } from "../language/IssueKind";
import * as Reference from "../language/ReferenceList";
import { Span } from "../language/Span";
import { UnrecognizedBuiltinFunctionIssue, UnrecognizedUserFunctionIssue, UnrecognizedUserNamespaceIssue } from "./UnrecognizedFunctionIssues";
import { validateBuiltInFunctionCallArgCounts, validateUserFunctionCallArgCounts } from "./validateFunctionCallArgCounts";

/**
 * Finds all references to all definitions inside a JSON string
 */
export class FindReferencesVisitor extends TleVisitor {
    constructor(
        private readonly _scope: TemplateScope,
        private readonly _jsonStringStartIndex: number,
        private readonly _functionsMetadata: FunctionsMetadata,
        private readonly _referenceListsMap: Map<INamedDefinition | undefined, Reference.ReferenceList>,
        private readonly _errors: Issue[]
    ) {
        super();

        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Implement searching for DefinitionKind.ParameterValue
    }

    private addReference(definition: INamedDefinition, span: Span): void {
        let list = this._referenceListsMap.get(definition);
        if (!list) {
            list = new Reference.ReferenceList(definition.definitionKind);
            this._referenceListsMap.set(definition, list);
        }

        list.add({
            document: this._scope.document,
            span: span.translate(this._jsonStringStartIndex)
        });
    }

    private addError(error: Issue): void {
        this._errors.push(error.translate(this._jsonStringStartIndex));
    }

    private addErrorIf(error: Issue | undefined): void {
        if (error) {
            this.addError(error);
        }
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public visitFunctionCall(tleFunctionCall: FunctionCallValue): void {
        if (!tleFunctionCall.nameToken || !tleFunctionCall.name) {
            return;
        }

        const namespaceName = tleFunctionCall.namespace;
        const name = tleFunctionCall.name;

        if (tleFunctionCall.namespaceToken) {
            // Looking for a user namespace or user function (or any)
            if (namespaceName) {
                // It's a user-defined function call

                const userNamespaceDefinition: UserFunctionNamespaceDefinition | undefined = this._scope.getFunctionNamespaceDefinition(namespaceName);
                if (userNamespaceDefinition) {
                    // ... Namespace exists, add reference
                    this.addReference(userNamespaceDefinition, tleFunctionCall.namespaceToken.span);

                    const userFunctionDefinition: UserFunctionDefinition | undefined = this._scope.getUserFunctionDefinition(userNamespaceDefinition, name);
                    if (userFunctionDefinition) {
                        // ... User-defined function exists in namespace, add reference
                        this.addReference(userFunctionDefinition, tleFunctionCall.nameToken.span);

                        // Validate argument count
                        this.addErrorIf(validateUserFunctionCallArgCounts(tleFunctionCall, userNamespaceDefinition, userFunctionDefinition));
                    } else {
                        // Undefined user function error
                        this.addError(new UnrecognizedUserFunctionIssue(tleFunctionCall.nameToken.span, namespaceName, tleFunctionCall.name));
                    }
                } else {
                    // Undefined user namespace error
                    this.addError(new UnrecognizedUserNamespaceIssue(tleFunctionCall.namespaceToken.span, namespaceName));
                }
            }
        }

        // Searching for built-in function call (including parameter or variable reference)
        if (!namespaceName) {
            const metadata: BuiltinFunctionMetadata | undefined = this._functionsMetadata.findbyName(tleFunctionCall.name);
            this.addBuiltFunctionRefOrError(metadata, name, tleFunctionCall.nameToken);

            if (metadata) {
                // Validate argument count
                this.addErrorIf(validateBuiltInFunctionCallArgCounts(tleFunctionCall, metadata));

                switch (metadata.lowerCaseName) {
                    case templateKeys.parameters:
                        // ... parameter reference
                        this.addParameterRefOrError(tleFunctionCall);
                        break;

                    case templateKeys.variables:
                        // ... variable reference
                        this.addVariableRefOrError(tleFunctionCall);
                        break;

                    default:
                        // Any other built-in function call
                        break;
                }
            }
        }

        super.visitFunctionCall(tleFunctionCall);
    }

    private addBuiltFunctionRefOrError(metadata: BuiltinFunctionMetadata | undefined, functionName: string, functionNameToken: TLE.Token): void {
        if (metadata) {
            this.addReference(metadata, functionNameToken.span);
        } else {
            this.addErrorIf(new UnrecognizedBuiltinFunctionIssue(functionNameToken.span, functionName));
        }
    }

    private addVariableRefOrError(tleFunctionCall: TLE.FunctionCallValue): void {
        if (tleFunctionCall.argumentExpressions.length === 1) {
            const arg = tleFunctionCall.argumentExpressions[0];
            if (arg instanceof StringValue) {
                const argName = arg.toString();
                const varDefinition = this._scope.getVariableDefinition(argName);
                if (varDefinition) {
                    this.addReference(varDefinition, arg.unquotedSpan);
                } else {
                    if (this._scope.isInUserFunction) {
                        this.addError(new Issue(
                            arg.token.span,
                            "User functions cannot reference variables",
                            IssueKind.varInUdf
                        ));
                    } else {
                        this.addError(new Issue(
                            arg.token.span,
                            `Undefined variable reference: ${arg.quotedValue}`,
                            IssueKind.undefinedVar));
                    }
                }
            }
        }
    }

    private addParameterRefOrError(tleFunctionCall: TLE.FunctionCallValue): void {
        if (tleFunctionCall.argumentExpressions.length === 1) {
            const arg: TLE.Value | undefined = tleFunctionCall.argumentExpressions[0];
            if (arg instanceof StringValue) {
                const argName = arg.toString();
                const paramDefinition = this._scope.getParameterDefinition(argName);
                if (paramDefinition) {
                    this.addReference(paramDefinition, arg.unquotedSpan);
                } else {
                    this.addError(new Issue(
                        arg.token.span,
                        `Undefined parameter reference: ${arg.quotedValue}`,
                        IssueKind.undefinedParam));
                }
            }
        }
    }

    public static visit(
        scope: TemplateScope,
        jsonStringStartIndex: number,
        tleValue: Value | undefined,
        metadata: FunctionsMetadata,
        // Discovered references are added to this
        referenceListsMap: Map<INamedDefinition | undefined, Reference.ReferenceList>,
        // Discovered errors are added to this
        errors: Issue[]
    ): FindReferencesVisitor {
        const visitor = new FindReferencesVisitor(scope, jsonStringStartIndex, metadata, referenceListsMap, errors);

        if (tleValue) {
            tleValue.accept(visitor);
        }

        return visitor;
    }
}
