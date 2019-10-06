// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------
// tslint:disable-next-line:no-suspicious-comment
// CONSIDER: move to multiple files
// TLE = Template Language Expression

// tslint:disable:no-unnecessary-class // Grandfathered in
// tslint:disable:switch-default // Grandfathered in
// tslint:disable:max-classes-per-file // Grandfathered in

import * as assets from "./AzureRMAssets";
import { __debugMarkSubstring } from "./debugMarkStrings";
import { assert } from "./fixed_assert";
import * as Json from "./JSON";
import * as language from "./Language";
import { PositionContext } from "./PositionContext";
import { TemplateScope } from "./TemplateScope";
import * as basic from "./Tokenizer";
import * as Utilities from "./Utilities";

export function asStringValue(value: Value | null): StringValue | null {
    return value instanceof StringValue ? value : null;
}

export function asNumberValue(value: Value | null): NumberValue | null {
    return value instanceof NumberValue ? value : null;
}

export function asArrayAccessValue(value: Value | null): ArrayAccessValue | null {
    return value instanceof ArrayAccessValue ? value : null;
}

export function asFunctionCallValue(value: Value | null): FunctionCallValue | null {
    return value instanceof FunctionCallValue ? value : null;
}

export function asPropertyAccessValue(value: Value | null): PropertyAccess | null {
    return value instanceof PropertyAccess ? value : null;
}

/**
 * The Value class is the generic base class that all other TLE values inherit from.
 */
export abstract class Value {
    private _parent: ParentValue | null;

    public get parent(): ParentValue | null {
        return this._parent;
    }

    public set parent(parent: ParentValue | null) {
        this._parent = parent;
    }

    public abstract getSpan(): language.Span;

    public abstract contains(characterIndex: number): boolean;

    public abstract toString(): string;

    public abstract accept(visitor: Visitor): void;

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.toString();
    }
}

export abstract class ParentValue extends Value {
}

/**
 * A TLE value representing a string.  This can be either an entire JSON string that
 * is not an expression (e.g. "string value") or a single-quoted string value inside
 * of a JSON string that is an expression (e.g. "[concat('string value')]").
 *
 * CONSIDER: Differentiate between a string value that is an entire string vs a
 * single-quoted string inside an expression string
 */
export class StringValue extends Value {
    constructor(private _token: Token) {
        super();

        assert(_token);
        assert.equal(TokenType.QuotedString, _token.getType());
    }

    public get token(): Token {
        return this._token;
    }

    private get length(): number {
        return this.toString().length;
    }

    private get quoteCharacter(): string {
        return this.toString()[0];
    }

    public getSpan(): language.Span {
        return this._token.span;
    }

    public get unquotedSpan(): language.Span {
        return new language.Span(this.getSpan().startIndex + 1, this.length - (this.hasCloseQuote() ? 2 : 1));
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, true);
    }

    public hasCloseQuote(): boolean {
        return this.length > 1 && this.toString()[this.length - 1] === this.quoteCharacter;
    }

    /**
     * Checks whether the current position is at the argument of a 'parameters' function call
     */
    public isParametersArgument(): boolean {
        return this.isBuiltinFunctionArgument("parameters");
    }

    /**
     * Checks whether the current position is at the argument of a 'variables' function call
     */
    public isVariablesArgument(): boolean {
        return this.isBuiltinFunctionArgument("variables");
    }

    /**
     * Checks whether the current position is at the argument of a call to the
     * built-in function with the given name
     */
    private isBuiltinFunctionArgument(functionName: string): boolean {
        const parent: Value | null = this.parent;
        return !!parent &&
            parent instanceof FunctionCallValue &&
            parent.isCallToBuiltinWithName(functionName) &&
            parent.argumentExpressions[0] === this;
    }

    public accept(visitor: Visitor): void {
        visitor.visitString(this);
    }

    public toString(): string {
        return this._token.stringValue;
    }
}

/**
 * A TLE value that represents a number.
 */
export class NumberValue extends Value {
    constructor(private _token: Token) {
        super();

        assert(_token);
        assert.deepEqual(TokenType.Number, _token.getType());
    }

    public get token(): Token {
        return this._token;
    }

    public getSpan(): language.Span {
        return this._token.span;
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, true);
    }

    public accept(visitor: Visitor): void {
        visitor.visitNumber(this);
    }

    public toString(): string {
        return this._token.stringValue;
    }
}

/**
 * A TLE value that represents an array access expression.
 */
export class ArrayAccessValue extends ParentValue {
    constructor(private _source: Value, private _leftSquareBracketToken: Token, private _indexValue: Value | null, private _rightSquareBracketToken: Token | null) {
        super();

        assert(_source);
        assert(_leftSquareBracketToken);
        assert.deepEqual(TokenType.LeftSquareBracket, _leftSquareBracketToken.getType());
        assert(undefined !== _indexValue);
        assert(undefined !== _rightSquareBracketToken);
        assert(_rightSquareBracketToken === null || _rightSquareBracketToken.getType() === TokenType.RightSquareBracket);

        this._source.parent = this;

        if (this._indexValue) {
            this._indexValue.parent = this;
        }
    }

