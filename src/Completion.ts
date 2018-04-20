// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as language from "./Language";
import * as tle from "./TLE";

/**
 * A completion item in the list of completion suggestions that appear when a user invokes auto-completion (Ctrl + Space).
 */
export class Item {
    constructor(private _name: string, private _insertText: string, private _insertSpan: language.Span, private _detail: string, private _description: string, private _type: CompletionKind) {
    }

    public get name(): string {
        return this._name;
    }

    public get insertText(): string {
        return this._insertText;
    }

    public get insertSpan(): language.Span {
        return this._insertSpan;
    }

    public get detail(): string {
        return this._detail;
    }

    public get description(): string {
        return this._description;
    }

    public get kind(): CompletionKind {
        return this._type;
    }
}

export enum CompletionKind {
    Function,

    Parameter,

    Variable,

    Property
}
