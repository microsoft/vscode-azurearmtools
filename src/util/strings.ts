// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from "../fixed_assert";

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
    if (!value) {
        return "";
    }

    if (value.startsWith("\"")) {
        return value.endsWith("\"") ? value.slice(1, value.length - 1) : value.slice(1);
    } else if (value.startsWith("'")) {
        return value.endsWith("'") ? value.slice(1, value.length - 1) : value.slice(1);
    }

    return value;
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
