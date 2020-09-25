// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { nonNullValue } from "../util/nonNull";

export class LineColPos {
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
