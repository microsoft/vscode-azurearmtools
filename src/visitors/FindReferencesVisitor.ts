// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Utilities } from "../../extension.bundle";
import { assert } from "../fixed_assert";
import * as Reference from "../Reference";
import { StringValue, Value, Visitor } from "../TLE";

/**
 * A TLE visitor that searches a TLE value tree looking for references to the provided parameter or
 * variable.
 */
export class FindReferencesVisitor extends Visitor {
    private _references: Reference.List;
    private _lowerCasedName: string;

    constructor(private _kind: Reference.ReferenceKind, _name: string) {
        super();
        this._references = new Reference.List(_kind);
        this._lowerCasedName = Utilities.unquote(_name).toLowerCase();
    }

    public get references(): Reference.List {
        return this._references;
    }

    public visitString(tleString: StringValue | null): void {
        if (tleString && Utilities.unquote(tleString.toString()).toLowerCase() === this._lowerCasedName) {
            switch (this._kind) {
                case Reference.ReferenceKind.Parameter:
                    if (tleString.isParametersArgument()) {
                        this._references.add(tleString.unquotedSpan);
                    }
                    break;
                case Reference.ReferenceKind.Variable:
                    if (tleString.isVariablesArgument()) {
                        this._references.add(tleString.unquotedSpan);
                    }
                    break;
                default:
                    assert.fail(`Unrecognized ReferenceKind: ${this._kind}`);
                    break;
            }
        }
    }
    public static visit(tleValue: Value | null, referenceType: Reference.ReferenceKind, referenceName: string): FindReferencesVisitor {
        const visitor = new FindReferencesVisitor(referenceType, referenceName);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
