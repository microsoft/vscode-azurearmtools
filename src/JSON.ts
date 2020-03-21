// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable switch-default // Grandfathered in
// tslint:disable max-classes-per-file // Grandfathered in
// tslint:disable:function-name // Grandfathered in
// tslint:disable:cyclomatic-complexity // Grandfathered in

// CONSIDER: This parser makes the incorrect assumption that JSON strings can be enclosed by either
//   single or double quotes.  JSON only allows double quotes.
// Because the JSON/ARM parsers catch these errors, it doesn't make too much difference for the end user
//   so might not be worth fixing.

import { CachedValue } from "./CachedValue";
import { CaseInsensitiveMap } from "./CaseInsensitiveMap";
import { assert } from "./fixed_assert";
import * as language from "./Language";
import * as basic from "./Tokenizer";
import { assertNever } from "./util/assertNever";
import { nonNullValue } from "./util/nonNull";
import * as utilities from "./Utilities";

export enum ValueKind {
    'ObjectValue',
    'StringValue',
    'PropertyValue',
    'ArrayValue',
    'NumberValue',
    'NullValue',
    'BooleanValue'
}

/**
 * The different types of tokens that can be parsed from a JSON string.
 */
export enum TokenType {
    LeftCurlyBracket,
    RightCurlyBracket,
    LeftSquareBracket,
    RightSquareBracket,
    Comma,
    Colon,
    Whitespace,
    QuotedString,
    Number,
    Boolean,
    Literal,
    Null,
    Comment,
    Unrecognized
}

export enum Comments {
    /**
     * Default (parser generally ignores comments)
     */
    ignoreCommentTokens,
    includeCommentTokens
}

/**
 * An individual segment of a JSON document. This could be a single character (such as ':') or an
 * entire structure (such as '{}').
 */
export abstract class Segment {
    constructor(private _startIndex: number) {
    }

    /**
     * Get the number of characters that make up this Segment.
     */
    public abstract length(): number;

    /**
     * Get the span for this Segment.
     */
    public get span(): language.Span {
        return new language.Span(this._startIndex, this.length());
    }

    /**
     * Get the original string that this Segment was parsed from.
     */
    public abstract toString(): string;
}

/**
 * A JSON token from a JSON string. The JSON token is made up of one or more basic tokens (for instance,
 * a JSON string literal would be composed of the basic token representing a double quote, followed
 * by some group of basic tokens representing groups of letters, groups of numbers, punctuation, etc.,
 * and possibly ending with a double quote basic token).
 */
export class Token extends Segment {
    constructor(private _type: TokenType, _startIndex: number, private _basicTokens: basic.Token[]) {
        super(_startIndex);
    }

    // tslint:disable-next-line:no-reserved-keywords // Not worth risk to change
    public get type(): TokenType {
        return this._type;
    }

    public length(): number {
        return utilities.getCombinedLength(this._basicTokens);
    }

    /**
     * Gets the original string that this token was parsed from.
     */
    public toString(): string {
        return utilities.getCombinedText(this._basicTokens);
    }

