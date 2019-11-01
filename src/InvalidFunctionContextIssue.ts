// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as language from "./Language";

export class InvalidFunctionContextIssue extends language.Issue {
    constructor(span: language.Span, private _functionName: string, message: string) {
        super(span, `Cannot use '${_functionName}' in this context.`, language.IssueKind.badFuncContext);
    }

    public translate(movement: number): language.Issue {
        return new InvalidFunctionContextIssue(this.span.translate(movement), this.functionName, this.message);
    }

    public get functionName(): string {
        return this._functionName;
    }
}
