// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { TLE } from '../../extension.bundle';
import { TemplateScope } from "../documents/templates/scopes/TemplateScope";
import { assert } from '../fixed_assert';
import { StringValue, Value } from '../language/expressions/TLE';
import { Issue } from '../language/Issue';
import { IssueKind } from '../language/IssueKind';

/**
 * A TLE visitor that finds references to undefined parameters or variables.
 */
export class UndefinedParameterAndVariableVisitor extends TLE.Visitor {
    private _errors: Issue[] = [];

    constructor(private _scope: TemplateScope) {
        super();

        assert(_scope);
    }

    public get errors(): Issue[] {
        return this._errors;
    }

    public visitString(tleString: StringValue): void {
        assert(tleString, "Cannot visit a null or undefined StringValue");

        const quotedStringValue: string = tleString.token.stringValue;

        if (tleString.isParametersArgument() && !this._scope.getParameterDefinition(quotedStringValue)) {
            this._errors.push(new Issue(
                tleString.token.span,
                `Undefined parameter reference: ${quotedStringValue}`,
                IssueKind.undefinedParam));
        }

        if (tleString.isVariablesArgument()) {
            if (!this._scope.getVariableDefinition(quotedStringValue)) {
                if (this._scope.isInUserFunction) {
                    this._errors.push(new Issue(
                        tleString.token.span,
                        "User functions cannot reference variables",
                        IssueKind.varInUdf
                    ));
                } else {
                    this._errors.push(new Issue(
                        tleString.token.span,
                        `Undefined variable reference: ${quotedStringValue}`,
                        IssueKind.undefinedVar));
                }
            }
        }
    }

    public static visit(tleValue: Value | undefined, scope: TemplateScope): UndefinedParameterAndVariableVisitor {
        const visitor = new UndefinedParameterAndVariableVisitor(scope);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
