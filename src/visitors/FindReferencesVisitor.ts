// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { templateKeys } from "../constants";
import { DeploymentDocument } from "../documents/DeploymentDocument";
import { TemplateScope } from "../documents/templates/scopes/TemplateScope";
import { UserFunctionDefinition } from "../documents/templates/UserFunctionDefinition";
import { UserFunctionNamespaceDefinition } from "../documents/templates/UserFunctionNamespaceDefinition";
import { BuiltinFunctionMetadata, FunctionsMetadata } from "../language/expressions/AzureRMAssets";
import { FunctionCallValue, StringValue, TleVisitor, Value } from "../language/expressions/TLE";
import { INamedDefinition } from "../language/INamedDefinition";
import * as Reference from "../language/ReferenceList";
import { Span } from "../language/Span";

/**
 * Finds all references to all definitions inside a JSON string
 */
export class FindReferencesVisitor extends TleVisitor {
    constructor(
        private readonly _document: DeploymentDocument,
        private readonly _scope: TemplateScope,
        private readonly _jsonStringStartIndex: number,
        private readonly _functionsMetadata: FunctionsMetadata, // Filled in with the results
        private readonly _referenceListsMap: Map<INamedDefinition, Reference.ReferenceList>
    ) {
        super();

        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Implement searching for DefinitionKind.ParameterValue
    }

    private addReference(definition: INamedDefinition | undefined, span: Span): void {
        if (definition) {
            let list = this._referenceListsMap.get(definition);
            if (!list) {
                list = new Reference.ReferenceList(definition.definitionKind);
                this._referenceListsMap.set(definition, list);
            }

            list.add({
                document: this._document,
                span: span.translate(this._jsonStringStartIndex)
            });
        }
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public visitFunctionCall(tleFunctionCall: FunctionCallValue): void {
        if (!tleFunctionCall.nameToken || !tleFunctionCall.name) {
            return;
        }

        const namespace = tleFunctionCall.namespace;

        if (tleFunctionCall.namespaceToken) {
            // Looking for a user namespace or user function (or any)
            if (namespace) {
                // It's a user-defined function call

                // ... Add reference to the namespace
                const userNamespaceDefinition: UserFunctionNamespaceDefinition | undefined = this._scope.getFunctionNamespaceDefinition(namespace);
                if (userNamespaceDefinition) {
                    this.addReference(userNamespaceDefinition, tleFunctionCall.namespaceToken.span);

                    // ... Add reference to the user function
                    const userFunctionDefinition: UserFunctionDefinition | undefined = this._scope.getUserFunctionDefinition(userNamespaceDefinition, tleFunctionCall.name);
                    this.addReference(userFunctionDefinition, tleFunctionCall.nameToken.span);
                }
            }
        }

        // Searching for built-in function call (including parameter or variable reference)
        if (!namespace) {
            const metadata: BuiltinFunctionMetadata | undefined = this._functionsMetadata.findbyName(tleFunctionCall.name);
            switch (metadata?.lowerCaseName) {
                case templateKeys.parameters:
                    // ... parameter reference
                    if (tleFunctionCall.argumentExpressions.length === 1) {
                        const arg = tleFunctionCall.argumentExpressions[0];
                        if (arg instanceof StringValue) {
                            const argName = arg.toString();
                            const paramDefinition = this._scope.getParameterDefinition(argName);
                            this.addReference(paramDefinition, arg.unquotedSpan);
                        }
                    }
                    break;

                case templateKeys.variables:
                    // ... variable reference
                    if (tleFunctionCall.argumentExpressions.length === 1) {
                        const arg = tleFunctionCall.argumentExpressions[0];
                        if (arg instanceof StringValue) {
                            const argName = arg.toString();
                            const varDefinition = this._scope.getVariableDefinition(argName);
                            this.addReference(varDefinition, arg.unquotedSpan);
                        }
                    }
                    break;

                default:
                    // Any other built-in function call
                    this.addReference(metadata, tleFunctionCall.nameToken.span);
                    break;
            }
        }

        super.visitFunctionCall(tleFunctionCall);
    }

    public static visit(
        document: DeploymentDocument,
        scope: TemplateScope,
        jsonStringStartIndex: number,
        tleValue: Value | undefined,
        metadata: FunctionsMetadata,
        referenceListsMap: Map<INamedDefinition, Reference.ReferenceList> // Filled in with the results
    ): FindReferencesVisitor {
        const visitor = new FindReferencesVisitor(document, scope, jsonStringStartIndex, metadata, referenceListsMap);

        if (tleValue) {
            tleValue.accept(visitor);
        }

        return visitor;
    }
}