    /**
     * The expression that is being indexed (source[index]).
     */
    public get source(): Value {
        return this._source;
    }

    /**
     * The token for the left square bracket.
     */
    public get leftSquareBracketToken(): Token {
        return this._leftSquareBracketToken;
    }

    /**
     * The expression that is being used as an index value (source[index]).
     */
    public get indexValue(): Value | null {
        return this._indexValue;
    }

    /**
     * The token for the right square bracket. This can be null if the array access doesn't have a
     * closing right square bracket.
     */
    public get rightSquareBracketToken(): Token | null {
        return this._rightSquareBracketToken;
    }

    /**
     * The span that contains this entire array access expression.
     */
    public getSpan(): language.Span {
        let result = this._source.getSpan();

        if (this._rightSquareBracketToken) {
            result = result.union(this._rightSquareBracketToken.span);
        } else if (this._indexValue) {
            result = result.union(this._indexValue.getSpan());
        } else {
            result = result.union(this._leftSquareBracketToken.span);
        }

        return result;
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, !this._rightSquareBracketToken);
    }

    public accept(visitor: Visitor): void {
        visitor.visitArrayAccess(this);
    }

    public toString(): string {
        let result: string = `${this._source.toString()}[`;
        if (this._indexValue !== null) {
            result += this._indexValue.toString();
        }
        if (this._rightSquareBracketToken !== null) {
            result += "]";
        }
        return result;
    }
}

/**
 * A TLE value that represents a function call expression.
 */
export class FunctionCallValue extends ParentValue {
    constructor(
        private _namespaceToken: Token | null,
        private _nameToken: Token,
        private _leftParenthesisToken: Token | null,
        private _commaTokens: Token[],
        private _argumentExpressions: (Value | null)[], // Missing args are null
        private _rightParenthesisToken: Token | null
    ) {
        super();

        assert(_nameToken);
        assert(_commaTokens);
        assert(_argumentExpressions);

        for (const argumentExpression of this._argumentExpressions) {
            if (argumentExpression) {
                argumentExpression.parent = this;
            }
        }
    }

    public get isUserDefinedFunction(): boolean {
        return !!this._namespaceToken;
    }

    /**
     * The token for the namespace if it's a user-defined function.
     */
    public get namespaceToken(): Token | null {
        return this._namespaceToken;
    }

    /**
     * The token for the function's name.
     */
    public get nameToken(): Token {
        return this._nameToken;
    }

    public get fullName(): string {
        let result = this._nameToken.stringValue;
        if (this._namespaceToken) {
            result = `${this._namespaceToken.stringValue}.${this._nameToken.stringValue}`;
        }

        return result;
    }

    /**
     * Returns true if this is a function call to the built-in function with the given name
     */
    public isCallToBuiltinWithName(functionName: string): boolean {
        return this.doesNameMatch(null, functionName);
    }

    public doesNameMatch(namespaceName: string | null, name: string): boolean {
        // tslint:disable-next-line: strict-boolean-expressions
        namespaceName = namespaceName || '';
        assert(!!name);

        let thisNamespace = this._namespaceToken ? this._namespaceToken.stringValue : '';
        assert(this.nameToken);

        return thisNamespace.toLowerCase() === namespaceName.toLowerCase() &&
            this.nameToken.stringValue.toLowerCase() === name.toLowerCase();
    }

    public get commaTokens(): Token[] {
        return this._commaTokens;
    }

    // A null expression can indicate a missing parameter (e.g. concat('a', , 'c'))
    public get argumentExpressions(): (Value | null)[] {
        return this._argumentExpressions;
    }

    public get leftParenthesisToken(): Token | null {
        return this._leftParenthesisToken;
    }

    public get rightParenthesisToken(): Token | null {
        return this._rightParenthesisToken;
    }

    public get argumentListSpan(): language.Span | null {
        let result: language.Span | null = null;

        if (this._leftParenthesisToken) {
            result = this._leftParenthesisToken.span;

            if (this._rightParenthesisToken) {
                result = result.union(this._rightParenthesisToken.span);
            } else if (this._argumentExpressions.length > 0 || this._commaTokens.length > 0) {
                for (let i = this._argumentExpressions.length - 1; 0 <= i; --i) {
                    let arg = this._argumentExpressions[i];
                    if (arg !== null) {
                        result = result.union(arg.getSpan());
                        break;
                    }
                }

                if (0 < this.commaTokens.length) {
                    result = result.union(this._commaTokens[this._commaTokens.length - 1].span);
                }
            }
        }

        return result;
    }

    public getSpan(): language.Span {
        return this._nameToken.span
            .union(this.argumentListSpan)
            // tslint:disable-next-line: strict-boolean-expressions
            .union(this._namespaceToken && this._namespaceToken.span);
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, !this._rightParenthesisToken);
    }

    public accept(visitor: Visitor): void {
        visitor.visitFunctionCall(this);
    }

    public toString(): string {
        let result = this.fullName;

        if (this._leftParenthesisToken !== null) {
            result += "(";
        }

        for (let i = 0; i < this._argumentExpressions.length; ++i) {
            const argExpr = this._argumentExpressions[i];

            if (i > 0) {
                result += ", ";
            }
            result += argExpr ? argExpr.toString() : "";
        }

        if (this._rightParenthesisToken !== null) {
            result += ")";
        }

        return result;
    }
}