    /**
     * Convenient way of seeing what this token represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.toString();
    }
}

export function LeftCurlyBracket(startIndex: number): Token {
    return new Token(TokenType.LeftCurlyBracket, startIndex, [basic.LeftCurlyBracket]);
}

export function RightCurlyBracket(startIndex: number): Token {
    return new Token(TokenType.RightCurlyBracket, startIndex, [basic.RightCurlyBracket]);
}

export function LeftSquareBracket(startIndex: number): Token {
    return new Token(TokenType.LeftSquareBracket, startIndex, [basic.LeftSquareBracket]);
}

export function RightSquareBracket(startIndex: number): Token {
    return new Token(TokenType.RightSquareBracket, startIndex, [basic.RightSquareBracket]);
}

export function Comma(startIndex: number): Token {
    return new Token(TokenType.Comma, startIndex, [basic.Comma]);
}

export function Colon(startIndex: number): Token {
    return new Token(TokenType.Colon, startIndex, [basic.Colon]);
}

export function Whitespace(startIndex: number, basicTokens: basic.Token[]): Token {
    return new Token(TokenType.Whitespace, startIndex, basicTokens);
}

export function QuotedString(startIndex: number, basicTokens: basic.Token[]): Token {
    return new Token(TokenType.QuotedString, startIndex, basicTokens);
}

export function Number(startIndex: number, basicTokens: basic.Token[]): Token {
    return new Token(TokenType.Number, startIndex, basicTokens);
}

export function Boolean(startIndex: number, basicToken: basic.Token): Token {
    return new Token(TokenType.Boolean, startIndex, [basicToken]);
}

export function Literal(startIndex: number, basicTokens: basic.Token[]): Token {
    return new Token(TokenType.Literal, startIndex, basicTokens);
}

export function Null(startIndex: number): Token {
    return new Token(TokenType.Null, startIndex, [basic.Letters("null")]);
}

export function Comment(startIndex: number, basicTokens: basic.Token[]): Token {
    return new Token(TokenType.Comment, startIndex, basicTokens);
}

export function Unrecognized(startIndex: number, basicToken: basic.Token): Token {
    return new Token(TokenType.Unrecognized, startIndex, [basicToken]);
}

export function asObjectValue(value: Value | undefined): ObjectValue | undefined {
    return value instanceof ObjectValue ? value : undefined;
}

export function asArrayValue(value: Value | undefined): ArrayValue | undefined {
    return value instanceof ArrayValue ? value : undefined;
}

export function asStringValue(value: Value | undefined): StringValue | undefined {
    return value instanceof StringValue ? value : undefined;
}

export function asNumberValue(value: Value | undefined): NumberValue | undefined {
    return value instanceof NumberValue ? value : undefined;
}

export function asBooleanValue(value: Value | undefined): BooleanValue | undefined {
    return value instanceof BooleanValue ? value : undefined;
}

/**
 * Read a JSON quoted string from the provided tokenizer. The tokenizer must be pointing at
 * either a SingleQuote or DoubleQuote Token.
 *
 * Note that the returned quoted string may not end with a quote (if EOD is reached)
 */
export function readQuotedString(iterator: utilities.Iterator<basic.Token>): basic.Token[] {
    const startingToken: basic.Token | undefined = iterator.current();
    assert(startingToken && (startingToken.getType() === basic.TokenType.SingleQuote || startingToken.getType() === basic.TokenType.DoubleQuote));

    // tslint:disable-next-line: no-non-null-assertion // Asserted
    const startQuote: basic.Token = startingToken!;
    const quotedStringTokens: basic.Token[] = [startQuote];
    iterator.moveNext();

    let escaped: boolean = false;
    let endQuote: basic.Token | undefined;
    let current: basic.Token | undefined = iterator.current();
    while (!endQuote && current) {
        quotedStringTokens.push(current);

        if (escaped) {
            escaped = false;
        } else {
            if (current.getType() === basic.TokenType.Backslash) {
                escaped = true;
            } else if (current.getType() === startQuote.getType()) {
                endQuote = iterator.current();
            }
        }

        iterator.moveNext();
        current = iterator.current();
    }

    return quotedStringTokens;
}

/**
 * Read a JSON whitespace string from the provided tokenizer.
 */
export function readWhitespace(iterator: utilities.Iterator<basic.Token>): basic.Token[] {
    const whitespaceTokens: basic.Token[] = [];

    // tslint:disable-next-line: no-constant-condition
    while (true) {
        let current: basic.Token | undefined = iterator.current();
        if (!current) {
            return whitespaceTokens;
        }

        switch (current.getType()) {
            case basic.TokenType.Space:
            case basic.TokenType.Tab:
            case basic.TokenType.CarriageReturn:
            case basic.TokenType.NewLine:
            case basic.TokenType.CarriageReturnNewLine:
                whitespaceTokens.push(current);
                iterator.moveNext();
                current = iterator.current();
                break;

            default:
                return whitespaceTokens;
        }
    }
}

/**
 * Read a JSON number from the provided iterator. The iterator must be pointing at either a
 * Dash or Digits Token when this function is called.
 */
export function readNumber(iterator: utilities.Iterator<basic.Token>): basic.Token[] {
    const numberBasicTokens: basic.Token[] = [];

    // tslint:disable-next-line:no-non-null-assertion no-unnecessary-type-assertion // Precondition is that current points to Dash or Digits
    const dashOrDigitsToken = iterator.current()!;
    if (dashOrDigitsToken.getType() === basic.TokenType.Dash) {
        // Negative sign
        numberBasicTokens.push(dashOrDigitsToken);
        iterator.moveNext();
    }

    const digits = iterator.current();
    if (digits && digits.getType() === basic.TokenType.Digits) {
        // Whole number digits
        numberBasicTokens.push(digits);
        iterator.moveNext();
    }

    const decimal = iterator.current();
    if (decimal && decimal.getType() === basic.TokenType.Period) {
        // Decimal point
        numberBasicTokens.push(decimal);
        iterator.moveNext();

        const fractionalDigits = iterator.current();
        if (fractionalDigits && fractionalDigits.getType() === basic.TokenType.Digits) {
            // Fractional number digits
            numberBasicTokens.push(fractionalDigits);
            iterator.moveNext();
        }
    }

    const exponentLetter = iterator.current();
    if (exponentLetter) {
        if (exponentLetter.getType() === basic.TokenType.Letters && exponentLetter.toString().toLowerCase() === "e") {
            // e
            numberBasicTokens.push(exponentLetter);
            iterator.moveNext();

            const exponentSign = iterator.current();
            if (exponentSign
                && (exponentSign.getType() === basic.TokenType.Dash || exponentSign.getType() === basic.TokenType.Plus)
            ) {
                // Exponent number sign
                numberBasicTokens.push(exponentSign);
                iterator.moveNext();
            }

            const exponentDigits = iterator.current();
            if (exponentDigits && exponentDigits.getType() === basic.TokenType.Digits) {
                // Exponent number digits
                numberBasicTokens.push(exponentDigits);
                iterator.moveNext();
            }
        }
    }

    return numberBasicTokens;
}

/**
 * A JSON tokenizer that tokenizes JSON strings.
 */
export class Tokenizer {
    private _innerTokenizer: basic.Tokenizer;
    private _current: Token | undefined;
    private _currentTokenStartIndex: number;
    private _lineLengths: number[] = [0];
    private _commentsCount: number = 0;

    constructor(jsonDocumentText: string, startIndex: number = 0) {
        this._innerTokenizer = new basic.Tokenizer(jsonDocumentText);
        this._currentTokenStartIndex = startIndex;
    }

    public hasStarted(): boolean {
        return this._innerTokenizer.hasStarted();
    }

    public get current(): Token | undefined {
        return this._current;
    }

    public get lineLengths(): number[] {
        return this._lineLengths;
    }

    public get commentsCount(): number {
        return this._commentsCount;
    }

