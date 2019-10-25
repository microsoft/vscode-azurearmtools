// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as language from "./Language";

export class UnrecognizedBuiltinFunctionIssue extends language.Issue {
    constructor(span: language.Span, private _functionName: string) {
        super(span, `Unrecognized function name '${_functionName}'.`);
    }

    public translate(movement: number): language.Issue {
        return new UnrecognizedBuiltinFunctionIssue(this.span.translate(movement), this.functionName);
    }

    public get functionName(): string {
        return this._functionName;
    }
}

export class UnrecognizedUserNamespaceIssue extends language.Issue {
    constructor(span: language.Span, private _namspaceName: string) {
        super(span, `Unrecognized user-defined function namespace '${_namspaceName}'.`);
    }

    public translate(movement: number): language.Issue {
        return new UnrecognizedUserNamespaceIssue(this.span.translate(movement), this._namspaceName);
    }

    public get namespaceName(): string {
        return this._namspaceName;
    }
}

export class UnrecognizedUserFunctionIssue extends language.Issue {
    constructor(span: language.Span, private _namespaceName: string, private _functionName: string) {
        super(span, `Unrecognized function name '${_functionName}' in user-defined namespace '${_namespaceName}'.`);
    }

    public translate(movement: number): language.Issue {
        return new UnrecognizedUserFunctionIssue(this.span.translate(movement), this.namespaceName, this.functionName);
    }

    public get namespaceName(): string {
        return this._namespaceName;
    }

    public get functionName(): string {
        return this._functionName;
    }
}