/**
 * A TLE value representing a property access (source.property).
 */
export class PropertyAccess extends ParentValue {
    // We need to allow creating a property access expresion whether the property name
    //   was correctly given or note, so we can have proper intellisense/etc.
    // I.e., we require the period, but after that might be empty or an error.
    constructor(private _source: Value, private _periodToken: Token, private _nameToken: Token | null) {
        super();

        assert(_source);
        assert(_periodToken);

        this._source.parent = this;
    }

    public get source(): Value {
        return this._source;
    }

    /**
     * Get an array of the names of the property access source values that lead to this property
     * access. The top of the stack is the name of the root-most property access. The bottom of the
     * stack is the name of this PropertyAccess's source.
     */
    public get sourcesNameStack(): string[] {
        const result: string[] = [];

        let propertyAccessSource: PropertyAccess | null = asPropertyAccessValue(this._source);
        while (propertyAccessSource && propertyAccessSource.nameToken) {
            result.push(propertyAccessSource.nameToken.stringValue);
            propertyAccessSource = asPropertyAccessValue(propertyAccessSource.source);
        }

        return result;
    }

    /**
     * Get the root source value of this PropertyAccess as a FunctionValue.
     */
    public get functionSource(): FunctionCallValue | null {
        let currentSource: Value = this._source;
        while (currentSource instanceof PropertyAccess) {
            const propertyAccess: PropertyAccess | null = asPropertyAccessValue(currentSource);
            assert(propertyAccess);
            // tslint:disable-next-line:no-non-null-assertion // Asserted
            currentSource = propertyAccess!.source;
        }
        return asFunctionCallValue(currentSource);
    }

    public get periodToken(): Token {
        return this._periodToken;
    }

    public get nameToken(): Token | null {
        return this._nameToken;
    }

    public getSpan(): language.Span {
        let result = this._source.getSpan();

        if (this._nameToken !== null) {
            result = result.union(this._nameToken.span);
        } else {
            result = result.union(this._periodToken.span);
        }

        return result;
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, true);
    }

    public accept(visitor: Visitor): void {
        visitor.visitPropertyAccess(this);
    }

    public toString(): string {
        let result = `${this._source.toString()}.`;
        if (this._nameToken !== null) {
            result += this._nameToken.stringValue;
        }
        return result;
    }
}

/**
 * A set of functions that pertain to getting highlight character indexes for a TLE string.
 */
export class BraceHighlighter {
    public static getHighlightCharacterIndexes(context: PositionContext): number[] {
        assert(context);

        let highlightCharacterIndexes: number[] = [];

        if (context.tleInfo) {
            let tleParseResult = context.tleInfo.tleParseResult;
            let tleCharacterIndex = context.tleInfo.tleCharacterIndex;

            if (tleParseResult.leftSquareBracketToken !== null && tleParseResult.leftSquareBracketToken.span.startIndex === tleCharacterIndex) {
                BraceHighlighter.addTLEBracketHighlights(highlightCharacterIndexes, tleParseResult);
            } else {
                let tleValue: Value | null = tleParseResult.getValueAtCharacterIndex(tleCharacterIndex);
                if (tleValue instanceof FunctionCallValue) {
                    if (tleValue.leftParenthesisToken !== null && tleValue.leftParenthesisToken.span.startIndex === tleCharacterIndex) {
                        BraceHighlighter.addTLEFunctionHighlights(highlightCharacterIndexes, tleValue);
                    }
                } else if (tleValue instanceof ArrayAccessValue) {
                    if (tleValue.leftSquareBracketToken !== null && tleValue.leftSquareBracketToken.span.startIndex === tleCharacterIndex) {
                        BraceHighlighter.addTLEArrayHighlights(highlightCharacterIndexes, tleValue);
                    }
                }
            }

            let leftOfTLECharacterIndex = tleCharacterIndex - 1;
            if (tleParseResult.rightSquareBracketToken !== null
                && tleParseResult.rightSquareBracketToken.span.startIndex === leftOfTLECharacterIndex
            ) {
                BraceHighlighter.addTLEBracketHighlights(highlightCharacterIndexes, tleParseResult);
            } else if (0 <= leftOfTLECharacterIndex) {
                let tleValue: Value | null = tleParseResult.getValueAtCharacterIndex(leftOfTLECharacterIndex);
                if (tleValue instanceof FunctionCallValue) {
                    if (tleValue.rightParenthesisToken !== null && tleValue.rightParenthesisToken.span.startIndex === leftOfTLECharacterIndex) {
                        BraceHighlighter.addTLEFunctionHighlights(highlightCharacterIndexes, tleValue);
                    }
                } else if (tleValue instanceof ArrayAccessValue) {
                    if (tleValue.rightSquareBracketToken !== null && tleValue.rightSquareBracketToken.span.startIndex === leftOfTLECharacterIndex) {
                        BraceHighlighter.addTLEArrayHighlights(highlightCharacterIndexes, tleValue);
                    }
                }
            }
        }

        return highlightCharacterIndexes;
    }

