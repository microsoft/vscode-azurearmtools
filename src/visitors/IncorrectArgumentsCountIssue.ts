// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Issue } from "../language/Issue";
import { IssueKind } from "../language/IssueKind";
import { Span } from "../language/Span";

/**
 * An issue that was detected while parsing a deployment template.
 */
export class IncorrectArgumentsCountIssue extends Issue {
    constructor(
        span: Span,
        message: string,
        private _functionName: string,
        private _actualArgumentsCount: number,
        private _minExpectedCount: number,
        private _maxExpectedCount: number | undefined
    ) {
        super(span, message, IssueKind.badArgsCount);
    }

    public translate(movement: number): Issue {
        return new IncorrectArgumentsCountIssue(
            this.span.translate(movement),
            this.message,
            this.functionName,
            this.actual,
            this.minExpected,
            this.maxExpected);
    }

    public get functionName(): string {
        return this._functionName;
    }

    public get actual(): number {
        return this._actualArgumentsCount;
    }

    public get minExpected(): number {
        return this._minExpectedCount;
    }

    public get maxExpected(): number | undefined {
        return this._maxExpectedCount;
    }
}