    /**
     * Get the current basic token that the basic Tokenizer is pointing at.
     */
    private currentBasicToken(): basic.Token | undefined {
        return this._innerTokenizer.current();
    }

    private currentBasicTokenType(): basic.TokenType | undefined {
        const currentBasicToken: basic.Token | undefined = this.currentBasicToken();
        return currentBasicToken ? currentBasicToken.getType() : undefined;
    }

    /**
     * Move to the next basic Token from the basic Tokenizer.
     * @returns True if there is a current token after moving
     */
    private moveNextBasicToken(): boolean {
        const result: boolean = this._innerTokenizer.moveNext();
        let currentBasicToken = this.currentBasicToken();
        if (currentBasicToken) {
            let currentBasicTokenType = this.currentBasicTokenType();
            this._lineLengths[this._lineLengths.length - 1] += currentBasicToken.length();
            if (currentBasicTokenType === basic.TokenType.NewLine || currentBasicTokenType === basic.TokenType.CarriageReturnNewLine) {
                this._lineLengths.push(0);
            }
        }
        return result;
    }

    private asBasicTokenIterator(): utilities.Iterator<basic.Token> {
        // The lambda functions are required in order to capture the this pointer. If you just
        // assign the functions to be "hasStarted: this.hasStarted", then the function get assigned
        // without a bound "this" pointer.
        return {
            hasStarted: (): boolean => { return this.hasStarted(); },
            current: (): basic.Token | undefined => { return this.currentBasicToken(); },
            moveNext: (): boolean => { return this.moveNextBasicToken(); }
        };
    }

    // tslint:disable-next-line:max-func-body-length
    public moveNext(): boolean {
        if (!this.hasStarted()) {
            this.moveNextBasicToken();
        } else if (this.current) {
            this._currentTokenStartIndex += this.current.length();
        }

        this._current = undefined;
        if (this.currentBasicToken()) {
            switch (this.currentBasicTokenType()) {
                case basic.TokenType.LeftCurlyBracket:
                    assert.deepStrictEqual(this.currentBasicTokenType(), basic.TokenType.LeftCurlyBracket);
                    this._current = LeftCurlyBracket(this._currentTokenStartIndex);
                    this.moveNextBasicToken();
                    break;

                case basic.TokenType.RightCurlyBracket:
                    this._current = RightCurlyBracket(this._currentTokenStartIndex);
                    this.moveNextBasicToken();
                    break;

                case basic.TokenType.LeftSquareBracket:
                    this._current = LeftSquareBracket(this._currentTokenStartIndex);
                    this.moveNextBasicToken();
                    break;

                case basic.TokenType.RightSquareBracket:
                    this._current = RightSquareBracket(this._currentTokenStartIndex);
                    this.moveNextBasicToken();
                    break;

                case basic.TokenType.Comma:
                    this._current = Comma(this._currentTokenStartIndex);
                    this.moveNextBasicToken();
                    break;

                case basic.TokenType.Colon:
                    this._current = Colon(this._currentTokenStartIndex);
                    this.moveNextBasicToken();
                    break;

                case basic.TokenType.Dash:
                case basic.TokenType.Digits:
                    this._current = Number(this._currentTokenStartIndex, readNumber(this.asBasicTokenIterator()));
                    break;

                case basic.TokenType.ForwardSlash:
                    this.moveNextBasicToken();
                    if (!this.currentBasicToken()) {
                        this._current = Literal(this._currentTokenStartIndex, [basic.ForwardSlash]);
                    } else {
                        switch (this.currentBasicTokenType()) {
                            case basic.TokenType.ForwardSlash:
                                const lineCommentBasicTokens: basic.Token[] = [basic.ForwardSlash, basic.ForwardSlash];
                                while (this.moveNextBasicToken()
                                    && this.currentBasicTokenType() !== basic.TokenType.NewLine
                                    && this.currentBasicTokenType() !== basic.TokenType.CarriageReturnNewLine
                                ) {
                                    // tslint:disable-next-line: no-non-null-assertion // guaranteed by this.moveNextBasicToken() return value in while
                                    lineCommentBasicTokens.push(this.currentBasicToken()!);
                                }
                                this._current = Comment(this._currentTokenStartIndex, lineCommentBasicTokens);
                                this._commentsCount++;
                                break;

                            case basic.TokenType.Asterisk:
                                const blockCommentBasicTokens: basic.Token[] = [basic.ForwardSlash, basic.Asterisk];
                                this.moveNextBasicToken();

                                while (this.currentBasicToken()) {
                                    // tslint:disable-next-line: no-non-null-assertion // Validated by while
                                    blockCommentBasicTokens.push(this.currentBasicToken()!);

                                    if (this.currentBasicTokenType() === basic.TokenType.Asterisk) {
                                        this.moveNextBasicToken();

                                        if (this.currentBasicTokenType() === basic.TokenType.ForwardSlash) {
                                            // tslint:disable-next-line: no-non-null-assertion // Guaranteed by if
                                            blockCommentBasicTokens.push(this.currentBasicToken()!);
                                            this.moveNextBasicToken();
                                            break;
                                        }
                                    } else {
                                        this.moveNextBasicToken();
                                    }
                                }

                                this._current = Comment(this._currentTokenStartIndex, blockCommentBasicTokens);
                                this._commentsCount++;
                                break;

                            default:
                                this._current = Literal(this._currentTokenStartIndex, [basic.ForwardSlash]);
                                break;
                        }
                    }
                    break;

                case basic.TokenType.Space:
                case basic.TokenType.Tab:
                case basic.TokenType.CarriageReturn:
                case basic.TokenType.NewLine:
                case basic.TokenType.CarriageReturnNewLine:
                    this._current = Whitespace(this._currentTokenStartIndex, readWhitespace(this.asBasicTokenIterator()));
                    break;

                case basic.TokenType.SingleQuote:
                case basic.TokenType.DoubleQuote:
                    this._current = QuotedString(this._currentTokenStartIndex, readQuotedString(this.asBasicTokenIterator()));
                    break;

                case basic.TokenType.Letters:
                    // tslint:disable-next-line: no-non-null-assertion // Validated by if
                    switch (this.currentBasicToken()!.toString()) {
                        case "true":
                        case "false":
                            // tslint:disable-next-line: no-non-null-assertion // Validated by if
                            this._current = Boolean(this._currentTokenStartIndex, this.currentBasicToken()!);
                            this.moveNextBasicToken();
                            break;

                        case "null":
                            this._current = Null(this._currentTokenStartIndex);
                            this.moveNextBasicToken();
                            break;

                        default:
                            // tslint:disable-next-line: no-non-null-assertion // Validated by if
                            const literalTokens: basic.Token[] = [this.currentBasicToken()!];
                            this.moveNextBasicToken();

                            while (this.currentBasicToken() &&
                                (this.currentBasicTokenType() === basic.TokenType.Letters ||
                                    this.currentBasicTokenType() === basic.TokenType.Underscore)) {
                                // tslint:disable-next-line: no-non-null-assertion // Validated by if
                                literalTokens.push(this.currentBasicToken()!);
                                this.moveNextBasicToken();
                            }

                            this._current = Literal(this._currentTokenStartIndex, literalTokens);
                            break;
                    }
                    break;

                default:
                    // tslint:disable-next-line: no-non-null-assertion // Validated by if
                    this._current = Unrecognized(this._currentTokenStartIndex, this.currentBasicToken()!);
                    this.moveNextBasicToken();
                    break;
            }
        }

        return !!this.current;
    }
}

/**
 * The Value class is the generic JSON value base class that all other JSON value types inherit
 * from.
 */
export abstract class Value {
    constructor(private _span: language.Span) {
    }

