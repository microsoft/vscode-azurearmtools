import { assert } from "./fixed_assert";

// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/**
 * Create a deep copy of the provided value.
 */
export function clone<T extends {}>(value: T): T {
    let result: unknown;

    if (value === null ||
        value === undefined ||
        typeof value === "boolean" ||
        typeof value === "number" ||
        typeof value === "string") {
        result = value;
    } else if (value instanceof Array) {
        result = [];
        // tslint:disable-next-line:forin no-for-in // Grandfathered in
        for (let index in value) {
            (<unknown[]>result)[index] = clone(value[index]);
        }
    } else {
        result = {};
        // tslint:disable-next-line:no-for-in // Grandfathered in
        for (let propertyName in value) {
            // tslint:disable-next-line: no-unsafe-any no-any
            if (value.hasOwnProperty(propertyName)) {
                (<{ [key: string]: unknown }>result)[propertyName] = clone(value[propertyName]);
            }
        }
    }

    return <T>result;
}

export function isWhitespaceCharacter(character: string): boolean {
    return character === " " ||
        character === "\t" ||
        character === "\n" ||
        character === "\r";
}

export function isQuoteCharacter(character: string): boolean {
    return character === "'" ||
        character === "\"";
}

export function isDigit(character: string): boolean {
    return character ? "0" <= character && character <= "9" : false;
}

export function isLetter(character: string): boolean {
    return character ? ("A" <= character && character <= "Z") || ("a" <= character && character <= "z") : false;
}

export function unquote(value: string): string {
    let result = value;

    if (result) {
        if (isQuoteCharacter(result[0])) {
            result = result.substr(1);
        }
        if (result && isQuoteCharacter(result[result.length - 1])) {
            result = result.substr(0, result.length - 1);
        }
    }

    return result;
}

export function quote(value: string | undefined | null): string {
    let result: string;

    if (value === null) {
        result = "null";
    } else if (value === undefined) {
        result = "undefined";
    } else {
        result = `"${value}"`;
    }

    return result;
}

export function escape(value: string | undefined | null): string | undefined | null {
    let result: string | undefined | null;

    if (value) {
        result = "";
        for (const c of value) {
            switch (c) {
                case "\b":
                    result += "\\b";
                    break;

                case "\f":
                    result += "\\f";
                    break;

                case "\n":
                    result += "\\n";
                    break;

                case "\r":
                    result += "\\r";
                    break;

                case "\t":
                    result += "\\t";
                    break;

                case "\v":
                    result += "\\v";
                    break;

                default:
                    result += c;
                    break;
            }
        }
    } else {
        result = value;
    }

    return result;
}

export function escapeAndQuote(value: string | undefined | null): string {
    return quote(escape(value));
}

/**
 * Get the combined length of the provided values.
 */
export function getCombinedLength(values: { length(): number }[]): number {
    let result: number = 0;
    assert(values);
    for (const value of values) {
        result += value.length();
    }
    return result;
}

/**
 * Get the combined text of the provided values.
 */
export function getCombinedText(values: { toString(): string }[]): string {
    let result: string = "";
    assert(values);
    for (const value of values) {
        result += value.toString();
    }
    return result;
}

/**
 * An interface for an object that iterates through a sequence of values.
 */
export interface Iterator<T> {
    /**
     * Get whether or not this iterator has started iterating.
     */
    hasStarted(): boolean;

    /**
     * Get the iterator's current value, or undefined if the iterator doesn't have a current value.
     */
    current(): T | undefined;

    /**
     * Move this iterator to the next value in its sequnce. Return whether or not the iterator has a
     * current value after the move.
     */
    moveNext(): boolean;
}
