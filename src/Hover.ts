// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable max-classes-per-file // Grandfathered in

import { IParameterDefinition } from "./IParameterDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import { getUserFunctionUsage } from "./signatureFormatting";
import { UserFunctionDefinition } from "./UserFunctionDefinition";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";

/**
 * The information that will be displayed when the cursor hovers over parts of a document.
 */
export abstract class Info {
    constructor(private readonly _span: language.Span) {
    }

    public abstract getHoverText(): string;

    public get span(): language.Span {
        return this._span;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.getHoverText();
    }
}

/**
 * The information that will be displayed when the cursor hovers over a TLE function.
 */
export class FunctionInfo extends Info {
    constructor(private _name: string, private _usage: string, private _description: string, _functionNameSpan: language.Span) {
        super(_functionNameSpan);
    }

    public getHoverText(): string {
        return `**${this._usage}**${(this._description ? `\n${this._description}` : ``)}`;
    }

    public get functionName(): string {
        return this._name;
    }
}

/**
 * The information that will be displayed when the cursor hovers over a user-defined TLE function.
 */
export class UserFunctionInfo extends Info {
    constructor(private _function: UserFunctionDefinition, _span: language.Span) {
        super(_span);
    }

    public getHoverText(): string {
        const usage: string = getUserFunctionUsage(this._function);
        return `**${usage}** User-defined function`;
    }
}

/**
 * The information that will be displayed when the cursor hovers over a user-defined namespace
 */
export class UserNamespaceInfo extends Info {
    constructor(private _namespace: UserFunctionNamespaceDefinition, _span: language.Span) {
        super(_span);
    }

    public getHoverText(): string {
        const ns = this._namespace.namespaceName.unquotedValue;
        const methodsUsage: string[] = this._namespace.members
            .map(md => getUserFunctionUsage(md, false));
        const summary = `**${ns}** User-defined namespace`;
        if (methodsUsage.length > 0) {
            return `${summary}\n\nMembers:\n${methodsUsage.map(mu => `* ${mu}`).join("\n")}`;
        } else {
            return `${summary}\n\nNo members`;
        }
    }
}

/**
 * The information that will be displayed when the cursor hovers over a TLE parameter reference.
 */
export class ParameterReferenceInfo extends Info {
    constructor(private _name: string, private _description: string | null, _parameterNameSpan: language.Span) {
        super(_parameterNameSpan);
    }

    public static fromDefinition(definition: IParameterDefinition, parameterNameSpan: language.Span): ParameterReferenceInfo {
        return new ParameterReferenceInfo(definition.name.unquotedValue, definition.description, parameterNameSpan);
    }

    public getHoverText(): string {
        return `**${this._name}** (parameter)${(this._description ? `\n${this._description}` : "")}`;
    }
}

/**
 * The information that will be displayed when the cursor hovers over a TLE variable reference.
 */
export class VariableReferenceInfo extends Info {
    constructor(private _name: string, _variableNameSpan: language.Span) {
        super(_variableNameSpan);
    }

    public static fromDefinition(definition: Json.Property, variableNameSpan: language.Span): VariableReferenceInfo {
        return new VariableReferenceInfo(definition.name.unquotedValue, variableNameSpan);
    }

    public getHoverText(): string {
        return `**${this._name}** (variable)`;
    }
}
