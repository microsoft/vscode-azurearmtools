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
        private _name: string,
        private _insertText: string,
        private _insertSpan: language.Span,
        private _detail: string,
        private _description: string | null,
        private _type: CompletionKind
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
            `(function) ${metadata.usage}`, // detail
            metadata.description, // description
            CompletionKind.Function);
    }

    public static fromNamespaceDefinition(namespace: UserFunctionNamespaceDefinition, replaceSpan: language.Span): Item {
        const name: string = namespace.nameValue.unquotedValue;
        let insertText: string = `${name}.$0`;

        return new Item(
            name,
            insertText,
            replaceSpan,
            `(namespace) ${name}`, // detail
            "User-defined namespace", // description
            CompletionKind.Parameter
        );
    }

    public static fromPropertyName(propertyName: string, replaceSpan: language.Span): Item {
        return new Item(
            propertyName,
            `${propertyName}$0`,
            replaceSpan,
            "(property)", // detail  // CONSIDER: Add type, default value, etc.
            "", // description
            CompletionKind.Property
        );
    }

    public static fromParameterDefinition(parameter: IParameterDefinition, replaceSpan: language.Span, includeRightParenthesisInCompletion: boolean): Item {
        const name: string = `'${parameter.nameValue.unquotedValue}'`;
        return new Item(
            name,
            `${name}${includeRightParenthesisInCompletion ? ")" : ""}$0`,
            replaceSpan,
            `(parameter)`, // detail // CONSIDER: Add type, default value, etc. from property definition
            parameter.description, // description (from property definition's metadata)
            CompletionKind.Parameter);
    }

    public static fromVariableDefinition(variable: IVariableDefinition, replaceSpan: language.Span, includeRightParenthesisInCompletion: boolean): Item {
        const variableName: string = `'${variable.nameValue.unquotedValue}'`;
        return new Item(
            variableName,
            `${variableName}${includeRightParenthesisInCompletion ? ")" : ""}$0`,
            replaceSpan,
            `(variable)`, // detail
            "", // description
            CompletionKind.Variable);
    }

    public get name(): string {
        return this._name;
    }

    public get insertText(): string {
        return this._insertText;
    }

    public get insertSpan(): language.Span {
        return this._insertSpan;
    }

    public get detail(): string {
        return this._detail;
    }

    public get description(): string | null {
        return this._description;
    }

    public get kind(): CompletionKind {
        return this._type;
    }
}

export enum CompletionKind {
    Function = "Function",
    Parameter = "Parameter",
    Variable = "Variable",
    Property = "Property",
    Namespace = "Namespace"
}
