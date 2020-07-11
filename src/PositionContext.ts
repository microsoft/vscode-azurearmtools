// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CachedValue } from "./CachedValue";
import * as Completion from "./Completion";
import { __debugMarkPositionInString } from "./debugMarkStrings";
import { DeploymentDocument as DeploymentDocument } from "./DeploymentDocument";
import { assert } from './fixed_assert';
import { HoverInfo } from "./Hover";
import { INamedDefinition } from "./INamedDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import { ReferenceList } from "./ReferenceList";
import { KnownSnippetContexts } from "./snippets/SnippetContext";
import { SnippetInsertionContext } from "./snippets/SnippetInsertionContext";
import * as TLE from "./TLE";
import { InitializeBeforeUse } from "./util/InitializeBeforeUse";
import { nonNullValue } from "./util/nonNull";

export enum ReferenceSiteKind {
    definition = "definition",
    reference = "reference"
}

/**
 * Information about a reference site (function call, parameter reference, etc.), or to
 * a definition itself (function definition, parameter definition, etc.)
 */
export interface IReferenceSite {
    referenceKind: ReferenceSiteKind;

    /**
     * Where the reference or definition occurs in the template, without any quotes
     */
    unquotedReferenceSpan: language.Span;

    /**
     * The document that contains the reference
     */
    referenceDocument: DeploymentDocument;

    /**
     * The definition that the reference refers to
     */
    definition: INamedDefinition;

    /**
     * The document that contains the definition
     */
    definitionDocument: DeploymentDocument;
}

/**
 * (Abstract base class) Represents a position inside the snapshot of a deployment file, plus all related information
 * that can be parsed and analyzed about it from that position.
 */
export abstract class PositionContext {
    private _documentPosition: InitializeBeforeUse<language.Position> = new InitializeBeforeUse<language.Position>();
    private _documentCharacterIndex: InitializeBeforeUse<number> = new InitializeBeforeUse<number>();
    private _jsonToken: CachedValue<Json.Token | undefined> = new CachedValue<Json.Token>();
    private _jsonValue: CachedValue<Json.Value | undefined> = new CachedValue<Json.Value | undefined>();

    protected constructor(private _document: DeploymentDocument, private _associatedDocument: DeploymentDocument | undefined) {
        nonNullValue(this._document, "document");
    }

    protected initFromDocumentLineAndColumnIndices(documentLineIndex: number, documentColumnIndex: number): void {
        nonNullValue(documentLineIndex, "documentLineIndex");
        assert(documentLineIndex >= 0, "documentLineIndex cannot be negative");
        assert(documentLineIndex < this._document.lineCount, `documentLineIndex (${documentLineIndex}) cannot be greater than or equal to the deployment template's line count (${this._document.lineCount})`);
        nonNullValue(documentColumnIndex, "documentColumnIndex");
        assert(documentColumnIndex >= 0, "documentColumnIndex cannot be negative");
        assert(documentColumnIndex <= this._document.getMaxColumnIndex(documentLineIndex), `documentColumnIndex (${documentColumnIndex}) cannot be greater than the line's maximum index (${this._document.getMaxColumnIndex(documentLineIndex)})`);

        this._documentPosition.value = new language.Position(documentLineIndex, documentColumnIndex);
        this._documentCharacterIndex.value = this._document.getDocumentCharacterIndex(documentLineIndex, documentColumnIndex);
    }

    protected initFromDocumentCharacterIndex(documentCharacterIndex: number): void {
        nonNullValue(documentCharacterIndex, "documentCharacterIndex");
        assert(documentCharacterIndex >= 0, "documentCharacterIndex cannot be negative");
        assert(documentCharacterIndex <= this._document.maxCharacterIndex, `documentCharacterIndex (${documentCharacterIndex}) cannot be greater than the maximum character index (${this._document.maxCharacterIndex})`);

        this._documentCharacterIndex.value = documentCharacterIndex;
        this._documentPosition.value = this._document.getDocumentPosition(documentCharacterIndex);
    }