    public abstract get valueKind(): ValueKind;

    /**
     * The span that this Value covers (character start index through after the character end index).
     */
    public get span(): language.Span {
        return this._span;
    }

    public get startIndex(): number {
        return this._span.startIndex;
    }

    public get length(): number {
        return this._span.length;
    }

    public abstract accept(visitor: Visitor): void;

    /**
     * A user-friendly string that represents this value, suitable for display in a label, etc.
     */
    public abstract toFriendlyString(): string;

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.toString();
    }
}

/**
 * A JSON object that contains properties.
 */
export class ObjectValue extends Value {
    // Last set with the same (case-insensitive) key wins (just like in Azure template deployment)
    private _caseInsensitivePropertyMap: CachedValue<CaseInsensitiveMap<string, Property | undefined>> = new CachedValue<CaseInsensitiveMap<string, Property | undefined>>();

    constructor(span: language.Span, private _properties: Property[]) {
        super(span);
        assert(this._properties);
    }

    public get valueKind(): ValueKind {
        return ValueKind.ObjectValue;
    }

    /**
     * Get the map of property names to properties for this ObjectValue. This mapping is
     * created lazily.
     */
    private get caseInsensitivePropertyMap(): CaseInsensitiveMap<string, Property | undefined> {
        return this._caseInsensitivePropertyMap.getOrCacheValue(() => {
            const caseInsensitivePropertyMap = new CaseInsensitiveMap<string, Property | undefined>();

            if (this._properties.length > 0) {
                for (const property of this._properties) {
                    caseInsensitivePropertyMap.set(property.nameValue.toString(), property);
                }
            }

            return caseInsensitivePropertyMap;
        });
    }

    public get properties(): Property[] {
        return this._properties;
    }

    /**
     * Get whether a property with the provided propertyName is defined or not on this ObjectValue.
     */
    public hasProperty(propertyName: string): boolean {
        return !!this.getPropertyValue(propertyName);
    }

    /**
     * Get the property value for the provided property name. If no property exists with the
     * provided name (case-insensitive), then undefined will be returned.
     */
    public getPropertyValue(propertyName: string): Value | undefined {
        const result: Property | undefined = this.caseInsensitivePropertyMap.get(propertyName);
        return result ? result.value : undefined;
    }

    /**
     * Get the property for the provided property name. If no property exists with the
     * provided name (case-insensitive), then undefined will be returned.
     */
    public getProperty(propertyName: string): Property | undefined {
        const result: Property | undefined = this.caseInsensitivePropertyMap.get(propertyName);
        return result ? result : undefined;
    }

    /**
     * Get the property value that is at the chain of properties in the provided property name
     * stack. If the provided property name stack is empty, then return this value.
     */
    public getPropertyValueFromStack(propertyNameStack: string[]): Value | undefined {
        // tslint:disable-next-line:no-this-assignment
        let result: Value | undefined = <Value | undefined>this;

        while (result && propertyNameStack.length > 0) {
            const objectValue: ObjectValue | undefined = asObjectValue(result);

            // We only handle evaluating properties in objects (e.g. not arrays)
            if (objectValue) {
                const propertyName = propertyNameStack.pop();
                result = propertyName ? objectValue.getPropertyValue(propertyName) : undefined;
            } else {
                return undefined;
            }
        }

        return result;
    }

