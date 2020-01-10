// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { isNullOrUndefined } from "util";
import { assert } from "./fixed_assert";
import { DefinitionKind } from "./INamedDefinition";
import * as language from "./Language";

/**
 * A list of references that have been found.
 */
export class ReferenceList {
    constructor(private _type: DefinitionKind, private _spans: language.Span[] = []) {
        assert(!isNullOrUndefined(_type), "Cannot create a reference list from null/undefined.");
        assert(!isNullOrUndefined(_spans), "Cannot create a reference list with a null spans array.");
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
        assert(movement);

        const result = new ReferenceList(this._type);

        for (const span of this._spans) {
            result.add(span.translate(movement));
        }

        return result;
    }
}
