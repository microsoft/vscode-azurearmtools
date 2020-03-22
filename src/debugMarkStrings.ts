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
    charactersBeforeIndex: number = 45,
    charactersAfterPosition: number = 50
): string {
    const preTextIndex = position - charactersBeforeIndex;
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
    charactersBeforeIndex: number = 25,
    charactersAfterPosition: number = 50
): string {
    const preTextIndex = position - charactersBeforeIndex;
    const preText = `${(preTextIndex > 0 ? "..." : "")}${text.slice(preTextIndex >= 0 ? preTextIndex : 0, position)}`;

    const postTextIndex = position + length;
    const postText = text.slice(postTextIndex, postTextIndex + charactersAfterPosition) + (postTextIndex > charactersAfterPosition ? "..." : "");

    return `${preText}${leftMarker}${text.slice(position, position + length)}${rightMarker}${postText}`;
}
