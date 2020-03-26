// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CompletionItem, Event, EventEmitter } from "vscode";
import { Completion } from "../extension.bundle";
import { DeploymentDocument } from "./DeploymentDocument";
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
        public readonly label: string,
        public readonly insertText: string,
        public readonly insertSpan: language.Span,
        public readonly kind: CompletionKind,
        /**
         * A human-readable string with additional information
         * about this item, like type or symbol information.
         */
        public readonly detail?: string,
        /**
         * A human-readable string that represents a doc-comment.
         */
        public readonly documention?: string,
        public readonly snippetName?: string,
        public readonly additionalEdits?: { span: language.Span; insertText: string }[]
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

export interface ICompletionsSpyResult {
    document: DeploymentDocument;
    completionItems: Completion.Item[];
    vsCodeCompletionItems: CompletionItem[];
}

export class CompletionsSpy {
    private readonly _completionsEmitter: EventEmitter<ICompletionsSpyResult> = new EventEmitter<ICompletionsSpyResult>();
    private readonly _resolveEmitter: EventEmitter<CompletionItem> = new EventEmitter<CompletionItem>();

    public readonly onCompletionItems: Event<ICompletionsSpyResult> = this._completionsEmitter.event;
    public readonly onCompletionItemResolved: Event<CompletionItem> = this._resolveEmitter.event;

    public postCompletionItemsResult(
        document: DeploymentDocument,
        completionItems: Completion.Item[],
        vsCodeCompletionItems: CompletionItem[]
    ): void {
        this._completionsEmitter.fire({
            document,
            completionItems,
            vsCodeCompletionItems
        });
    }

    public postCompletionItemResolution(item: CompletionItem): void {
        this._resolveEmitter.fire(item);
    }

    public dispose(): void {
        this._completionsEmitter.dispose();
    }
}
