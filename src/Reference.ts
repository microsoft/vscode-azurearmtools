// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from "./fixed_assert";
import * as language from "./Language";

/**
 * A list of references that have been found.
 */
export class List {
    constructor(private _type: ReferenceKind, private _spans: language.Span[] = []) {
        assert(_type !== null, "Cannot create a reference list a null type.");
        assert(_type !== undefined, "Cannot create a reference list an undefined type.");
        assert(_spans, "Cannot create a reference list with a null spans array.");
    }

    public get length(): number {
        return this._spans.length;
    }

    public get spans(): language.Span[] {
        return this._spans;
    }

    public get kind(): ReferenceKind {
        return this._type;
    }

    public add(span: language.Span): void {
        assert(span);

        this._spans.push(span);
    }

    public addAll(list: List): void {
        assert(list, "Cannot add all of the references from a null or undefined list.");
        assert.deepStrictEqual(this._type, list.kind, "Cannot add references from a list of a different reference type.");

        for (const span of list.spans) {
            this.add(span);
        }
    }

    public translate(movement: number): List {
        assert(movement !== null, "Cannot translate a reference list by a null amount.");
        assert(movement !== undefined, "Cannot translate a reference list by an undefined amount.");

        const result = new List(this._type);

        for (const span of this._spans) {
            result.add(span.translate(movement));
        }

        return result;
    }
}

export enum ReferenceKind {
    Parameter = 1,
    Variable
}