    /**
     * Get the property names
     */
    public get propertyNames(): string[] {
        return [...this.caseInsensitivePropertyMap.keys()];
    }

    public accept(visitor: Visitor): void {
        visitor.visitObjectValue(this);
    }

    public toFriendlyString(): string {
        return "(object)";
    }

    public get __debugDisplay(): string {
        // tslint:disable-next-line: prefer-template
        return "{" +
            this.properties.map(pv => pv.nameValue.toString() + ':' + (pv.value instanceof Value ? pv.value.__debugDisplay : String(pv.value))).join(",")
            + "}";
    }
}

/**
 * A property in a JSON ObjectValue.
 */
export class Property extends Value {
    constructor(span: language.Span, private _name: StringValue, private _value: Value | undefined) {
        super(span);
    }

    public get valueKind(): ValueKind {
        return ValueKind.PropertyValue;
    }

    /**
     * The name of the property.
     */
    public get nameValue(): StringValue {
        return this._name;
    }

    /**
     * The value of the property.
     */
    public get value(): Value | undefined {
        return this._value;
    }

    public accept(visitor: Visitor): void {
        visitor.visitProperty(this);
    }

    public toFriendlyString(): string {
        return "(property)";
    }

    public get __debugDisplay(): string {
        // tslint:disable-next-line: prefer-template
        return this._name.quotedValue + ":" + (this.value instanceof Value ? this.value.__debugDisplay : String(this.value));
    }
}

/**
 * The properties that are assigned to an Object.
 */
export interface Properties {
    [key: string]: Value;
}

/**
 * A JSON array that contains elements.
 */
export class ArrayValue extends Value {
    constructor(span: language.Span, private _elements: Value[]) {
        super(span);
        assert(_elements);
    }

    public get valueKind(): ValueKind {
        return ValueKind.ArrayValue;
    }

    /**
     * The elements contained in this Array.
     */
    public get elements(): Value[] {
        return this._elements;
    }

    /**
     * The number of elements in this Array.
     */
    public get length(): number {
        return this._elements.length;
    }

    public accept(visitor: Visitor): void {
        visitor.visitArrayValue(this);
    }

    public toFriendlyString(): string {
        return "(array)";
    }

    public get __debugDisplay(): string {
        // tslint:disable-next-line: prefer-template
        return "[" +
            this.elements.map(e => e.__debugDisplay).join(",")
            + "]";
    }
}

/**
 * A JSON boolean that can be either true or false.
 */
export class BooleanValue extends Value {
    constructor(span: language.Span, private _value: boolean) {
        super(span);
    }

    public get valueKind(): ValueKind {
        return ValueKind.BooleanValue;
    }

    /**
     * The boolean value of this JSON Boolean.
     */
    public toBoolean(): boolean {
        return this._value;
    }

    public toString(): string {
        return this._value.toString();
    }

    public accept(visitor: Visitor): void {
        visitor.visitBooleanValue(this);
    }

    public toFriendlyString(): string {
        return this.toString();
    }
}

/**
 * A JSON quoted string.
 */
export class StringValue extends Value {
    private _unquotedValue: string;

    constructor(quotedSpan: language.Span, private _quotedValue: string) {
        super(quotedSpan);
        this._unquotedValue = utilities.unquote(_quotedValue);
    }

    public get valueKind(): ValueKind {
        return ValueKind.StringValue;
    }

    public get unquotedSpan(): language.Span {
        return new language.Span(this.startIndex + 1, this._unquotedValue.length);
    }

    public get unquotedValue(): string {
        return this._unquotedValue;
    }

    public get quotedValue(): string {
        return this._quotedValue;
    }

    public toString(): string { // CONSIDER: remove in favor of unquotedValue
        return this._unquotedValue;
    }

    public accept(visitor: Visitor): void {
        visitor.visitStringValue(this);
    }

    public toFriendlyString(): string {
        return this.toString();
    }
}

/**
 * A JSON number.
 */
export class NumberValue extends Value {
    constructor(span: language.Span, private _text: string) {
        super(span);
    }

    public get valueKind(): ValueKind {
        return ValueKind.NumberValue;
    }

    public toString(): string {
        return this._text.toString();
    }

    public accept(visitor: Visitor): void {
        visitor.visitNumberValue(this);
    }

    public toFriendlyString(): string {
        return this.toString();
    }
}

/**
 * A JSON null value.
 */
export class NullValue extends Value {
    constructor(span: language.Span) {
        super(span);
    }

    public get valueKind(): ValueKind {
        return ValueKind.NullValue;
    }

    public toString(): string {
        return "null";
    }

    public accept(visitor: Visitor): void {
        visitor.visitNullValue(this);
    }

    public toFriendlyString(): string {
        return this.toString();
    }
}

/**
 * The result of parsing a JSON string.
 */
export class ParseResult {
    private readonly _debugText: string; // Used only for debugging - copy of the original text being parsed

    constructor(private _tokens: Token[], private _commentTokens: Token[], private _lineLengths: number[], private _value: Value | undefined, text: string, public readonly commentCount: number) {
        nonNullValue(_tokens, "_tokens");
        nonNullValue(_lineLengths, "_lineLengths");

        this._debugText = text;
        this._debugText = this._debugText; // Make compiler happy
    }

    public get tokenCount(): number {
        return this._tokens.length;
    }

    public get tokens(): Token[] {
        return this._tokens;
    }

    public get commentTokens(): Token[] {
        return this._commentTokens;
    }

    public get commentTokenCount(): number {
        return this._commentTokens.length;
    }

