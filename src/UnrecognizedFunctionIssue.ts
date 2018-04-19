// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as language from "./Language";

/**
 * An issue that was detected while parsing a deployment template.
 */
export class UnrecognizedFunctionIssue extends language.Issue {
    constructor(span: language.Span, private _functionName: string) {
        super(span, `Unrecognized function name '${_functionName}'.`);
    }

    public translate(movement: number): language.Issue {
        return new UnrecognizedFunctionIssue(this.span.translate(movement), this.functionName);
    }

    public get functionName(): string {
        return this._functionName;
    }
}
