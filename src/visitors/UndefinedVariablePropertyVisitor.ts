// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as Json from '../JSON';
import * as language from "../Language";
import { TemplateScope } from "../TemplateScope";
import { FunctionCallValue, PropertyAccess, Value, Visitor } from "../TLE";
import { IVariableDefinition } from '../VariableDefinition';

/**
 * A TLE visitor that finds references to variable properties that aren't defined in the variable's value
 */
export class UndefinedVariablePropertyVisitor extends Visitor {
    private _errors: language.Issue[] = [];
    constructor(private _scope: TemplateScope) {
        super();
    }
    public get errors(): language.Issue[] {
        return this._errors;
    }
    public visitPropertyAccess(tlePropertyAccess: PropertyAccess): void {
        if (tlePropertyAccess.nameToken) {
            const functionSource: FunctionCallValue | null = tlePropertyAccess.functionSource;
            if (functionSource) {
                // Get the definition for the variable that's being referenced via a variables('v') call
                const variableProperty: IVariableDefinition | null = this._scope.getVariableDefinitionFromFunctionCall(functionSource);
                if (variableProperty) {
                    const variableDefinition: Json.ObjectValue | null = Json.asObjectValue(variableProperty.value);
                    const sourcesNameStack: string[] = tlePropertyAccess.sourcesNameStack;
                    if (variableDefinition) {
                        const sourcePropertyDefinition: Json.ObjectValue | null = Json.asObjectValue(variableDefinition.getPropertyValueFromStack(sourcesNameStack));
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
        this._errors.push(new language.Issue(
            span,
            `Property "${propertyName}" is not a defined property of "${sourceString}".`,
            language.IssueKind.undefinedVarProp));
    }
    public static visit(tleValue: Value | null, scope: TemplateScope): UndefinedVariablePropertyVisitor {
        const visitor = new UndefinedVariablePropertyVisitor(scope);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