    private static addTLEBracketHighlights(highlightCharacterIndexes: number[], tleParseResult: ParseResult): void {
        assert(tleParseResult);
        assert(tleParseResult.leftSquareBracketToken);

        // tslint:disable-next-line:no-non-null-assertion // Asserted above
        highlightCharacterIndexes.push(tleParseResult.leftSquareBracketToken!.span.startIndex);
        if (tleParseResult.rightSquareBracketToken !== null) {
            highlightCharacterIndexes.push(tleParseResult.rightSquareBracketToken.span.startIndex);
        }
    }

    private static addTLEFunctionHighlights(highlightCharacterIndexes: number[], tleFunction: FunctionCallValue): void {
        assert(tleFunction);
        assert(tleFunction.leftParenthesisToken);

        // tslint:disable-next-line:no-non-null-assertion // Asserted
        highlightCharacterIndexes.push(tleFunction.leftParenthesisToken!
            .span.startIndex);
        if (tleFunction.rightParenthesisToken !== null) {
            highlightCharacterIndexes.push(tleFunction.rightParenthesisToken.span.startIndex);
        }
    }

    private static addTLEArrayHighlights(highlightCharacterIndexes: number[], tleArrayAccess: ArrayAccessValue): void {
        assert(tleArrayAccess);
        assert(tleArrayAccess.leftSquareBracketToken);

        highlightCharacterIndexes.push(tleArrayAccess.leftSquareBracketToken.span.startIndex);
        if (tleArrayAccess.rightSquareBracketToken !== null) {
            highlightCharacterIndexes.push(tleArrayAccess.rightSquareBracketToken.span.startIndex);
        }
    }
}

/**
 * A generic visitor base class for TLE values.
 */
export abstract class Visitor {
    public visitArrayAccess(tleArrayAccess: ArrayAccessValue | null): void {
        if (tleArrayAccess) {
            assert(tleArrayAccess.source);
            tleArrayAccess.source.accept(this);
            if (tleArrayAccess.indexValue) {
                tleArrayAccess.indexValue.accept(this);
            }
        }
    }

    public visitFunctionCall(tleFunction: FunctionCallValue | null): void {
        if (tleFunction) {
            for (const argumentExpression of tleFunction.argumentExpressions) {
                if (argumentExpression) {
                    argumentExpression.accept(this);
                }
            }
        }
    }

    public visitNumber(tleNumber: NumberValue): void {
        // Nothing to do
    }

    public visitPropertyAccess(tlePropertyAccess: PropertyAccess | null): void {
        if (tlePropertyAccess) {
            assert(tlePropertyAccess.source);
            tlePropertyAccess.source.accept(this);
        }
    }

    public visitString(tleString: StringValue): void {
        // Nothing to do
    }
}

export class FunctionSignatureHelp {
    constructor(private _activeParameterIndex: number, private _functionMetadata: assets.FunctionMetadata) {
    }

    public get activeParameterIndex(): number {
        return this._activeParameterIndex;
    }

    public get functionMetadata(): assets.FunctionMetadata {
        return this._functionMetadata;
    }
}

/**
 * A parser for JSON strings inside a deployment template (whether they contain expressions or not).
 * The given string value must start with a quote (single or double).
 * If there are no square brackets, the expression will be a StringValue representing the entire
 *   JSON (non-expression) string, assuming no errors
 *
 * CONSIDER: Change the following implementation details:
 * Given that the current parser requires a function expression at the top-most level of an expression,
 *   the top-level expression returned will only be a StringValue if there is in fact no expression.
 */
export class Parser {
    // Handles any JSON string, not just those that are actually TLE expressions beginning with bracket
    public static parse(quotedStringValue: string, scope: TemplateScope): ParseResult {
        assert(quotedStringValue, "TLE strings cannot be null.");
        assert(1 <= quotedStringValue.length, "TLE strings must be at least 1 character.");
        assert(Utilities.isQuoteCharacter(quotedStringValue[0]), "The first character in the TLE string to parse must be a quote character.");

        let leftSquareBracketToken: Token | null = null;
        let expression: Value | null = null;
        let rightSquareBracketToken: Token | null = null;
        let errors: language.Issue[] = [];

        if (3 <= quotedStringValue.length && quotedStringValue.substr(1, 2) === "[[") {
            expression = new StringValue(Token.createQuotedString(0, quotedStringValue));
        } else {
            let tokenizer = Tokenizer.fromString(quotedStringValue);
            tokenizer.next();

            if (!tokenizer.current || tokenizer.current.getType() !== TokenType.LeftSquareBracket) {
                // This is just a plain old string (no brackets). Mark its expression as being
                // the string value.
                expression = new StringValue(Token.createQuotedString(0, quotedStringValue));
            } else {
                leftSquareBracketToken = tokenizer.current;
                tokenizer.next();

                while (
                    <Token | null>tokenizer.current
                    && tokenizer.current.getType() !== TokenType.Literal
                    && tokenizer.current.getType() !== TokenType.RightSquareBracket
                ) {
                    errors.push(new language.Issue(tokenizer.current.span, "Expected a literal value."));
                    tokenizer.next();
                }

                expression = Parser.parseExpression(tokenizer, errors);

                while (<Token | null>tokenizer.current) {
                    if (tokenizer.current.getType() === TokenType.RightSquareBracket) {
                        rightSquareBracketToken = tokenizer.current;
                        tokenizer.next();
                        break;
                    } else {
                        errors.push(new language.Issue(tokenizer.current.span, "Expected the end of the string."));
                        tokenizer.next();
                    }
                }

                if (rightSquareBracketToken !== null) {
                    while (<Token | null>tokenizer.current) {
                        errors.push(new language.Issue(tokenizer.current.span, "Nothing should exist after the closing ']' except for whitespace."));
                        tokenizer.next();
                    }
                } else {
                    errors.push(new language.Issue(new language.Span(quotedStringValue.length - 1, 1), "Expected a right square bracket (']')."));
                }

                if (expression === null) {
                    let errorSpan: language.Span = leftSquareBracketToken.span;
                    if (rightSquareBracketToken !== null) {
                        errorSpan = errorSpan.union(rightSquareBracketToken.span);
                    }
                    errors.push(new language.Issue(errorSpan, "Expected a function or property expression."));
                }
            }
        }

        return new ParseResult(leftSquareBracketToken, expression, rightSquareBracketToken, errors, scope);
    }

