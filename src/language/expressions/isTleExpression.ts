// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export function isTleExpression(unquotedStringValue: string): boolean {
    // An expression must start with '[' (no whitespace before),
    //   not start with '[[', and end with ']' (no whitespace after)
    return !!unquotedStringValue.match(/^\[(?!\[).*\]$/);
}
