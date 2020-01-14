// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from "./fixed_assert";
import { DefinitionKind } from "./INamedDefinition";
import * as language from "./Language";
import { nonNullValue } from "./util/nonNull";

/**
 * A list of references that have been found.
 */
export class ReferenceList {
    constructor(private _type: DefinitionKind, private _spans: language.Span[] = []) {
        nonNullValue(_type, "_type");
        nonNullValue(_spans, "_spans");
    }

    public get length(): number {
        return this._spans.length;
    }

    public get spans(): language.Span[] {
        return this._spans;
    }

    public get kind(): DefinitionKind {
        return this._type;
    }

    public add(span: language.Span): void {
        assert(span);

        this._spans.push(span);
    }

    public addAll(list: ReferenceList): void {
        assert(list);
        assert.deepStrictEqual(this._type, list.kind, "Cannot add references from a list of a different reference type.");

        for (const span of list.spans) {
            this.add(span);
        }
    }

    public translate(movement: number): ReferenceList {
        nonNullValue(movement, "movement");

        const result = new ReferenceList(this._type);

        for (const span of this._spans) {
            result.add(span.translate(movement));
        }

        return result;
    }
}