    private static parseExpression(tokenizer: Tokenizer, errors: language.Issue[]): Value | null {
        let expression: Value;
        if (tokenizer.current) {
            let rootExpression: Value | null = null; // Initial expression

            let token = tokenizer.current;
            let tokenType = token.getType();
            if (tokenType === TokenType.Literal) {
                rootExpression = Parser.parseFunctionCall(tokenizer, errors);
            } else if (tokenType === TokenType.QuotedString) {
                if (!token.stringValue.endsWith(token.stringValue[0])) {
                    errors.push(new language.Issue(token.span, "A constant string is missing an end quote."));
                }
                rootExpression = new StringValue(token);
                tokenizer.next();
            } else if (tokenType === TokenType.Number) {
                rootExpression = new NumberValue(token);
                tokenizer.next();
            } else if (tokenType !== TokenType.RightSquareBracket && tokenType !== TokenType.Comma) {
                errors.push(new language.Issue(token.span, "Template language expressions must start with a function."));
                tokenizer.next();
            }

            if (!rootExpression) {
                return null;
            }

            expression = rootExpression;
        } else {
            return null;
        }

        // Check for property or array accesses off of the root expression
        while (<Token | null>tokenizer.current) {
            if (tokenizer.current.getType() === TokenType.Period) {
                let periodToken = tokenizer.current;
                tokenizer.next();

                let propertyNameToken: Token | null = null;
                let errorSpan: language.Span | null = null;

                if (<Token | null>tokenizer.current) {
                    if (tokenizer.current.getType() === TokenType.Literal) {
                        propertyNameToken = tokenizer.current;
                        tokenizer.next();
                    } else {
                        errorSpan = tokenizer.current.span;

                        let tokenType = tokenizer.current.getType();
                        if (tokenType !== TokenType.RightParenthesis
                            && tokenType !== TokenType.RightSquareBracket
                            && tokenType !== TokenType.Comma
                        ) {
                            tokenizer.next();
                        }
                    }
                } else {
                    errorSpan = periodToken.span;
                }

                if (propertyNameToken === null) {
                    assert(errorSpan);
                    // tslint:disable-next-line: no-non-null-assertion // Asserted
                    errors.push(new language.Issue(errorSpan!, "Expected a literal value."));
                }

                // We go ahead and create a property access expresion whether the property name
                //   was correctly given or not, so we can have proper intellisense/etc.
                expression = new PropertyAccess(expression, periodToken, propertyNameToken);
            } else if (tokenizer.current.getType() === TokenType.LeftSquareBracket) {
                let leftSquareBracketToken: Token = tokenizer.current;
                tokenizer.next();

                let indexValue: Value | null = Parser.parseExpression(tokenizer, errors);

                let rightSquareBracketToken: Token | null = null;
                if (<Token | null>tokenizer.current && tokenizer.current.getType() === TokenType.RightSquareBracket) {
                    rightSquareBracketToken = tokenizer.current;
                    tokenizer.next();
                }

                expression = new ArrayAccessValue(expression, leftSquareBracketToken, indexValue, rightSquareBracketToken);
            } else {
                break;
            }
        }

        return expression;
    }

