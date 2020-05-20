// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Language } from "../../extension.bundle";
import { BuiltinFunctionMetadata, FunctionsMetadata } from "../AzureRMAssets";
import { templateKeys } from "../constants";
import { DeploymentDocument } from "../DeploymentDocument";
import { assert } from '../fixed_assert';
import { DefinitionKind, INamedDefinition } from "../INamedDefinition";
import * as Reference from "../ReferenceList";
import { FunctionCallValue, StringValue, Value, Visitor } from "../TLE";
import { UserFunctionDefinition } from "../UserFunctionDefinition";
import { UserFunctionNamespaceDefinition } from "../UserFunctionNamespaceDefinition";
import { assertNever } from "../util/assertNever";

/**
 * A TLE visitor that searches a TLE value tree looking for references to the provided definition
 */
export class FindReferencesVisitor extends Visitor {
    private _references: Reference.ReferenceList;
    private _lowerCasedFullName: string;

    constructor(
        private readonly _document: DeploymentDocument,
        private readonly _definition: INamedDefinition,
        private readonly _functionsMetadata: FunctionsMetadata
    ) {
        super();
        this._references = new Reference.ReferenceList(_definition.definitionKind);

        if (_definition instanceof BuiltinFunctionMetadata) {
            this._lowerCasedFullName = _definition.lowerCaseName;
        } else {
            assert(_definition.nameValue);
            // tslint:disable-next-line: no-non-null-assertion // Asserted
            this._lowerCasedFullName = _definition.nameValue!.unquotedValue.toLowerCase();
        }
    }

    public get references(): Reference.ReferenceList {
        return this._references;
    }

    private addReference(span: Language.Span): void {
        this._references.add({
            document: this._document,
            span: span
        });
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public visitFunctionCall(tleFunction: FunctionCallValue): void {
        switch (this._definition.definitionKind) {
            case DefinitionKind.UserFunction:
                if (tleFunction.nameToken && tleFunction.name && tleFunction.namespace) {
                    const userFunctionDefinition: UserFunctionDefinition | undefined = tleFunction.scope.getUserFunctionDefinition(tleFunction.namespace, tleFunction.name);
                    if (userFunctionDefinition === this._definition) {
                        this.addReference(tleFunction.nameToken.span);
                    }
                }
                break;

            case DefinitionKind.Namespace:
                if (tleFunction.namespaceToken && tleFunction.namespace) {
                    const userNamespaceDefinition: UserFunctionNamespaceDefinition | undefined = tleFunction.scope.getFunctionNamespaceDefinition(tleFunction.namespace);
                    if (userNamespaceDefinition === this._definition) {
                        this.addReference(tleFunction.namespaceToken.span);
                    }
                }
                break;

            case DefinitionKind.BuiltinFunction:
                if (tleFunction.name && tleFunction.nameToken && !tleFunction.namespaceToken) {
                    const metadata: BuiltinFunctionMetadata | undefined = this._functionsMetadata.findbyName(tleFunction.name);
                    if (this._definition instanceof BuiltinFunctionMetadata) {
                        // Metadata is not guaranteed to be the same each call, so compare name instead of definition
                        if (metadata && metadata.lowerCaseName === this._lowerCasedFullName) {
                            this.addReference(tleFunction.nameToken.span);
                        }
                    } else {
                        assert(false, "Expected reference definition to be BuiltinFunctionMetadata");
                    }
                }
                break;

            case DefinitionKind.Parameter:
                if (tleFunction.isCallToBuiltinWithName(templateKeys.parameters)) {
                    if (tleFunction.argumentExpressions.length === 1) {
                        const arg = tleFunction.argumentExpressions[0];
                        if (arg instanceof StringValue) {
                            const argName = arg.toString();
                            const paramDefinition = tleFunction.scope.getParameterDefinition(argName);
                            if (paramDefinition === this._definition) {
                                this.addReference(arg.unquotedSpan);
                            }
                        }
                    }
                }
                break;

            case DefinitionKind.Variable:
                if (tleFunction.isCallToBuiltinWithName(templateKeys.variables)) {
                    if (tleFunction.argumentExpressions.length === 1) {
                        const arg = tleFunction.argumentExpressions[0];
                        if (arg instanceof StringValue) {
                            const argName = arg.toString();
                            const varDefinition = tleFunction.scope.getVariableDefinition(argName);
                            if (varDefinition === this._definition) {
                                this.addReference(arg.unquotedSpan);
                            }
                        }
                    }
                }
                break;

            case DefinitionKind.ParameterValue:
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: To implement
                break;

            default:
                assertNever(this._definition.definitionKind);
        }

        super.visitFunctionCall(tleFunction);
    }

    public static visit(document: DeploymentDocument, tleValue: Value | undefined, definition: INamedDefinition, metadata: FunctionsMetadata): FindReferencesVisitor {
        const visitor = new FindReferencesVisitor(document, definition, metadata);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