    public get document(): DeploymentDocument {
        return this._document;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        let docText: string = this._document.documentText;
        return __debugMarkPositionInString(docText, this.documentCharacterIndex, "<CURSOR>");
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugFullDisplay(): string {
        let docText: string = this._document.documentText;
        return __debugMarkPositionInString(docText, this.documentCharacterIndex, "<CURSOR>", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }

    public get documentPosition(): language.Position {
        return this._documentPosition.value;
    }

    public get documentLineIndex(): number {
        return this.documentPosition.line;
    }

    public get documentColumnIndex(): number {
        return this.documentPosition.column;
    }

    public get documentCharacterIndex(): number {
        return this._documentCharacterIndex.value;
    }

    public get jsonToken(): Json.Token | undefined {
        return this._jsonToken.getOrCacheValue(() => {
            return this._document.getJSONTokenAtDocumentCharacterIndex(this.documentCharacterIndex);
        });
    }

    // NOTE: Includes character after end index
    public get jsonValue(): Json.Value | undefined {
        return this._jsonValue.getOrCacheValue(() => {
            return this._document.getJSONValueAtDocumentCharacterIndex(this.documentCharacterIndex, language.Contains.extended);
        });
    }

    public get jsonTokenStartIndex(): number {
        assert(!!this.jsonToken, "The jsonTokenStartIndex can only be requested when the PositionContext is inside a JSONToken.");
        // tslint:disable-next-line:no-non-null-assertion no-unnecessary-type-assertion // Asserted
        return this.jsonToken!.span.startIndex;
    }

    public get emptySpanAtDocumentCharacterIndex(): language.Span {
        return new language.Span(this.documentCharacterIndex, 0);
    }

    /**
     * Gets the "word" at the cursor or right after the cursor position (i.e.,
     * the token that the cursor is "touching"), to indicate the span that
     * an Intellisense completion should replace
     */
    public getCompletionReplacementSpanInfo(): { span: language.Span | undefined; token: Json.Token | undefined } {
        const index = this.documentCharacterIndex;
        let tokenAtCursor = this.document.getJSONTokenAtDocumentCharacterIndex(index);

        // If there's no token at the current location, try again right before the cursor
        if (!tokenAtCursor && index > 0) {
            const tokenAfterCursor = this.document.getJSONTokenAtDocumentCharacterIndex(index - 1);
            if (tokenAfterCursor) {
                const line = this.document.getDocumentPosition(tokenAfterCursor.span.startIndex).line;
                if (line === this.documentPosition.line) {
                    tokenAtCursor = tokenAfterCursor;
                }
            }
        }

        if (tokenAtCursor && tokenAtCursor.type !== Json.TokenType.QuotedString) {
            // We want to include hyphens in our definition of word, so that snippets such as
            // "arm-keyvault" or "arm!mg" are replaced in whole by the snippet.  But such characters
            // aren't part of literals in JSON, so look for a match directly in the text.
            let start = tokenAtCursor.span.startIndex;
            const documentText = this.document.documentText;
            while (start > 0 && documentText.charAt(start - 1).match(/^[\w-!\$]/)) {
                --start;
            }

            const match = this.document.documentText.slice(start).match(/^[\w-!\$]+/);
            return {
                span: match ? new language.Span(start, match[0].length) : undefined,
                token: tokenAtCursor
            };
        }

        return {
            span: tokenAtCursor?.span,
            token: tokenAtCursor
        };
    }

    /**
     * If this position is inside an expression, inside a reference to an interesting function/parameter/etc, then
     * return an object with information about this reference and the corresponding definition
     */
    public abstract getReferenceSiteInfo(includeDefinition: boolean): IReferenceSite | undefined;

    /**
     * Return all references to the item at the cursor position (both in this document
     * and any associated documents). The item may be a definition (such as a parameter definition), or
     * it may be a reference to an item defined elsewhere (like a variables('xxx') call).
     * @returns undefined if references are not supported at this location, or empty list if supported but none found
     */
    public getReferences(): ReferenceList | undefined {
        // Find what's at the cursor position
        // References in this document
        const references: ReferenceList | undefined = this.getReferencesCore();
        if (!references) {
            return undefined;
        }

        if (this._associatedDocument) {
            // References/definitions in the associated document
            const refInfo = this.getReferenceSiteInfo(true);
            if (refInfo) {
                const templateReferences = this._associatedDocument.findReferencesToDefinition(refInfo.definition);
                references.addAll(templateReferences);
            }
        }
        return references;
    }

    /**
     * Return all references to the given reference site info in this document
     * @returns undefined if references are not supported at this location, or empty list if supported but none found
     */
    protected abstract getReferencesCore(): ReferenceList | undefined;

    public getHoverInfo(): HoverInfo | undefined {
        const reference: IReferenceSite | undefined = this.getReferenceSiteInfo(false);
        if (reference) {
            const span = reference.unquotedReferenceSpan;
            const definition = reference.definition;
            return new HoverInfo(definition.usageInfo, span);
        }

        return undefined;
    }

    public abstract getCompletionItems(triggerCharacter: string | undefined): Promise<Completion.Item[]>;

    public abstract getSignatureHelp(): TLE.FunctionSignatureHelp | undefined;

    /**
     * Determines the snippet insertion context at this location (i.e., the type of snippets which are appropriate to insert here,
     * the span of insertion, etc.)
     */
    // tslint:disable-next-line: max-func-body-length
    public getSnippetInsertionContext(triggerCharacter: string | undefined): SnippetInsertionContext {
        if (!this.document.topLevelValue) {
            // Empty JSON document
            return { context: KnownSnippetContexts.emptyDocument, parents: [] };
        }

        let replacementInfo = this.getCompletionReplacementSpanInfo();
        const insideDoubleQuotes = replacementInfo.token?.type === Json.TokenType.QuotedString;

        const insertionParent: Json.ArrayValue | Json.ObjectValue | undefined = this.getInsertionParent();
        if (insertionParent) {
            const lineage: (Json.ArrayValue | Json.ObjectValue | Json.Property)[] | undefined = this.document.topLevelValue.findLineage(insertionParent);
            assert(lineage, `Couldn't find JSON value inside the top-level value: ${insertionParent.toFullFriendlyString()}`);
            let parents = lineage.reverse() as (Json.ArrayValue | Json.ObjectValue)[];
            parents = [insertionParent].concat(parents);

            if (
                (!triggerCharacter || triggerCharacter === '"')
                && parents[0] instanceof Json.ObjectValue && parents[1] instanceof Json.Property
            ) {
                // We're inside of an object, and the user might have typed a double quote to start the property
                // name.
                // The context is the name of the property whose value is the object.  E.g.:
                //
                // "parameters": {
                //      <<CURSOR>>
                //        or
                //      "<<CURSOR>>"
                //
                //   - context is "parameters"
                // }
                //
                const parentPropertyName = parents[1].propertyName;
                return { context: parentPropertyName, parents, insideDoubleQuotes };
            }

            if (
                !insideDoubleQuotes
                && !triggerCharacter
                && parents[0] instanceof Json.ArrayValue
                && parents[1] instanceof Json.Property
            ) {
                // Inside an array, and the user types "CTRL+SPACE" (or starts typing) to show the completion dropdown
                // The context is the name of the property whose value is the array.  E.g.:
                //
                // "resources": [
                //   <<CURSOR>>
                //      ^^^^^^ The cursor is inside a set of curly braces that were just added (because the user typed "{")
                //               - context is "resources"
                // ]
                //
                const parentPropertyName = parents[1].propertyName;
                return { context: parentPropertyName, parents };
            }

            if (
                !insideDoubleQuotes
                && parents[0] instanceof Json.ObjectValue
                && parents[1] instanceof Json.ArrayValue
                && parents[2] instanceof Json.Property
                && parents[0].properties.length === 0
            ) {
                if (triggerCharacter === '{') {
                    // Inside an array, user typed "{" to start a new object (the insertionObject).
                    // Vscode added the ending "}" automatically.
                    // The context is the name of the property whose value is the array.  E.g.:
                    //
                    // "resources": [
                    //   {<<CURSOR>>}
                    //      ^^^^^^ The cursor is inside a set of curly braces that were just added (because the user typed "{")
                    //               - context is "resources"
                    // ]
                    //

                    // We can't handle this directly because vscode won't accept "{" as being part of the snippet
                    //   prefix.  So instead we request that the caller trigger a completion programmatically at this point,
                    //   inside the new (empty) object.
                    // That completion will be handled in the next case
                    return {
                        context: undefined,
                        triggerSuggest: true,
                        parents
                    };
                } else if (!triggerCharacter) {
                    // Inside an empty object inside an array (likely because of the above case but could be manually triggered
                    //   by the user in this scenario).
                    // User types CTRL+SPACE or starts typing.
                    // The context is the name of the property whose value is the array.  E.g.:
                    //
                    // "resources": [
                    //   {
                    //     <<CURSOR>>
                    //      ^^^^^^ The cursor is inside an empty object
                    //   }
                    // ]
                    //
                    const parentPropertyName = parents[2].propertyName;
                    return {
                        context: parentPropertyName,
                        curlyBraces: insertionParent.span,
                        parents
                    };
                }
            }
        }

        return { context: undefined, parents: [], insideDoubleQuotes };
    }

    // Retrieves the array or object which would be the parent if a JSON item were added
    //   at the current location
    public getInsertionParent(): Json.ObjectValue | Json.ArrayValue | undefined {
        const enclosingJsonValue = this.document.jsonParseResult.getValueAtCharacterIndex(
            this.documentCharacterIndex,
            language.Contains.enclosed);
        if (!(enclosingJsonValue instanceof Json.ObjectValue || enclosingJsonValue instanceof Json.ArrayValue)) {
            return undefined;
        }

        // We're immediately inside an object or array, not any other kind of value.  But we could still be inside
        // a comment
        if (!!this.document.jsonParseResult.getCommentTokenAtDocumentIndex(
            this.documentCharacterIndex,
            language.Contains.enclosed)
        ) {
            // Inside a comment, can't insert here!
            return undefined;
        }

        return enclosingJsonValue;
    }
}