    // tslint:disable-next-line:cyclomatic-complexity max-func-body-length // CONSIDER: refactor
    private static parseFunctionCall(tokenizer: Tokenizer, errors: language.Issue[]): FunctionCallValue {
        assert(tokenizer);
        assert(tokenizer.current, "tokenizer must have a current token.");
        // tslint:disable-next-line:no-non-null-assertion // Asserted
        assert.deepEqual(TokenType.Literal, tokenizer.current!.getType(), "tokenizer's current token must be a literal.");
        assert(errors);

        let namespaceToken: Token | null = null;
        let nameToken: Token;

        // tslint:disable-next-line:no-non-null-assertion // Asserted
        let firstToken: Token = tokenizer.current!;
        tokenizer.next();

        // Check for <namespace>.<functionname>
        if (tokenizer.current && tokenizer.current.getType() === TokenType.Period) {
            // It's a user-defined function because it has a namespace before the function name
            let periodToken = tokenizer.current;
            namespaceToken = firstToken;
            tokenizer.next();

            // Get the function name following the period
            if (tokenizer.hasCurrent() && tokenizer.current.getType() === TokenType.Literal) {
                nameToken = tokenizer.current;
                tokenizer.next();
            } else {
                errors.push(new language.Issue(periodToken.span, "Expected user-defined function name."));
                // Badly formed, but we need at least a nameToken, so pretend the period isn't there
                [namespaceToken, nameToken] = [null, firstToken];
            }
        } else {
            nameToken = firstToken;
        }

        let leftParenthesisToken: Token | null = null;
        let rightParenthesisToken: Token | null = null;
        let commaTokens: Token[] = [];
        let argumentExpressions: (Value | null)[] = [];

        if (tokenizer.current) {
            // tslint:disable-next-line: strict-boolean-expressions // False positive
            while (tokenizer.current) {
                if (tokenizer.current.getType() === TokenType.LeftParenthesis) {
                    leftParenthesisToken = tokenizer.current;
                    tokenizer.next();
                    break;
                } else if (tokenizer.current.getType() === TokenType.RightSquareBracket) {
                    errors.push(new language.Issue(nameToken.span, "Missing function argument list."));
                    break;
                } else {
                    errors.push(new language.Issue(tokenizer.current.span, "Expected the end of the string."));
                    tokenizer.next();
                }
            }
        } else {
            errors.push(new language.Issue(nameToken.span, "Missing function argument list."));
        }

        if (tokenizer.hasCurrent()) {
            let expectingArgument: boolean = true;

            while (tokenizer.current) {
                if (tokenizer.current.getType() === TokenType.RightParenthesis || tokenizer.current.getType() === TokenType.RightSquareBracket) {
                    break;
                } else if (expectingArgument) {
                    let expression = Parser.parseExpression(tokenizer, errors);
                    if (expression === null && tokenizer.hasCurrent() && tokenizer.current.getType() === TokenType.Comma) {
                        errors.push(new language.Issue(tokenizer.current.span, "Expected a constant string, function, or property expression."));
                    }
                    argumentExpressions.push(expression);
                    expectingArgument = false;
                } else if (tokenizer.current.getType() === TokenType.Comma) {
                    expectingArgument = true;
                    commaTokens.push(tokenizer.current);
                    tokenizer.next();
                } else {
                    errors.push(new language.Issue(tokenizer.current.span, "Expected a comma (',')."));
                    tokenizer.next();
                }
            }

            if (Parser.isMissingArgument(expectingArgument, leftParenthesisToken, argumentExpressions.length, tokenizer)) {
                argumentExpressions.push(null);
                let errorSpan: language.Span;
                if (tokenizer.current) {
                    errorSpan = tokenizer.current.span;
                } else {
                    assert(0 < commaTokens.length);

                    errorSpan = commaTokens[commaTokens.length - 1].span;
                }
                errors.push(new language.Issue(errorSpan, "Expected a constant string, function, or property expression."));
            }
        } else if (leftParenthesisToken !== null) {
            errors.push(new language.Issue(leftParenthesisToken.span, "Expected a right parenthesis (')')."));
        }

        if (tokenizer.current) {
            switch (tokenizer.current.getType()) {
                case TokenType.RightParenthesis:
                    rightParenthesisToken = tokenizer.current;
                    tokenizer.next();
                    break;

                case TokenType.RightSquareBracket:
                    if (leftParenthesisToken !== null) {
                        errors.push(new language.Issue(tokenizer.current.span, "Expected a right parenthesis (')')."));
                    }
                    break;
            }
        }

        return new FunctionCallValue(namespaceToken, nameToken, leftParenthesisToken, commaTokens, argumentExpressions, rightParenthesisToken);
    }

    private static isMissingArgument(
        expectingArgument: boolean,
        leftParenthesisToken: Token | null,
        existingArguments: number,
        tokenizer: Tokenizer
    ): boolean {
        let result = false;

        if (expectingArgument && leftParenthesisToken && 0 < existingArguments) {
            if (!tokenizer.current) {
                result = true;
            } else {
                result = tokenizer.current.getType() === TokenType.RightParenthesis ||
                    tokenizer.current.getType() === TokenType.RightSquareBracket;
            }
        }

        return result;
    }
}

/**
 * The result of parsing a TLE string.
 */
export class ParseResult {
    constructor(
        private _leftSquareBracketToken: Token | null,
        private _expression: Value | null,
        private _rightSquareBracketToken: Token | null,
        private _errors: language.Issue[],
        public readonly scope: TemplateScope
    ) {
        assert(_errors);
    }

    public get leftSquareBracketToken(): Token | null {
        return this._leftSquareBracketToken;
    }

    public get rightSquareBracketToken(): Token | null {
        return this._rightSquareBracketToken;
    }

    public get expression(): Value | null {
        return this._expression;
    }

    public get errors(): language.Issue[] {
        return this._errors;
    }

