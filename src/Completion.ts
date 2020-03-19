// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IFunctionMetadata } from "./IFunctionMetadata";
import { IParameterDefinition } from "./IParameterDefinition";
import * as language from "./Language";
import { UserFunctionNamespaceDefinition } from "./UserFunctionNamespaceDefinition";
import { IVariableDefinition } from "./VariableDefinition";

/**
 * A completion item in the list of completion suggestions that appear when a user invokes auto-completion (Ctrl + Space).
 */
export class Item {
    constructor(
        public label: string,
        public insertText: string,
        public insertSpan: language.Span,
        public kind: CompletionKind,
        /**
         * A human-readable string with additional information
         * about this item, like type or symbol information.
         */
        public detail?: string,
        /**
         * A human-readable string that represents a doc-comment.
         */
        public documention?: string,
        public snippetName?: string,
        public additionalEdits?: { span: language.Span; insertText: string }[]
    ) {
    }

    public static fromFunctionMetadata(metadata: IFunctionMetadata, replaceSpan: language.Span): Item {
        // We want to show the fully-qualified name in the completion's title, but we only need to insert the
        // unqualified name, since the namespace is already there (if any)
        let insertText: string = metadata.unqualifiedName;
        // CONSIDER: Adding parentheses is wrong if they're already there
        if (metadata.maximumArguments === 0) {
            // Cursor should go after the parentheses if no args
            insertText += "()$0";
        } else {
            // ... or between them if there are args
            insertText += "($0)";
        }

        return new Item(
            metadata.fullName,
            insertText,
            replaceSpan,
            CompletionKind.Function,
            `(function) ${metadata.usage}`, // detail
            metadata.description // documentation
        );
    }

    public static fromNamespaceDefinition(namespace: UserFunctionNamespaceDefinition, replaceSpan: language.Span): Item {
        const name: string = namespace.nameValue.unquotedValue;
        let insertText: string = `${name}.$0`;

        return new Item(
            name,
            insertText,
            replaceSpan,
            CompletionKind.Parameter,
            `(namespace) ${name}`, // detail
            "User-defined namespace" // documentation
        );
    }

    public static fromPropertyName(propertyName: string, replaceSpan: language.Span): Item {
        return new Item(
            propertyName,
            `${propertyName}$0`,
            replaceSpan,
            CompletionKind.Property,
            "(property)", // detail  // CONSIDER: Add type, default value, etc.
            undefined // documentation
        );
    }

    public static fromParameterDefinition(parameter: IParameterDefinition, replaceSpan: language.Span, includeRightParenthesisInCompletion: boolean): Item {
        const name: string = `'${parameter.nameValue.unquotedValue}'`;
        return new Item(
            name,
            `${name}${includeRightParenthesisInCompletion ? ")" : ""}$0`,
            replaceSpan,
            CompletionKind.Parameter,
            `(parameter)`, // detail // CONSIDER: Add type, default value, etc. from property definition
            parameter.description // documentation (from property definition's metadata)
        );
    }

    public static fromVariableDefinition(variable: IVariableDefinition, replaceSpan: language.Span, includeRightParenthesisInCompletion: boolean): Item {
        const variableName: string = `'${variable.nameValue.unquotedValue}'`;
        return new Item(
            variableName,
            `${variableName}${includeRightParenthesisInCompletion ? ")" : ""}$0`,
            replaceSpan,
            CompletionKind.Variable,
            `(variable)`, // detail
            undefined // documentation
        );
    }
}

export enum CompletionKind {
    Function = "Function",
    Parameter = "Parameter",
    Variable = "Variable",
    Property = "Property",
    Namespace = "Namespace",

    // Parameter file completions
    PropertyValue = "PropertyValue", // Parameter from the template file
    NewPropertyValue = "NewPropertyValue" // New, unnamed parameter
}