    public get lineLengths(): number[] {
        return this._lineLengths;
    }

    // Does no necessarily make a copy
    public getTokens(commentBehavior: Comments): Token[] {
        if (commentBehavior === Comments.includeCommentTokens) {
            const tokens = this.tokens.concat(this.commentTokens);
            tokens.sort((a, b) => a.span.startIndex - b.span.startIndex);
            return tokens;
        } else {
            return this.tokens;
        }
    }

    // Does no necessarily make a copy
    public getTokensInSpan(span: language.Span, commentsBehavior: Comments): Token[] {
        const results: Token[] = [];
        const tokens = this.getTokens(commentsBehavior);
        const spanStartIndex = span.startIndex;
        const spanEndIndex = span.endIndex;

        for (let token of tokens) {
            if (token.span.endIndex >= spanStartIndex) {
                if (token.span.startIndex > spanEndIndex) {
                    break;
                }

                results.push(token);
            }
        }

        return results;
    }

    public getLastTokenOnLine(line: number, commentBehavior: Comments = Comments.ignoreCommentTokens): Token | undefined {
        const startOfLineIndex = this.getCharacterIndex(line, 0);
        const lastLine = this.lineLengths.length - 1;

        const tokens = this.getTokens(commentBehavior);

        let lastSeenToken;

        if (line === lastLine) {
            // On last line, check the very last token
            lastSeenToken = tokens[tokens.length - 1];
        } else {
            const nextLineIndex = this.getCharacterIndex(line + 1, 0);

            for (let token of tokens) {
                if (token.span.startIndex >= nextLineIndex) {
                    break;
                }
                lastSeenToken = token;
            }
        }

        if (lastSeenToken && lastSeenToken.span.endIndex >= startOfLineIndex) {
            return lastSeenToken;
        } else {
            return undefined;
        }
    }

    /**
     * Get the highest character index of any line in this JSON parse result.
     */
    public get maxCharacterIndex(): number {
        let result = 0;
        for (let lineLength of this._lineLengths) {
            result += lineLength;
        }
        return result;
    }

    // The top-level value, if any (e.g. the JSON could be blank or only comments)
    public get value(): Value | undefined {
        return this._value;
    }

    /**
     * Get the character index from the stream's perspective from the provided
     * line and column indexes.
     */
    public getCharacterIndex(lineIndex: number, columnIndex: number): number {
        // tslint:disable-next-line:max-line-length
        assert(0 <= lineIndex, `Cannot get a character index for a negative line index (${lineIndex}).`);
        // tslint:disable-next-line:max-line-length
        assert(lineIndex < this.lineLengths.length, `Cannot get a character index for a line index greater than the number of parsed lines (lineIndex: ${lineIndex}, lines parsed: ${this.lineLengths.length}).`);
        // tslint:disable-next-line:max-line-length
        assert(0 <= columnIndex, `Cannot get a character index for a negative columnIndex (${columnIndex}).`);
        // tslint:disable-next-line:max-line-length
        assert(columnIndex <= this.getMaxColumnIndex(lineIndex), `Cannot get a character index for a columnIndex (${columnIndex}) that is greater than the lineIndex's (${lineIndex}) line max column index (${this.getMaxColumnIndex(lineIndex)}).`);

        let characterIndex = columnIndex;
        for (let i = 0; i < lineIndex; ++i) {
            characterIndex += this.lineLengths[i];
        }

        assert(0 <= characterIndex);

        return characterIndex;
    }

    public getPositionFromCharacterIndex(characterIndex: number): language.Position {
        assert(0 <= characterIndex);

        let line: number = 0;
        let column: number = 0;

        let remainingChars: number = characterIndex;

        for (let lineLength of this.lineLengths) {
            if (lineLength <= remainingChars) {
                ++line;
                remainingChars -= lineLength;
            } else {
                // Reached the line with the character index
                column = remainingChars;
                break;
            }
        }

        return new language.Position(line, column);
    }

    public getMaxColumnIndex(lineIndex: number): number {
        assert(0 <= lineIndex && lineIndex < this.lineLengths.length);

        let maxColumnIndex: number = this.lineLengths[lineIndex];
        if (lineIndex < this.lineLengths.length - 1) {
            --maxColumnIndex;
        }

        return maxColumnIndex;
    }

    private static getToken(tokens: Token[], tokenIndex: number): Token {
        // tslint:disable-next-line:max-line-length
        assert(0 <= tokenIndex && tokenIndex < tokens.length, `The tokenIndex (${tokenIndex}) must always be between 0 and the token count - 1 (${tokens.length - 1}).`);

        return tokens[tokenIndex];
    }

    private static getLastToken(tokens: Token[]): Token | undefined {
        // Returns undefined if no tokens
        return tokens[tokens.length - 1];
    }

