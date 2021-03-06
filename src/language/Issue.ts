// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as assert from "assert";
import { Uri } from "vscode";
import { assertNever } from "../util/assertNever";
import { nonNullValue } from "../util/nonNull";
import { IssueKind } from "./IssueKind";
import { Span } from "./Span";

export enum IssueSeverity {
    Error,
    Warning,
    Information,
}

/**
 * An issue that was detected while parsing a deployment template.
 */
export class Issue {
    private _relatedInformation: IssueRelatedInformation[] | undefined;

    public readonly severity: IssueSeverity;
    constructor(
        private _span: Span,
        private _message: string,
        public readonly kind: IssueKind
    ) {
        nonNullValue(_span, "_span");
        assert(0 <= _span.length, "_span's length must be greater than or equal to 0.");
        nonNullValue(_message, "_message");
        assert(_message !== "", "_message must not be empty.");

        switch (kind) {
            // Information
            case IssueKind.cannotValidateLinkedTemplate:
            case IssueKind.cannotValidateNestedTemplate:
                this.severity = IssueSeverity.Information;
                break;

            // Warnings
            case IssueKind.inaccessibleNestedScopeMembers:
            case IssueKind.incorrectScopeWarning:
            case IssueKind.unusedParam:
            case IssueKind.unusedUdf:
            case IssueKind.unusedUdfParam:
            case IssueKind.unusedVar:
                this.severity = IssueSeverity.Warning;
                break;

            // Errors
            case IssueKind.badArgsCount:
            case IssueKind.badFuncContext:
            case IssueKind.params_missingRequiredParam:
            case IssueKind.params_templateFileNotFound:
            case IssueKind.referenceInVar:
            case IssueKind.tleSyntax:
            case IssueKind.undefinedFunc:
            case IssueKind.undefinedNs:
            case IssueKind.undefinedParam:
            case IssueKind.undefinedUdf:
            case IssueKind.undefinedVar:
            case IssueKind.undefinedVarProp:
            case IssueKind.varInUdf:
            case IssueKind.errResRelativePathApiVersion:
                this.severity = IssueSeverity.Error;
                break;

            default:
                assertNever(kind);
        }
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

    public get relatedInformation(): IssueRelatedInformation[] {
        if (!this._relatedInformation) {
            this._relatedInformation = [];
        }

        return this._relatedInformation;
    }

    public translate(movement: number): Issue {
        return new Issue(this._span.translate(movement), this._message, this.kind);
    }
}

/**
 * Represents a related message and source code location for an issue. This should be
 * used to point to code locations that cause or related to an issue, e.g. when duplicating
 * a symbol in a scope.
 */
export interface IssueRelatedInformation {
    /**
     * The location of this related diagnostic information.
     */
    location: IssueLocation;

    /**
     * The message of this related diagnostic information.
     */
    message: string;
}

/**
 * Represents a location inside a resource, such as a line
 * inside a text file.
 */
export interface IssueLocation {
    /**
     * The resource identifier of this location.
     */
    uri: Uri;

    /**
     * The document span for this location.
     */
    span: Span;
}