    public getValueAtCharacterIndex(characterIndex: number): Value | null {
        let result: Value | null = null;

        let current: Value | null = this._expression;
        if (current && current.contains(characterIndex)) {
            while (!result) {
                const currentValue: Value = current;
                if (currentValue instanceof FunctionCallValue) {
                    assert(currentValue.argumentExpressions);
                    for (const argumentExpression of currentValue.argumentExpressions) {
                        if (argumentExpression && argumentExpression.contains(characterIndex)) {
                            current = argumentExpression;
                            break;
                        }
                    }

                    // If the characterIndex was not in any of the argument expressions, then
                    // it must be somewhere inside this function expression.
                    if (current === currentValue) {
                        result = current;
                    }
                } else if (currentValue instanceof ArrayAccessValue) {
                    if (currentValue.source.contains(characterIndex)) {
                        current = currentValue.source;
                    } else if (currentValue.indexValue && currentValue.indexValue.contains(characterIndex)) {
                        current = currentValue.indexValue;
                    } else {
                        result = current;
                    }
                } else if (currentValue instanceof PropertyAccess) {
                    if (currentValue.source.contains(characterIndex)) {
                        current = currentValue.source;
                    } else {
                        result = current;
                    }
                } else {
                    result = current;
                }
            }
        }

        return result;
    }
}

/**
 * A TLE tokenizer that generates tokens from a TLE string.
 */
export class Tokenizer {
    private _basicTokenizer: basic.Tokenizer;
    private _text: string;

    private _current: Token | null;
    // This offset (+1) is because we trimmed off the initial quote character.
    private _currentTokenStartIndex: number = 1;

    private constructor() {
    }

    public static fromString(stringValue: string): Tokenizer {
        assert(stringValue);
        assert(1 <= stringValue.length);
        assert(Utilities.isQuoteCharacter(stringValue[0]));

        const initialQuoteCharacter: string = stringValue[0];
        const trimmedLength: number = stringValue.length - (stringValue.endsWith(initialQuoteCharacter) ? 2 : 1);
        const trimmedString: string = stringValue.substr(1, trimmedLength);

        const tt = new Tokenizer();
        tt._basicTokenizer = new basic.Tokenizer(trimmedString);
        tt._text = stringValue;
        return tt;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return __debugMarkSubstring(this._text, this._currentTokenStartIndex, this._current ? this._current.toString().length : 0);
    }

    public hasStarted(): boolean {
        return this._basicTokenizer.hasStarted();
    }

    public hasCurrent(): boolean {
        return this._current !== null;
    }

    public get current(): Token | null {
        return this._current;
    }

    private nextBasicToken(): void {
        this._basicTokenizer.moveNext();
    }

    private get currentBasicToken(): basic.Token | undefined {
        return this._basicTokenizer.current();
    }

    public readToken(): Token | null {
        if (this.hasStarted() === false) {
            this.nextBasicToken();
        } else if (this.current) {
            this._currentTokenStartIndex += this.current.length;
        }

        this._current = null;
        const currentBasicToken = this.currentBasicToken;
        if (currentBasicToken) {
            switch (currentBasicToken.getType()) {
                case basic.TokenType.LeftParenthesis:
                    this._current = Token.createLeftParenthesis(this._currentTokenStartIndex);
                    this.nextBasicToken();
                    break;

                case basic.TokenType.RightParenthesis:
                    this._current = Token.createRightParenthesis(this._currentTokenStartIndex);
                    this.nextBasicToken();
                    break;

                case basic.TokenType.LeftSquareBracket:
                    this._current = Token.createLeftSquareBracket(this._currentTokenStartIndex);
                    this.nextBasicToken();
                    break;

                case basic.TokenType.RightSquareBracket:
                    this._current = Token.createRightSquareBracket(this._currentTokenStartIndex);
                    this.nextBasicToken();
                    break;

                case basic.TokenType.Comma:
                    this._current = Token.createComma(this._currentTokenStartIndex);
                    this.nextBasicToken();
                    break;

                case basic.TokenType.Period:
                    this._current = Token.createPeriod(this._currentTokenStartIndex);
                    this.nextBasicToken();
                    break;

                case basic.TokenType.Space:
                case basic.TokenType.Tab:
                case basic.TokenType.CarriageReturn:
                case basic.TokenType.NewLine:
                case basic.TokenType.CarriageReturnNewLine:
                    this._current = Token.createWhitespace(
                        this._currentTokenStartIndex, Utilities.getCombinedText(Json.readWhitespace(this._basicTokenizer)));
                    break;

                case basic.TokenType.DoubleQuote:
                    this._current = Token.createQuotedString(
                        this._currentTokenStartIndex,
                        Utilities.getCombinedText(Json.readQuotedString(this._basicTokenizer)));
                    break;

                case basic.TokenType.SingleQuote:
                    this._current = Token.createQuotedString(
                        this._currentTokenStartIndex,
                        Utilities.getCombinedText(readQuotedTLEString(this._basicTokenizer)));
                    break;

                case basic.TokenType.Dash:
                case basic.TokenType.Digits:
                    this._current = Token.createNumber(
                        this._currentTokenStartIndex,
                        Utilities.getCombinedText(Json.readNumber(this._basicTokenizer)));
                    break;

                default:
                    const literalTokens: basic.Token[] = [currentBasicToken];
                    this.nextBasicToken();

                    while (this.currentBasicToken &&
                        (this.currentBasicToken.getType() === basic.TokenType.Letters ||
                            this.currentBasicToken.getType() === basic.TokenType.Digits ||
                            this.currentBasicToken.getType() === basic.TokenType.Underscore)) {
                        literalTokens.push(this.currentBasicToken);
                        this.nextBasicToken();
                    }

                    this._current = Token.createLiteral(this._currentTokenStartIndex, Utilities.getCombinedText(literalTokens));
                    break;
            }
        }

        return this._current;
    }

