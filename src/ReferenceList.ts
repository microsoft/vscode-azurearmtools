// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { DeploymentDocument } from "./DeploymentDocument";
import { assert } from "./fixed_assert";
import { DefinitionKind } from "./INamedDefinition";
import * as language from "./Language";
import { nonNullValue } from "./util/nonNull";

export interface IReference {
    span: language.Span;
    document: DeploymentDocument;
}

/**
 * A list of references that have been found.
 */
export class ReferenceList {
    constructor(private _type: DefinitionKind, private _refs: IReference[] = []) {
        nonNullValue(_type, "_type");
        nonNullValue(_refs, "_refs");
    }

    public get length(): number {
        return this._refs.length;
    }

    public get references(): IReference[] {
        return this._refs;
    }

    public get kind(): DefinitionKind {
        return this._type;
    }

    public add(reference: IReference): void {
        this._refs.push(reference);
    }

    public addAll(list: ReferenceList): void {
        assert(list);
        assert.deepStrictEqual(this._type, list.kind, "Cannot add references from a list of a different reference type.");

        for (const ref of list.references) {
            this.add(ref);
        }
    }

    public translate(movement: number): ReferenceList {
        nonNullValue(movement, "movement");

        const result = new ReferenceList(this._type);

        for (const ref of this.references) {
            result.add({
                document: ref.document,
                span: ref.span.translate(movement)
            });
        }

        return result;
    }
}
