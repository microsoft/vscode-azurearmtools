// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as language from "./Language";

/**
 * An issue that was detected while parsing a deployment template.
 */
export class IncorrectArgumentsCountIssue extends language.Issue {
    constructor(
        span: language.Span,
        message: string,
        private _functionName: string,
        private _actualArgumentsCount: number,
        private _minExpectedCount: number,
        private _maxExpectedCount: number
    ) {
        super(span, message);
    }

    public translate(movement: number): language.Issue {
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

    public get maxExpected(): number {
        return this._maxExpectedCount;
    }
}