    public next(): boolean {
        const result = this.readToken() !== null;
        this.skipWhitespace();
        return result;
    }

    private skipWhitespace(): void {
        while (this._current && this._current.getType() === TokenType.Whitespace) {
            this.next();
        }
    }
}

/**
 * A TLE token.
 */
export class Token {
    private _type: TokenType;
    private _span: language.Span;
    private _stringValue: string;

    private static create(tokenType: TokenType, startIndex: number, stringValue: string): Token {
        assert(typeof tokenType === "number");
        assert(typeof stringValue === "string");

        let t = new Token();
        t._type = tokenType;
        t._span = new language.Span(startIndex, stringValue.length);
        t._stringValue = stringValue;
        return t;
    }

    public getType(): TokenType {
        return this._type;
    }

    public get span(): language.Span {
        return this._span;
    }

    public get length(): number {
        return this._span.length;
    }

    public get stringValue(): string {
        return this._stringValue;
    }

    public static createLeftParenthesis(startIndex: number): Token {
        return Token.create(TokenType.LeftParenthesis, startIndex, "(");
    }

    public static createRightParenthesis(startIndex: number): Token {
        return Token.create(TokenType.RightParenthesis, startIndex, ")");
    }

    public static createLeftSquareBracket(startIndex: number): Token {
        return Token.create(TokenType.LeftSquareBracket, startIndex, "[");
    }

    public static createRightSquareBracket(startIndex: number): Token {
        return Token.create(TokenType.RightSquareBracket, startIndex, "]");
    }

    public static createComma(startIndex: number): Token {
        return Token.create(TokenType.Comma, startIndex, ",");
    }

    public static createPeriod(startIndex: number): Token {
        return Token.create(TokenType.Period, startIndex, ".");
    }

    public static createWhitespace(startIndex: number, stringValue: string): Token {
        assert(stringValue);
        assert(1 <= stringValue.length);

        return Token.create(TokenType.Whitespace, startIndex, stringValue);
    }

    public static createQuotedString(startIndex: number, stringValue: string): Token {
        assert(stringValue != null);
        assert(1 <= stringValue.length);
        assert(Utilities.isQuoteCharacter(stringValue[0]));

        return Token.create(TokenType.QuotedString, startIndex, stringValue);
    }

    public static createNumber(startIndex: number, stringValue: string): Token {
        assert(stringValue != null);
        assert(1 <= stringValue.length);
        assert(stringValue[0] === "-" || Utilities.isDigit(stringValue[0]));

        return Token.create(TokenType.Number, startIndex, stringValue);
    }

    public static createLiteral(startIndex: number, stringValue: string): Token {
        assert(stringValue != null);
        assert(1 <= stringValue.length);

        return Token.create(TokenType.Literal, startIndex, stringValue);
    }
}

/**
 * The different types of tokens that can be produced from a TLE string.
 */
export enum TokenType {
    LeftSquareBracket,
    RightSquareBracket,
    LeftParenthesis,
    RightParenthesis,
    QuotedString,
    Comma,
    Whitespace,
    Literal,
    Period,
    Number,
}

/**
 * Handles reading a single-quoted string inside a JSON-encoded TLE string. Handles both JSON string
 * escape characters (e.g. \n, \") and escaped single quotes in TLE style (two single quotes together,
 * e.g. 'That''s all, folks!')
 */
export function readQuotedTLEString(iterator: Utilities.Iterator<basic.Token>): basic.Token[] {
    assert(iterator.current());
    // tslint:disable-next-line:no-non-null-assertion // Asserted
    assert(iterator.current()!.getType() === basic.TokenType.SingleQuote);
    // tslint:disable-next-line:no-non-null-assertion // Asserted
    const quotedStringTokens: basic.Token[] = [iterator.current()!];
    iterator.moveNext();

    let escaped: boolean = false;
    while (iterator.current()) {
        // tslint:disable-next-line:no-non-null-assertion // guaranteed by while
        const current = iterator.current()!;
        quotedStringTokens.push(current);

        if (escaped) {
            escaped = false;
        } else {
            if (current.getType() === basic.TokenType.Backslash) {
                escaped = true;
            } else if (current.getType() === basic.TokenType.SingleQuote) {
                // If the next token is also a single quote, it's escaped, otherwise it's the
                // end of the string.
                iterator.moveNext();
                const afterCurrent = iterator.current();
                if (!afterCurrent) {
                    break;
                }

                if (afterCurrent.getType() === basic.TokenType.SingleQuote) {
                    escaped = true;
                    continue;
                } else {
                    break;
                }
            }
        }

        iterator.moveNext();
    }

    return quotedStringTokens;
}
