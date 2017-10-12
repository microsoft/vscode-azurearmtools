// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as language from "./Language";

/**
 * The information that will be displayed when the cursor hovers over parts of a document.
 */
export abstract class Info {
    constructor(private _span: language.Span) {
    }

    public abstract getHoverText(): string;

    public get span(): language.Span {
        return this._span;
    }
}

/**
 * The information that will be displayed when the cursor hovers over a TLE function.
 */
export class FunctionInfo extends Info {
    constructor(private _name: string, private _usage: string, private _description: string, private _functionNameSpan: language.Span) {
        super(_functionNameSpan);
    }

    public getHoverText(): string {
        return `**${this._usage}**` + (this._description ? `\n${this._description}` : ``);
    }

    public get functionName(): string {
        return this._name;
    }
}

/**
 * The information that will be displayed when the cursor hovers over a TLE parameter reference.
 */
export class ParameterReferenceInfo extends Info {
    constructor(private _name: string, private _description: string, private _parameterNameSpan: language.Span) {
        super(_parameterNameSpan);
    }

    public getHoverText(): string {
        return `**${this._name}** (parameter)` + (this._description ? `\n${this._description}` : "");
    }
}

/**
 * The information that will be displayed when the cursor hovers over a TLE variable reference.
 */
export class VariableReferenceInfo extends Info {
    constructor(private _name: string, private _variableNameSpan: language.Span) {
        super(_variableNameSpan);
    }

    public getHoverText(): string {
        return `**${this._name}** (variable)`;
    }
}