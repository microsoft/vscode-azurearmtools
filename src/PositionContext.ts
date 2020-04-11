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
import * as TLE from "./TLE";
import { InitializeBeforeUse } from "./util/InitializeBeforeUse";
import { nonNullValue } from "./util/nonNull";

/**
 * Information about a reference site (function call, parameter reference, etc.)
 */
export interface IReferenceSite {
    /**
     * Where the reference occurs in the template
     */
    referenceSpan: language.Span;

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
 * Represents a position inside the snapshot of a deployment parameter file, plus all related information
 * that can be parsed and analyzed about it from that position.
 */
export abstract class PositionContext {
    private _documentPosition: InitializeBeforeUse<language.Position> = new InitializeBeforeUse<language.Position>();
    private _documentCharacterIndex: InitializeBeforeUse<number> = new InitializeBeforeUse<number>();
    private _jsonToken: CachedValue<Json.Token | undefined> = new CachedValue<Json.Token>();
    private _jsonValue: CachedValue<Json.Value | undefined> = new CachedValue<Json.Value | undefined>();

    protected constructor(private _document: DeploymentDocument) {
        nonNullValue(this._document, "document");
    }

    protected initFromDocumentLineAndColumnIndices(documentLineIndex: number, documentColumnIndex: number): void {
        nonNullValue(documentLineIndex, "documentLineIndex");
        assert(documentLineIndex >= 0, "documentLineIndex cannot be negative");
        assert(documentLineIndex < this._document.lineCount, `documentLineIndex (${documentLineIndex}) cannot be greater than or equal to the deployment template's line count (${this._document.lineCount})`);
        nonNullValue(documentColumnIndex, "documentColumnIndex");
        assert(documentColumnIndex >= 0, "documentColumnIndex cannot be negative");
        assert(documentColumnIndex <= this._document.getMaxColumnIndex(documentLineIndex), `documentColumnIndex (${documentColumnIndex}) cannot be greater than the line's maximum index (${this._document.getMaxColumnIndex(documentLineIndex)})`);

        this._documentPosition.setValue(new language.Position(documentLineIndex, documentColumnIndex));
        this._documentCharacterIndex.setValue(this._document.getDocumentCharacterIndex(documentLineIndex, documentColumnIndex));
    }

    protected initFromDocumentCharacterIndex(documentCharacterIndex: number): void {
        nonNullValue(documentCharacterIndex, "documentCharacterIndex");
        assert(documentCharacterIndex >= 0, "documentCharacterIndex cannot be negative");
        assert(documentCharacterIndex <= this._document.maxCharacterIndex, `documentCharacterIndex (${documentCharacterIndex}) cannot be greater than the maximum character index (${this._document.maxCharacterIndex})`);

        this._documentCharacterIndex.setValue(documentCharacterIndex);
        this._documentPosition.setValue(this._document.getDocumentPosition(documentCharacterIndex));
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
        return this._documentPosition.getValue();
    }

    public get documentLineIndex(): number {
        return this.documentPosition.line;
    }

    public get documentColumnIndex(): number {
        return this.documentPosition.column;
    }

    public get documentCharacterIndex(): number {
        return this._documentCharacterIndex.getValue();
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
     * If this position is inside an expression, inside a reference to an interesting function/parameter/etc, then
     * return an object with information about this reference and the corresponding definition
     */
    public abstract getReferenceSiteInfo(): IReferenceSite | undefined;

    // Returns undefined if references are not supported at this location.
    // Returns empty list if supported but none found
    public abstract getReferences(): ReferenceList | undefined;

    public getHoverInfo(): HoverInfo | undefined {
        const reference: IReferenceSite | undefined = this.getReferenceSiteInfo();
        if (reference) {
            const span = reference.referenceSpan;
            const definition = reference.definition;
            return new HoverInfo(definition.usageInfo, span);
        }

        return undefined;
    }

    public abstract getCompletionItems(): Completion.Item[];

    public abstract getSignatureHelp(): TLE.FunctionSignatureHelp | undefined;
}
