// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { assertNever } from "../util/assertNever";

export enum ContainsBehavior {
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

/**
 * A span representing the character indexes that are contained by a JSONToken.
 */
export class Span {
    public static readonly empty: Span = new Span(0, 0);

    constructor(private _startIndex: number, private _length: number) {
    }

    public static fromStartAndAfterEnd(startIndex: number, afterEndIndex: number): Span {
        return new Span(startIndex, afterEndIndex - startIndex);
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

    /**
     * Determine if the provided index is contained by this span.
     *
     * If this span started at 3 and had a length of 4, i.e. [3, 7), then all
     * indexes between 3 and 6 (inclusive) would be contained. 2 and 7 would
     * not be contained.
     *
     * If includeAfterEndIndex=true, then 3-7 inclusive would be contained.
     */
    public contains(index: number, containsBehavior: ContainsBehavior): boolean {
        switch (containsBehavior) {
            case ContainsBehavior.strict:
                return this._startIndex <= index && index <= this.endIndex;

            case ContainsBehavior.extended:
                return this._startIndex <= index && index <= this.afterEndIndex;

            case ContainsBehavior.enclosed:
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
        if (rhs) {
            const minStart = Math.min(this.startIndex, rhs.startIndex);
            const maxAfterEndIndex = Math.max(this.afterEndIndex, rhs.afterEndIndex);
            return new Span(minStart, maxAfterEndIndex - minStart);
        } else {
            return this;
        }
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
        if (rhs) {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            let lhs: Span = this;
            if (rhs.startIndex < this.startIndex) {
                [lhs, rhs] = [rhs, lhs];
            }

            // if (lhs.endIndex < rhs.startIndex) {
            //     return undefined;
            // }
            const start = rhs.startIndex;
            const afterEnd = (lhs.afterEndIndex < rhs.afterEndIndex) ? lhs.afterEndIndex : rhs.afterEndIndex;

            if (afterEnd >= start) {
                return new Span(start, afterEnd - start);
            } else {
                return undefined;
            }
        }

        return undefined;
    }

    /**
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

    public getText(text: string, offsetIndex?: number): string {
        const start = this.startIndex + (offsetIndex ?? 0);
        return text.slice(
            start,
            start + this.length);
    }
}
