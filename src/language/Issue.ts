// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as assert from "assert";
import { nonNullValue } from "../util/nonNull";
import { IssueKind } from "./IssueKind";
import { Span } from "./Span";

/**
 * An issue that was detected while parsing a deployment template.
 */
export class Issue {
    constructor(private _span: Span, private _message: string, public kind: IssueKind) {
        nonNullValue(_span, "_span");
        assert(0 <= _span.length, "_span's length must be greater than or equal to 0.");
        nonNullValue(_message, "_message");
        assert(_message !== "", "_message must not be empty.");
    }

    public get span(): Span {
        return this._span;
    }

    public get message(): string {
        return this._message;
    }

    public get isUnnecessaryCode(): boolean {
        switch (this.kind) {
            case IssueKind.unusedVar:
            case IssueKind.unusedParam:
            case IssueKind.unusedUdfParam:
            case IssueKind.unusedUdf:
                return true;

            default:
                return false;
        }
    }

    public translate(movement: number): Issue {
        return new Issue(this._span.translate(movement), this._message, this.kind);
    }
}
