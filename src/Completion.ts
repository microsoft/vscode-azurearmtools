// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as vscode from 'vscode';
import { IFunctionMetadata } from "./IFunctionMetadata";
import { IParameterDefinition } from "./IParameterDefinition";
import * as language from "./Language";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { IVariableDefinition } from "./VariableDefinition";

export enum CompletionPriority {
    normal = "normal",
    high = "high",
    low = "low",
}

/**
 * A completion item in the list of completion suggestions that appear when a user invokes auto-completion (Ctrl + Space).
 */
export class Item {
    public readonly label: string;
    public readonly insertText: string;
    public readonly span: language.Span;
    public readonly kind: CompletionKind;
    public readonly detail: string | undefined;
    public readonly documention: string | vscode.MarkdownString | undefined;
    public readonly snippetName: string | undefined;
    public readonly additionalEdits: { span: language.Span; insertText: string }[] | undefined;
    public readonly sortText: string | undefined;
    public readonly commitCharacters: string[] | undefined;
    public readonly priority: CompletionPriority;
    public readonly preselect: boolean;
    public readonly telemetryProperties: { [key: string]: string } | undefined;

    constructor(
        options: {
            /**
             * Main text to display in the completion list
             */
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
            documentation?: string | vscode.MarkdownString;
            /**
             * The snippet name if this is a snippet
             */
            snippetName?: string;
            additionalEdits?: { span: language.Span; insertText: string }[];
            /**
             * A string that should be used when comparing this item
             * with other items. When `falsy` the [label](#CompletionItem.label)
             * is used.
             */
            sortText?: string;
            commitCharacters?: string[];
            /**
             * Priority for sorting used in addition to sortText.
             */
            priority?: CompletionPriority;
            preselect?: boolean;
            /**
             * Optional additional telemetry properties for if the completion is activated
             */
            telemetryProperties?: { [key: string]: string };
        }
    ) {
        this.label = options.label;
        this.insertText = options.insertText;
        this.span = options.span;
        this.kind = options.kind;
        this.detail = options.detail;
        this.documention = options.documentation;
        this.snippetName = options.snippetName;
        this.additionalEdits = options.additionalEdits;
        this.sortText = options.sortText;
        this.commitCharacters = options.commitCharacters;
        this.priority = options.priority ?? CompletionPriority.normal;
        this.preselect = !!options.preselect;
        this.telemetryProperties = options.telemetryProperties;
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
                kind: metadata.unqualifiedName === metadata.fullName ? CompletionKind.Function : CompletionKind.UserFunction,
                detail: `(function) ${metadata.usage}`,
                documentation: metadata.description
            });
    }

    public static fromNamespaceDefinition(namespace: UserFunctionNamespaceDefinition, span: language.Span): Item {
        const label: string = namespace.nameValue.unquotedValue;
        let insertText: string = `${label}`;

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

    /**
     * Dupes the completions list by label, without affecting order
     */
    public static dedupeByLabel(items: Item[]): Item[] {
        const addedLC = new Set<string>();
        const deduped: Item[] = [];

        for (let item of items) {
            const itemLabelLC = item.label.toLowerCase();
            if (!addedLC.has(itemLabelLC)) {
                deduped.push(item);
                addedLC.add(itemLabelLC);
            }
        }

        return deduped;
    }
}

export enum CompletionKind {
    // TLE completions
    Function = "Function",
    Parameter = "Parameter",
    Variable = "Variable",
    Property = "Property",
    Namespace = "Namespace",
    UserFunction = "UserFunction",

    // Template file completions
    DtResourceIdResType = "DtResourceIdResType", // First arg of resourceId
    DtResourceIdResName = "DtResourceIdResName", // Second arg of resourceId

    // Parameter file completions
    DpPropertyValue = "DpPropertyValue", // Parameter from the template file
    DpNewPropertyValue = "DpNewPropertyValue", // New, unnamed parameter

    // Snippet
    Snippet = "Snippet",
}
