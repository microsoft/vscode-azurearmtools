// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Position, Range, Uri } from "vscode";
import * as Json from "../language/json/JSON";
import { LineColPos } from "../language/LineColPos";
import { ContainsBehavior, Span } from "../language/Span";
import { CachedValue } from "../util/CachedValue";
import { __debugMarkPositionInString, __debugMarkRangeInString } from "../util/debugMarkStrings";
import { nonNullValue } from "../util/nonNull";
import { IJsonDocument } from "./templates/IJsonDocument";

/**
 * Represents any JSON document
 */
export abstract class JsonDocument implements IJsonDocument {
    // Parse result for the template JSON document as a whole
    private _jsonParseResult: Json.ParseResult;

    // The JSON node for the top-level JSON object (if the JSON is not empty or malformed)
    private _topLevelValue: Json.ObjectValue | undefined;

    private _schema: CachedValue<Json.StringValue | undefined> = new CachedValue<Json.StringValue | undefined>();

    /**
     * Constructor
     *
     * @param _documentText The string text of the document
     * @param _documentUri The location of the document
     */
    constructor(private _documentText: string, private _documentUri: Uri) {
        nonNullValue(_documentUri, "_documentUri");

        this._jsonParseResult = Json.parse(_documentText);
        this._topLevelValue = Json.asObjectValue(this._jsonParseResult.value);
    }

    // tslint:disable-next-line:function-name
    public _debugShowTextAt(positionOrRange: number | Span | Range | Position): string {
        if (positionOrRange instanceof Span) {
            return __debugMarkRangeInString(this.documentText, positionOrRange.startIndex, positionOrRange.length);
        } else if (positionOrRange instanceof Range) {
            const startIndex = this.getDocumentCharacterIndex(positionOrRange.start.line, positionOrRange.start.character, { allowOutOfBounds: true });
            const endIndex = this.getDocumentCharacterIndex(positionOrRange.end.line, positionOrRange.end.character, { allowOutOfBounds: true });
            return __debugMarkRangeInString(this.documentText, startIndex, endIndex - startIndex);
        } else if (positionOrRange instanceof Position) {
            const index = this.getDocumentCharacterIndex(positionOrRange.line, positionOrRange.character, { allowOutOfBounds: true });
            return __debugMarkPositionInString(this.documentText, index);
        } else {
            return __debugMarkPositionInString(this.documentText, positionOrRange);
        }
    }

    /**
     * Get the document text as a string.
     */
    public get documentText(): string {
        return this._documentText;
    }

    /**
     * Retrieves a section of the document text
     */
    public getDocumentText(span: Span, offsetIndex?: number): string {
        return span.getText(this.documentText, offsetIndex);
    }

    /**
     * The unique identifier for this deployment template, which indicates its location
     */
    public get documentUri(): Uri {
        return this._documentUri;
    }

    // Parse result for the template JSON document as a whole
    public get jsonParseResult(): Json.ParseResult {
        return this._jsonParseResult;
    }

    // The JSON node for the top-level JSON object (if the JSON is not empty or malformed)
    public get topLevelValue(): Json.ObjectValue | undefined {
        return this._topLevelValue;
    }

    public get schemaUri(): string | undefined {
        const schema = this.schemaValue;
        return schema ? schema.unquotedValue : undefined;
    }

    public get schemaValue(): Json.StringValue | undefined {
        return this._schema.getOrCacheValue(() => {
            return this.topLevelValue?.getPropertyValue("$schema")?.asStringValue;
        });
    }

    public getMaxLineLength(): number {
        let max = 0;
        for (const len of this.jsonParseResult.lineLengths) {
            if (len > max) {
                max = len;
            }
        }

        return max;
    }

    public getCommentCount(): number {
        return this.jsonParseResult.commentCount;
    }

    /**
     * Get the number of lines that are in the file.
     */
    public get lineCount(): number {
        return this._jsonParseResult.lineLengths.length;
    }

    /**
     * Get the maximum column index for the provided line. For the last line in the file,
     * the maximum column index is equal to the line length. For every other line in the file,
     * the maximum column index is less than the line length (because line length includes
     * the CR/LF terminating characters, but the last line doesn't).
     */
    public getMaxColumnIndex(lineIndex: number): number {
        return this._jsonParseResult.getMaxColumnIndex(lineIndex);
    }

    /**
     * Get the maximum document character index for this deployment template.
     */
    public get maxCharacterIndex(): number {
        return this._jsonParseResult.maxCharacterIndex;
    }

    public getDocumentCharacterIndex(documentLineIndex: number, documentColumnIndex: number, options?: { allowOutOfBounds?: boolean }): number {
        return this._jsonParseResult.getCharacterIndex(documentLineIndex, documentColumnIndex, options);
    }

    public getDocumentPosition(documentCharacterIndex: number): LineColPos {
        return this._jsonParseResult.getPositionFromCharacterIndex(documentCharacterIndex);
    }

    public getJSONTokenAtDocumentCharacterIndex(documentCharacterIndex: number): Json.Token | undefined {
        return this._jsonParseResult.getTokenAtCharacterIndex(documentCharacterIndex);
    }

    public getJSONValueAtDocumentCharacterIndex(documentCharacterIndex: number, containsBehavior: ContainsBehavior): Json.Value | undefined {
        return this._jsonParseResult.getValueAtCharacterIndex(documentCharacterIndex, containsBehavior);
    }
}
