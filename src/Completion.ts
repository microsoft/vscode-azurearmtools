// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { MarkdownString } from "vscode";
import { IFunctionMetadata } from "./IFunctionMetadata";
import { IParameterDefinition } from "./IParameterDefinition";
import * as language from "./Language";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { IVariableDefinition } from "./VariableDefinition";

/**
 * A completion item in the list of completion suggestions that appear when a user invokes auto-completion (Ctrl + Space).
 */
export class Item {
    public get label(): string { return this.options.label; }
    public get insertText(): string { return this.options.insertText; }
    public get span(): language.Span { return this.options.span; }
    public get kind(): CompletionKind { return this.options.kind; }
    public get detail(): string | undefined { return this.options.detail; }
    public get documention(): string | MarkdownString | undefined { return this.options.documentation; }
    public get snippetName(): string | undefined { return this.options.snippetName; }
    public get additionalEdits(): { span: language.Span; insertText: string }[] | undefined { return this.options.additionalEdits; }
    public get sortText(): string | undefined { return this.options.sortText; }
    public get commitCharacters(): string[] | undefined { return this.options.commitCharacters; }

    constructor(
        private readonly options: {
            label: string;
            insertText: string;
            span: language.Span;
            kind: CompletionKind;
            /**
             * A human-readable string with additional information
             * about this item, like type or symbol information, or the
             * full text that will be inserted (if not in label)
             */
            detail?: string;
            /**
             * A human-readable string that represents a doc-comment.
             */
            documentation?: string | MarkdownString;
            snippetName?: string;
            additionalEdits?: { span: language.Span; insertText: string }[];
            /**
             * A string that should be used when comparing this item
             * with other items. When `falsy` the [label](#CompletionItem.label)
             * is used.
             */
            sortText?: string;
            commitCharacters?: string[];
        }) {
    }

    public static fromFunctionMetadata(metadata: IFunctionMetadata, span: language.Span): Item {
        // We want to show the fully-qualified name in the completion's title, but we only need to insert the
        // unqualified name, since the namespace is already there (if any)
        const insertText: string = metadata.unqualifiedName;

        // Note: We do *not* automtically add parentheses after the function name. This actually
        // disrupts the normal flow that customers are expecting. Also, this means users will
        // need to type "(" themselves, which will then open up the intellisense completion
        // for the arguments, which otherwise wouldn't happen.
        return new Item(
            {
                label: metadata.fullName,
                insertText,
                span,
                kind: CompletionKind.Function,
                detail: `(function) ${metadata.usage}`,
                documentation: metadata.description
            });
    }

    public static fromNamespaceDefinition(namespace: UserFunctionNamespaceDefinition, span: language.Span): Item {
        const label: string = namespace.nameValue.unquotedValue;
        let insertText: string = `${name}`;

        return new Item({
            label,
            insertText,
            span: span,
            kind: CompletionKind.Parameter,
            detail: `(namespace) ${label}`,
            documentation: "User-defined namespace"
        });
    }

    public static fromPropertyName(propertyName: string, span: language.Span): Item {
        return new Item({
            label: propertyName,
            insertText: propertyName,
            span,
            kind: CompletionKind.Property,
            detail: "(property)" // CONSIDER: Add type, default value, etc.
        });
    }

    public static fromParameterDefinition(parameter: IParameterDefinition, span: language.Span, includeRightParenthesisInCompletion: boolean): Item {
        const label: string = `'${parameter.nameValue.unquotedValue}'`;
        return new Item({
            label,
            insertText: `${label}${includeRightParenthesisInCompletion ? ")" : ""}`,
            span,
            kind: CompletionKind.Parameter,
            detail: `(parameter)`, // CONSIDER: Add type, default value, etc. from property definition
            documentation: parameter.description
        });
    }

    public static fromVariableDefinition(variable: IVariableDefinition, span: language.Span, includeRightParenthesisInCompletion: boolean): Item {
        const label: string = `'${variable.nameValue.unquotedValue}'`;
        return new Item({
            label,
            insertText: `${label}${includeRightParenthesisInCompletion ? ")" : ""}`,
            span,
            kind: CompletionKind.Variable,
            detail: `(variable)`
        });
    }
}

export enum CompletionKind {
    // TLE completions
    Function = "Function",
    Parameter = "Parameter",
    Variable = "Variable",
    Property = "Property",
    Namespace = "Namespace",

    // Template file completions
    DtDependsOn = "DtDependsOn",
    DtDependsOn2 = "DtDependsOn2", //asdf

    // Parameter file completions
    DpPropertyValue = "DpPropertyValue", // Parameter from the template file
    DpNewPropertyValue = "DpNewPropertyValue" // New, unnamed parameter
}
