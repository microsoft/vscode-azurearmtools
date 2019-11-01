// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { TLE } from '../../extension.bundle';
import { assert } from '../fixed_assert';
import * as language from "../Language";
import { TemplateScope } from "../TemplateScope";
import { StringValue, Value } from '../TLE';

/**
 * A TLE visitor that finds references to undefined parameters or variables.
 */
export class UndefinedParameterAndVariableVisitor extends TLE.Visitor {
    private _errors: language.Issue[] = [];

    constructor(private _scope: TemplateScope) {
        super();

        assert(_scope);
    }

    public get errors(): language.Issue[] {
        return this._errors;
    }

    public visitString(tleString: StringValue): void {
        assert(tleString, "Cannot visit a null or undefined StringValue");

        const quotedStringValue: string = tleString.token.stringValue;

        if (tleString.isParametersArgument() && !this._scope.getParameterDefinition(quotedStringValue)) {
            this._errors.push(new language.Issue(
                tleString.token.span,
                `Undefined parameter reference: ${quotedStringValue}`,
                language.IssueKind.undefinedParam));
        }

        if (tleString.isVariablesArgument()) {
            if (!this._scope.getVariableDefinition(quotedStringValue)) {
                if (this._scope.isInUserFunction) {
                    this._errors.push(new language.Issue(
                        tleString.token.span,
                        "User functions cannot reference variables",
                        language.IssueKind.varInUdf
                    ));
                } else {
                    this._errors.push(new language.Issue(
                        tleString.token.span,
                        `Undefined variable reference: ${quotedStringValue}`,
                        language.IssueKind.undefinedVar));
                }
            }
        }
    }

    public static visit(tleValue: Value | null, scope: TemplateScope): UndefinedParameterAndVariableVisitor {
        const visitor = new UndefinedParameterAndVariableVisitor(scope);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
