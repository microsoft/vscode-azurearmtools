// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { assertNever } from "./util/assertNever";
import { nonNullValue } from "./util/nonNull";

/**
 * Determine if the provided index is contained by this span.
 *
 * If this span started at 3 and had a length of 4, i.e. [3, 7), then all
 * indexes between 3 and 6 (inclusive) would be contained. 2 and 7 would
 * not be contained.
 *
 * If includeAfterEndIndex=true, then 3-7 inclusive would be contained.
 */
export enum Contains {
    /* If this span starts at 3 and has a length of 10, i.e. [3, 13), then all
     * indices between 3 and 13 (inclusive) would be contained. 2 and 14 would
     * not be contained.
     *
     * Example: "{}"
     *   index 0: {
     *   index 1: }
     *   index 2: EOF
     *
     *   contains(0, ContainsType.strict): true
     *   contains(1, ContainsType.strict): true
     *   contains(2, ContainsType.strict): false
     */
    strict = 0,

    /* If this span starts at 3 and has a length of 10, i.e. [3, 13), then all
     * indices between 3 and 10+1 (inclusive) would be contained. 2 and 12 would
     * not be contained.
     *
     * Example: "{}"
     *   index 0: {
     *   index 1: }
     *   index 2: EOF
     *
     *   contains(0, ContainsType.strict): true
     *   contains(1, ContainsType.strict): true
     *   contains(2, ContainsType.strict): true
     */
    extended = 1,

    /* If this span starts at 3 and has a length of 10, i.e. [3, 13), then all
     * indices between 3+1 and 10 (inclusive) would be contained. 3 and 11 would
     * not be contained.
     *
     * Example: "{}"
     *   index 0: {
     *   index 1: }
     *   index 2: EOF
     *
     *   contains(0, ContainsType.strict): false
     *   contains(1, ContainsType.strict): true
     *   contains(2, ContainsType.strict): false
     *
     * This answers the question of whether a point is enclosed by an object
     */
    enclosed = 2
}

// tslint:disable-next-line:no-suspicious-comment
// TODO: Move Span to separate file
/**
 * A span representing the character indexes that are contained by a JSONToken.
 */
export class Span {
    constructor(private _startIndex: number, private _length: number) {
    }

    /**
     * Get the start index of this span.
     */
    public get startIndex(): number {
        return this._startIndex;
    }

    /**
     * Get the length of this span.
     */
    public get length(): number {
        return this._length;
    }

    /**
     * Get the last index of this span.
     */
    public get endIndex(): number {
        return this._startIndex + (this._length > 0 ? this._length - 1 : 0);
    }

    /**
     * Get the index directly after this span.
     *
     * If this span started at 3 and had a length of 4 ([3,7)), then the after
     * end index would be 7.
     */
    public get afterEndIndex(): number {
        return this._startIndex + this._length;
    }

    public contains(index: number, containsBehavior: Contains): boolean {
        switch (containsBehavior) {
            case Contains.strict:
                return this._startIndex <= index && index <= this.endIndex;

            case Contains.extended:
                return this._startIndex <= index && index <= this.afterEndIndex;

            case Contains.enclosed:
                return this._startIndex + 1 <= index && index <= this.endIndex;

            default:
                assertNever(containsBehavior);
        }
    }

    /**
     * Create a new span that is a union of this Span and the provided Span.
     * If the provided Span is undefined, then this Span will be returned.
     */
    public union(rhs: Span | undefined): Span {
        let result: Span;
        if (!!rhs) {
            let minStart = Math.min(this.startIndex, rhs.startIndex);
            let maxAfterEndIndex = Math.max(this.afterEndIndex, rhs.afterEndIndex);
            result = new Span(minStart, maxAfterEndIndex - minStart);
        } else {
            result = this;
        }
        return result;
    }

    /**
     * Create a new span that is a union of the given spans.
     * If both are undefined, undefined will be returned
     */
    public static union(lhs: Span | undefined, rhs: Span | undefined): Span | undefined {
        if (lhs) {
            return lhs.union(rhs);
        } else if (rhs) {
            return rhs;
        } else {
            return undefined;
        }
    }

    /**
     * Create a new span that is the intersection of this and a given span.
     * If the provided span is undefined, or they do no intersect, undefined will be returned
     */
    public intersect(rhs: Span | undefined): Span | undefined {
        if (!!rhs) {
            // tslint:disable-next-line:no-this-assignment
            let lhs: Span = this;
            if (rhs.startIndex < this.startIndex) {
                [lhs, rhs] = [rhs, lhs];
            }

            if (lhs.endIndex <= rhs.startIndex) {
                return new Span(rhs.startIndex, lhs.endIndex);
            }
        }

        return undefined;
    }

    /** asdf test
     * Create a new span that is the intersection of the given spans.
     * If either is undefined, or they do no intersect, undefined will be returned
     */
    public static intersect(lhs: Span | undefined, rhs: Span | undefined): Span | undefined {
        if (lhs) {
            return lhs.intersect(rhs);
        } else {
            return undefined;
        }
    }

    public translate(movement: number): Span {
        return movement === 0 ? this : new Span(this._startIndex + movement, this._length);
    }

    public toString(): string {
        return `[${this.startIndex}, ${this.afterEndIndex})`;
    }

    public extendLeft(extendLeft: number): Span {
        return new Span(this.startIndex - extendLeft, this.length + extendLeft);
    }

    public extendRight(extendRight: number): Span {
        return new Span(this.startIndex, this.length + extendRight);
    }
}

export class Position {
    constructor(private _line: number, private _column: number) {
        nonNullValue(_line, "_line");
        assert(_line >= 0, "_line cannot be less than 0");
        nonNullValue(_column, "_column");
        assert(_column >= 0, "_column cannot be less than 0");
    }

    public get line(): number {
        return this._line;
    }

    public get column(): number {
        return this._column;
    }

    public toFriendlyString(): string {
        return `[${this._line + 1}:${this._column + 1}]`;
    }
}

export enum IssueKind {
    tleSyntax = "tleSyntax",
    referenceInVar = "referenceInVar",
    unusedVar = "unusedVar",
    unusedParam = "unusedParam",
    unusedUdfParam = "unusedUdfParam",
    unusedUdf = "unusedUdf",
    badArgsCount = "badArgsCount",
    badFuncContext = "badFuncContext",
    undefinedFunc = "undefinedFunc",
    undefinedNs = "undefinedNs",
    undefinedUdf = "undefinedUdf",
    undefinedParam = "undefinedParam",
    undefinedVar = "undefinedVar",
    varInUdf = "varInUdf",
    undefinedVarProp = "undefinedVarProp"
}

/**
 * An issue that was detected while parsing a deployment template.
 */
export class Issue {
    constructor(private _span: Span, private _message: string, public kind: IssueKind) {
        nonNullValue(_span, "_span");
        assert(1 <= _span.length, "_span's length must be greater than or equal to 1.");
        nonNullValue(_message, "_message");
        assert(_message !== "", "_message must not be empty.");
    }

    public get span(): Span {
        return this._span;
    }

    public get message(): string {
        return this._message;
    }

    public translate(movement: number): Issue {
        return new Issue(this._span.translate(movement), this._message, this.kind);
    }
}
