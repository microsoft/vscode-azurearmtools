// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Issue } from "../language/Issue";
import { IssueKind } from "../language/IssueKind";
import { Span } from "../language/Span";

export class InvalidFunctionContextIssue extends Issue {
    constructor(span: Span, private _functionName: string, message: string) {
        super(span, `Cannot use '${_functionName}' in this context.`, IssueKind.badFuncContext);
    }

    public translate(movement: number): Issue {
        return new InvalidFunctionContextIssue(this.span.translate(movement), this.functionName, this.message);
    }

    public get functionName(): string {
        return this._functionName;
    }
}
