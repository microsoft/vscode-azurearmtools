// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/**
 * Provides a debug display of a position inside of a string - inserts the given text at the given position,
 * and truncates the beginning and end of a long string.
 */
// tslint:disable-next-line:function-name
export function __debugMarkPositionInString(
    text: string,
    position: number,
    insertTextAtPosition: string = '<CURSOR>',
    charactersBeforePosition: number = 70,
    charactersAfterPosition: number = 70
): string {
    if (position >= text.length) {
        const textAtEnd = `${text.slice(text.length - charactersAfterPosition)}<END(${text.length})>`;
        return `${textAtEnd}...<CURSOR=${position}>`;
    }
    const preTextIndex = position - charactersBeforePosition;
    const preText = `${(preTextIndex > 0 ? "..." : "")}${text.slice(preTextIndex >= 0 ? preTextIndex : 0, position)}`;

    const postStart = position;
    const postTextIndex = text.slice(postStart, postStart + charactersAfterPosition) + (postStart > charactersAfterPosition ? "..." : "");

    return `${preText}${insertTextAtPosition}${postTextIndex}`;
}

/**
 * Same as __debugMarkPositionInString, but specifying a range instead of a position
 */
// tslint:disable-next-line:function-name
export function __debugMarkRangeInString(
    text: string,
    position: number,
    length: number,
    leftMarker: string = "<<",
    rightMarker: string = ">>",
    charactersBeforePosition: number = 25,
    charactersAfterPosition: number = 50
): string {
    if (position >= text.length) {
        return __debugMarkPositionInString(text, position, leftMarker + rightMarker, charactersBeforePosition, charactersAfterPosition);
    }
    const preTextIndex = position - charactersBeforePosition;
    const preText = `${(preTextIndex > 0 ? "..." : "")}${text.slice(preTextIndex >= 0 ? preTextIndex : 0, position)}`;

    const postTextIndex = position + length;
    const postText = text.slice(postTextIndex, postTextIndex + charactersAfterPosition) + (postTextIndex > charactersAfterPosition ? "..." : "");

    return `${preText}${leftMarker}${text.slice(position, position + length)}${rightMarker}${postText}`;
}
