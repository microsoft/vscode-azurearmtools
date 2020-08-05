// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Issue } from "../language/Issue";
import { IssueKind } from "../language/IssueKind";
import { Span } from "../language/Span";

export class UnrecognizedBuiltinFunctionIssue extends Issue {
    constructor(span: Span, private _functionName: string) {
        super(
            span,
            `Unrecognized function name '${_functionName}'.`,
            IssueKind.undefinedFunc
        );
    }

    public translate(movement: number): Issue {
        return new UnrecognizedBuiltinFunctionIssue(this.span.translate(movement), this.functionName);
    }

    public get functionName(): string {
        return this._functionName;
    }
}

export class UnrecognizedUserNamespaceIssue extends Issue {
    constructor(span: Span, private _namspaceName: string) {
        super(
            span,
            `Unrecognized user-defined function namespace '${_namspaceName}'.`,
            IssueKind.undefinedNs
        );
    }

    public translate(movement: number): Issue {
        return new UnrecognizedUserNamespaceIssue(this.span.translate(movement), this._namspaceName);
    }

    public get namespaceName(): string {
        return this._namspaceName;
    }
}

export class UnrecognizedUserFunctionIssue extends Issue {
    constructor(span: Span, private _namespaceName: string, private _functionName: string) {
        super(
            span,
            `Unrecognized function name '${_functionName}' in user-defined namespace '${_namespaceName}'.`,
            IssueKind.undefinedUdf
        );
    }

    public translate(movement: number): Issue {
        return new UnrecognizedUserFunctionIssue(this.span.translate(movement), this.namespaceName, this.functionName);
    }

    public get namespaceName(): string {
        return this._namespaceName;
    }

    public get functionName(): string {
        return this._functionName;
    }
}