    // Unlike getTokenAtCharacterIndex by itself, also handles the
    // case of being at the end of a line comment ("// comment")
    public getCommentTokenAtDocumentIndex(
        characterIndex: number,
        containsBehavior: language.Contains
    ): Token | undefined {
        // Check if we're inside a comment token
        const token = this.getTokenAtCharacterIndex(
            characterIndex,
            Comments.includeCommentTokens);
        if (token?.type === TokenType.Comment) {
            switch (containsBehavior) {
                case language.Contains.strict:
                    return token; //asdf

                case language.Contains.extended:
                    return token; //asdf

                case language.Contains.enclosed: //asdf test
                    if (token.span.startIndex === characterIndex) {
                        return undefined;
                    }
                    // if (characterIndex > token.span.endIndex) {
                    //     return undefined; //asdf not getting hit
                    // }
                    return token;

                default:
                    assertNever(containsBehavior);
            }
        }

        // Are we after a line comment on the same line (if we're on the \r or \n after
        //   a line comment, the enclosing token is a whitespace token)
        const line = this.getPositionFromCharacterIndex(characterIndex).line;
        const lastTokenOnLineIncludingComments = this.getLastTokenOnLine(
            line,
            Comments.includeCommentTokens);
        if (lastTokenOnLineIncludingComments
            && lastTokenOnLineIncludingComments.type === TokenType.Comment
            && lastTokenOnLineIncludingComments.toString().startsWith('//')
            && lastTokenOnLineIncludingComments.span.startIndex < characterIndex
        ) {
            return lastTokenOnLineIncludingComments;
        }

        return undefined;
    }

    /**
     * Get the JSON Token that contains the provided characterIndex
     * if any (returns undefined if at whitespace or comment)
     * asdf what containsBehavior?
     */
    public getTokenAtCharacterIndex(
        characterIndex: number,
        commentBehavior: Comments = Comments.includeCommentTokens
    ): Token | undefined {
        assert(0 <= characterIndex, `characterIndex (${characterIndex}) cannot be negative.`);

        const tokens = this.getTokens(commentBehavior);
        return ParseResult.getTokenAtCharacterIndex(tokens, characterIndex);
    }

    private static getTokenAtCharacterIndex(tokens: Token[], characterIndex: number): Token | undefined {
        assert(0 <= characterIndex, `characterIndex (${characterIndex}) cannot be negative.`);

        const tokenCount: number = tokens.length;
        const lastToken: Token | undefined = ParseResult.getLastToken(tokens);

        let token: Token | undefined;
        // tslint:disable-next-line: strict-boolean-expressions
        if (!!lastToken && lastToken.span.afterEndIndex === characterIndex) {
            token = lastToken;
        } else {
            // Perform a binary search
            let minTokenIndex = 0;
            let maxTokenIndex = tokenCount - 1;
            while (!token && minTokenIndex <= maxTokenIndex) {
                let midTokenIndex = Math.floor((maxTokenIndex + minTokenIndex) / 2);
                let currentToken = ParseResult.getToken(tokens, midTokenIndex);
                let currentTokenSpan = currentToken.span;

                if (characterIndex < currentTokenSpan.startIndex) {
                    maxTokenIndex = midTokenIndex - 1;
                } else if (currentTokenSpan.endIndex < characterIndex) {
                    minTokenIndex = midTokenIndex + 1;
                } else {
                    token = currentToken;
                }
            }
        }

        return token;
    }

    public getValueAtCharacterIndex(characterIndex: number, containsBehavior: language.Contains): Value | undefined {
        assert(0 <= characterIndex, `characterIndex (${characterIndex}) cannot be negative.`);

        let result: Value | undefined;

        // Find the Value at the given character index by starting at the outside and finding the innermost
        //   child that contains the point.
        if (this.value && this.value.span.contains(characterIndex, containsBehavior)) {
            let current: Value = this.value;

            while (!result) {
                const currentValue: Value = current;

                // tslint:disable-next-line:no-suspicious-comment
                // TODO: This should not depend on knowledge of the various value types' implementations
                if (currentValue instanceof Property) {
                    if (currentValue.nameValue.span.contains(characterIndex, containsBehavior)) {
                        current = currentValue.nameValue;
                    } else if (currentValue.value && currentValue.value.span.contains(characterIndex, containsBehavior)) {
                        current = currentValue.value;
                    }
                } else if (currentValue instanceof ObjectValue) {
                    assert(currentValue.properties);
                    for (const property of currentValue.properties) {
                        assert(property);
                        if (property.span.contains(characterIndex, containsBehavior)) {
                            current = property;
                        }
                    }
                } else if (currentValue instanceof ArrayValue) {
                    assert(currentValue.elements);
                    for (const element of currentValue.elements) {
                        assert(element);
                        if (element.span.contains(characterIndex, containsBehavior)) {
                            current = element;
                        }
                    }
                }

                if (current === currentValue) {
                    result = current;
                }
            }
        }

        return result;
    }
}

/**
 * Parse the provided JSON string.
 */
export function parse(stringValue: string): ParseResult {
    nonNullValue(stringValue, "stringValue");

    const tokens: Token[] = [];
    const commentTokens: Token[] = [];
    const jt = new Tokenizer(stringValue);
    const value: Value | undefined = parseValue(jt, tokens, commentTokens);

    // Read the rest of the Tokens so that they will be put into the tokens array.
    while (jt.current) {
        next(jt, tokens, commentTokens);
    }

    return new ParseResult(tokens, commentTokens, jt.lineLengths, value, stringValue, jt.commentsCount);
}

/**
 * Read a JSON object from the provided tokenizer's stream of Tokens.
 * All of the Tokens that are read will be placed into the provided
 * tokens arrays.
 */
