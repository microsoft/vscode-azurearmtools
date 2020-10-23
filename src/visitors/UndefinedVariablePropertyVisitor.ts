// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { TemplateScope } from "../documents/templates/scopes/TemplateScope";
import { IVariableDefinition } from '../documents/templates/VariableDefinition';
import { FunctionCallValue, PropertyAccess, TleVisitor, Value } from "../language/expressions/TLE";
import { Issue } from "../language/Issue";
import { IssueKind } from "../language/IssueKind";
import * as Json from '../language/json/JSON';

/**
 * A TLE visitor that finds references to variable properties that aren't defined in the variable's value
 */
export class UndefinedVariablePropertyVisitor extends TleVisitor {
    private _errors: Issue[] = [];
    constructor(private _scope: TemplateScope) {
        super();
    }
    public get errors(): Issue[] {
        return this._errors;
    }
    public visitPropertyAccess(tlePropertyAccess: PropertyAccess): void {
        if (tlePropertyAccess.nameToken) {
            const functionSource: FunctionCallValue | undefined = tlePropertyAccess.functionSource;
            if (functionSource) {
                // Get the definition for the variable that's being referenced via a variables('v') call
                const variableProperty: IVariableDefinition | undefined = this._scope.getVariableDefinitionFromFunctionCall(functionSource);
                if (variableProperty) {
                    const variableDefinition: Json.ObjectValue | undefined = Json.asObjectValue(variableProperty.value);
                    const sourcesNameStack: string[] = tlePropertyAccess.sourcesNameStack;
                    if (variableDefinition) {
                        const sourcePropertyDefinition: Json.ObjectValue | undefined = Json.asObjectValue(variableDefinition.getPropertyValueFromStack(sourcesNameStack));
                        if (sourcePropertyDefinition && !sourcePropertyDefinition.hasProperty(tlePropertyAccess.nameToken.stringValue)) {
                            this.addIssue(tlePropertyAccess);
                        }
                    } else if (sourcesNameStack.length === 0) {
                        this.addIssue(tlePropertyAccess);
                    }
                }
            }
        }
        super.visitPropertyAccess(tlePropertyAccess);
    }
    private addIssue(tlePropertyAccess: PropertyAccess): void {
        const nameToken = tlePropertyAccess.nameToken;
        const propertyName: string = nameToken ? nameToken.stringValue : "(unknown)";
        const sourceString: string = tlePropertyAccess.source.toString();
        const span = nameToken ? nameToken.span : tlePropertyAccess.getSpan();
        this._errors.push(new Issue(
            span,
            `Property "${propertyName}" is not a defined property of "${sourceString}".`,
            IssueKind.undefinedVarProp));
    }
    public static visit(tleValue: Value | undefined, scope: TemplateScope): UndefinedVariablePropertyVisitor {
        const visitor = new UndefinedVariablePropertyVisitor(scope);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