function parseValue(tokenizer: Tokenizer, tokens: Token[], commentTokens: Token[]): Value | undefined {
    let value: Value | undefined;

    if (!tokenizer.hasStarted()) {
        next(tokenizer, tokens, commentTokens);
    }

    if (tokenizer.current) {
        switch (tokenizer.current.type) {
            case TokenType.QuotedString:
                value = new StringValue(tokenizer.current.span, tokenizer.current.toString());
                next(tokenizer, tokens, commentTokens);
                break;

            case TokenType.Number:
                value = new NumberValue(tokenizer.current.span, tokenizer.current.toString());
                next(tokenizer, tokens, commentTokens);
                break;

            case TokenType.Boolean:
                value = new BooleanValue(tokenizer.current.span, tokenizer.current.toString() === "true");
                next(tokenizer, tokens, commentTokens);
                break;

            case TokenType.LeftCurlyBracket:
                value = parseObject(tokenizer, tokens, commentTokens);
                break;

            case TokenType.LeftSquareBracket:
                value = parseArray(tokenizer, tokens, commentTokens);
                break;

            case TokenType.Null:
                value = new NullValue(tokenizer.current.span);
                next(tokenizer, tokens, commentTokens);
                break;
        }
    }

    return value;
}

function parseObject(tokenizer: Tokenizer, tokens: Token[], commentTokens: Token[]): ObjectValue {
    if (!tokenizer.current) {
        throw new Error("Precondition failed");
    }

    let objectSpan: language.Span = tokenizer.current.span;
    const properties: Property[] = [];

    next(tokenizer, tokens, commentTokens);

    let propertySpan: language.Span | undefined;
    let propertyName: StringValue | undefined;
    let foundColon: boolean = false;
    // tslint:disable-next-line: strict-boolean-expressions
    while (tokenizer.current) {
        objectSpan = objectSpan.union(tokenizer.current.span);

        if (tokenizer.current.type === TokenType.RightCurlyBracket) {
            next(tokenizer, tokens, commentTokens);
            break;
        } else if (!propertyName) {
            if (tokenizer.current.type === TokenType.QuotedString) {
                propertySpan = tokenizer.current.span;
                propertyName = new StringValue(propertySpan, tokenizer.current.toString());
                next(tokenizer, tokens, commentTokens);
            } else {
                next(tokenizer, tokens, commentTokens);
            }
        } else if (!foundColon) {
            propertySpan = propertySpan ? propertySpan.union(tokenizer.current.span) : tokenizer.current.span;
            if (tokenizer.current.type === TokenType.Colon) {
                foundColon = true;
                next(tokenizer, tokens, commentTokens);
            } else {
                propertyName = undefined;
            }
        } else {
            // Shouldn't be able to reach here without these two assertions being true
            assert(foundColon);
            assert(propertyName);

            const propertyValue: Value | undefined = parseValue(tokenizer, tokens, commentTokens);
            if (propertyValue) {
                propertySpan = propertySpan ? propertySpan.union(propertyValue.span) : propertyValue.span;
                objectSpan = objectSpan.union(propertyValue.span);
            }

            // tslint:disable-next-line: strict-boolean-expressions no-non-null-assertion // Asserted propertyName
            properties.push(new Property(propertySpan || objectSpan, propertyName!, propertyValue));

            propertySpan = undefined;
            propertyName = undefined;
            foundColon = false;
        }
    }

    return new ObjectValue(objectSpan, properties);
}

function parseArray(tokenizer: Tokenizer, tokens: Token[], commentTokens: Token[]): ArrayValue {
    if (!tokenizer.current) {
        throw new Error("Precondition failed");
    }

    let span: language.Span = tokenizer.current.span;
    const elements: Value[] = [];

    next(tokenizer, tokens, commentTokens);

    let expectElement: boolean = true;
    // tslint:disable-next-line: strict-boolean-expressions
    while (tokenizer.current) {
        span = span.union(tokenizer.current.span);

        if (tokenizer.current.type === TokenType.RightSquareBracket) {
            next(tokenizer, tokens, commentTokens);
            break;
        } else if (expectElement) {
            const element: Value | undefined = parseValue(tokenizer, tokens, commentTokens);
            if (element) {
                span = span.union(element.span);

                elements.push(element);
                expectElement = false;
            } else {
                next(tokenizer, tokens, commentTokens);
            }
        } else {
            if (tokenizer.current.type === TokenType.Comma) {
                expectElement = true;
            }
            next(tokenizer, tokens, commentTokens);
        }
    }

    return new ArrayValue(span, elements);
}

function next(tokenizer: Tokenizer, tokens: Token[], commentTokens: Token[]): void {
    while (tokenizer.moveNext()) {
        // tslint:disable-next-line: no-non-null-assertion // Guaranteed by tokenizer.moveNext() returning true
        const current: Token = tokenizer.current!;
        if (current.type === TokenType.Comment) {
            commentTokens.push(current);
        } else if (current.type !== TokenType.Whitespace) {
            tokens.push(current);
            break;
        }
    }
}

/**
 * Traverses every node in a given Value tree
 */
export abstract class Visitor {
    public visitProperty(property: Property | undefined): void {
        if (property) {
            assert(property.nameValue);
            property.nameValue.accept(this);

            if (property.value) {
                property.value.accept(this);
            }
        }
    }

    public visitStringValue(stringValue: StringValue): void {
        // Nothing to do
    }

    public visitNumberValue(numberValue: NumberValue): void {
        // Nothing to do
    }

    public visitBooleanValue(booleanValue: BooleanValue): void {
        // Nothing to do
    }

    public visitObjectValue(objectValue: ObjectValue | undefined): void {
        if (objectValue) {
            for (const property of objectValue.properties) {
                property.accept(this);
            }
        }
    }

    public visitArrayValue(arrayValue: ArrayValue | undefined): void {
        if (arrayValue) {
            for (const element of arrayValue.elements) {
                assert(element);
                element.accept(this);
            }
        }
    }

    public visitNullValue(nullValue: NullValue): void {
        // Nothing to do
    }
}
