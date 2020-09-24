// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------
// TLE = Template Language Expression
// tslint:disable:no-unnecessary-class // Grandfathered in
// tslint:disable:switch-default // Grandfathered in
// tslint:disable:max-classes-per-file // Grandfathered in
import { templateKeys } from "../../constants";
import { TemplatePositionContext } from "../../documents/positionContexts/TemplatePositionContext";
import { IFunctionMetadata } from "../../documents/templates/IFunctionMetadata";
import { assert } from "../../fixed_assert";
import { __debugMarkRangeInString } from "../../util/debugMarkStrings";
import { Iterator } from "../../util/Iterator";
import { nonNullValue } from "../../util/nonNull";
import * as Utilities from "../../util/strings";
import { Issue } from "../Issue";
import { IssueKind } from "../IssueKind";
import * as Json from "../json/JSON";
import * as basic from "../json/Tokenizer";
import { ContainsBehavior, Span } from "../Span";

type ITleFormatOptions = {
    /**
     * Use a pseudo string interpolation ${var} and ${param} notation similar to Bicep string interpolation
     */
    friendly?: boolean;
    /**
     * Use multi-line formatting if specified
     */
    multiline?: {
        tabSize: number;
    };
};

export function asStringValue(value: Value | undefined): StringValue | undefined {
    return value instanceof StringValue ? value : undefined;
}

export function asNumberValue(value: Value | undefined): NumberValue | undefined {
    return value instanceof NumberValue ? value : undefined;
}

export function asArrayAccessValue(value: Value | undefined): ArrayAccessValue | undefined {
    return value instanceof ArrayAccessValue ? value : undefined;
}

export function asFunctionCallValue(value: Value | undefined): FunctionCallValue | undefined {
    return value instanceof FunctionCallValue ? value : undefined;
}

export function asPropertyAccessValue(value: Value | undefined): PropertyAccess | undefined {
    return value instanceof PropertyAccess ? value : undefined;
}

/**
 * The Value class is the generic base class that all other TLE values inherit from.
 */
export abstract class Value {
    private _parent: ParentValue | undefined; // CONSIDER: should be in constructor?

    public get parent(): ParentValue | undefined {
        return this._parent;
    }

    public set parent(parent: ParentValue | undefined) {
        this._parent = parent;
    }

    public abstract getSpan(): Span;

    // Note: This always includes the character after the Value as well (i.e., uses
    //   Contains.extended).
    public abstract contains(characterIndex: number): boolean;

    // Simple string representation, no formatting
    // CONSIDER: Can we get rid of this?  Or at least define its exact behavior?
    public abstract toString(): string;

    public format(_options: ITleFormatOptions): string {
        return this.formatCore({}, 0);
    }

    public formatCore(_options: ITleFormatOptions, _currentIndent: number): string {
        return this.toString();
    }

    public abstract accept(visitor: Visitor): void;

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.format({ friendly: true });
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
        assert.strictEqual(TokenType.QuotedString, _token.getType());
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

    public getSpan(): Span {
        return this._token.span;
    }

    public get unquotedSpan(): Span {
        return new Span(this.getSpan().startIndex + 1, this.length - (this.hasCloseQuote() ? 2 : 1));
    }

    public get unquotedValue(): string {
        return this.quotedValue.slice(1, this.length - (this.hasCloseQuote() ? 1 : 0));
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, ContainsBehavior.extended);
    }

    public hasCloseQuote(): boolean {
        return this.length > 1 && this.toString()[this.length - 1] === this.quoteCharacter;
    }

    /**
     * Checks whether the current position is at the argument of a 'parameters' function call
     */
    public isParametersArgument(): boolean {
        return this.isBuiltinFunctionArgument(templateKeys.parameters);
    }

    /**
     * Checks whether the current position is at the argument of a 'variables' function call
     */
    public isVariablesArgument(): boolean {
        return this.isBuiltinFunctionArgument(templateKeys.variables);
    }

    /**
     * Checks whether the current position is at the (first) argument of a call to the
     * built-in function with the given name
     */
    private isBuiltinFunctionArgument(functionName: string): boolean {
        const funcCall: FunctionCallValue | undefined = this.getFunctionCallParentOfArgument();
        return !!funcCall && funcCall.isCallToBuiltinWithName(functionName) &&
            funcCall.argumentExpressions[0] === this;
    }

    /**
     * Checks whether the current position is at the argument of a function call, and
     * if so, returns the function call expression
     */
    public getFunctionCallParentOfArgument(): FunctionCallValue | undefined {
        const parent: Value | undefined = this.parent;
        return parent instanceof FunctionCallValue ? parent : undefined;
    }

    public accept(visitor: Visitor): void {
        visitor.visitString(this);
    }

    public get quotedValue(): string {
        return this._token.stringValue;
    }

    public toString(): string {
        return this.quotedValue;
    }

    public formatCore(): string {
        return this.quotedValue;
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

    public getSpan(): Span {
        return this._token.span;
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, ContainsBehavior.extended);
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
    constructor(private _source: Value, private _leftSquareBracketToken: Token, private _indexValue: Value | undefined, private _rightSquareBracketToken: Token | undefined) {
        super();

        assert(_source);
        assert(_leftSquareBracketToken);
        assert.deepStrictEqual(TokenType.LeftSquareBracket, _leftSquareBracketToken.getType());
        assert(!_rightSquareBracketToken || _rightSquareBracketToken.getType() === TokenType.RightSquareBracket);

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
    public get indexValue(): Value | undefined {
        return this._indexValue;
    }

    /**
     * The token for the right square bracket. This can be undefined if the array access doesn't have a
     * closing right square bracket.
     */
    public get rightSquareBracketToken(): Token | undefined {
        return this._rightSquareBracketToken;
    }

    /**
     * The span that contains this entire array access expression.
     */
    public getSpan(): Span {
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
        return this.getSpan().contains(characterIndex, this._rightSquareBracketToken ? ContainsBehavior.strict : ContainsBehavior.extended);
    }

    public accept(visitor: Visitor): void {
        visitor.visitArrayAccess(this);
    }

    public toString(): string {
        let result: string = `${this._source.toString()}[`;
        if (!!this._indexValue) {
            result += this._indexValue.toString();
        }
        if (!!this._rightSquareBracketToken) {
            result += "]";
        }
        return result;
    }

    public formatCore(options: ITleFormatOptions, currentIndent: number): string {
        // Source expression and opening "["
        let result: string = `${this._source.formatCore(options, currentIndent)}[`;

        // Format the index expression
        let indexExpression: string;
        if (!this._indexValue //asdf testpoint
            || this._indexValue instanceof StringValue
            || this._indexValue instanceof NumberValue
        ) {
            // Array index is a simple value (or none)
            indexExpression = this._indexValue?.toString() ?? '';
        } else if (options.multiline) {
            // Multi-line formatting
            indexExpression = `\n${' '.repeat(currentIndent + options.multiline.tabSize)}${this._indexValue.formatCore(options, currentIndent + 2 * options.multiline.tabSize)}`; //asdf refactor
        } else {
            // Single-line formatting
            indexExpression = this._indexValue.formatCore(options, currentIndent);
        }
        result += indexExpression;

        // Closing "]"
        if (!!this._rightSquareBracketToken) {
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
        private readonly _namespaceToken: Token | undefined,
        public readonly periodToken: Token | undefined,
        private readonly _nameToken: Token | undefined,
        private readonly _leftParenthesisToken: Token | undefined,
        private readonly _commaTokens: Token[],
        private readonly _argumentExpressions: (Value | undefined)[], // Missing args are undefined
        private readonly _rightParenthesisToken: Token | undefined
    ) {
        super();

        assert(_namespaceToken || _nameToken, "Must have a namespace or name token");
        assert(!(_namespaceToken && _nameToken) || periodToken, "If we have a namespace and name, we should have a period token");
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
    public get namespaceToken(): Token | undefined {
        return this._namespaceToken;
    }

    /**
     * The namespace name of the function call, if specified
     */
    public get namespace(): string | undefined {
        // tslint:disable-next-line: strict-boolean-expressions
        return (this._namespaceToken && this._namespaceToken.stringValue) || undefined;
    }

    /**
     * The function's name
     */
    public get name(): string | undefined {
        // tslint:disable-next-line: strict-boolean-expressions
        return (this._nameToken && this._nameToken.stringValue) || undefined;
    }

    /**
     * The token for the function's name.
     */
    public get nameToken(): Token | undefined {
        return this._nameToken;
    }

    public get fullName(): string {
        // tslint:disable-next-line: strict-boolean-expressions
        const name: string = this.name || "";

        if (this._namespaceToken) {
            return `${this._namespaceToken.stringValue}.${name}`;
        } else {
            assert(this.nameToken, "We asserted in the constructor that we have to have a namespace or a name");
            // tslint:disable-next-line: no-non-null-assertion
            return this.name!;
        }
    }

    /**
     * The span containing the namespace, period and name (at least some of these will exist)
     */
    public get fullNameSpan(): Span {
        const result: Span | undefined =
            Span.union(
                // tslint:disable-next-line: strict-boolean-expressions
                Span.union(this._namespaceToken && this._namespaceToken.span, this.periodToken && this.periodToken.span),
                // tslint:disable-next-line: strict-boolean-expressions
                this._nameToken && this._nameToken.span
            );

        assert(result, "Should have had at least one of a namespace or a name, therefore span should be non-empty");
        // tslint:disable-next-line: no-non-null-assertion // Asserted
        return result!;
    }

    /**
     * Returns true if this is a function call to the built-in function with the given name
     */
    public isCallToBuiltinWithName(functionName: string): boolean {
        return this.doesNameMatch(undefined, functionName);
    }

    public doesNameMatch(namespaceName: string | undefined, name: string): boolean {
        // tslint:disable-next-line: strict-boolean-expressions
        namespaceName = namespaceName || '';

        if (!this.nameToken || !name) {
            return false;
        }

        let thisNamespace = this._namespaceToken ? this._namespaceToken.stringValue : '';

        return thisNamespace.toLowerCase() === namespaceName.toLowerCase() &&
            this.nameToken.stringValue.toLowerCase() === name.toLowerCase();
    }

    public get commaTokens(): Token[] {
        return this._commaTokens;
    }

    // An undefined expression can indicate a missing parameter (e.g. concat('a', , 'c'))
    public get argumentExpressions(): (Value | undefined)[] {
        return this._argumentExpressions;
    }

    public get leftParenthesisToken(): Token | undefined {
        return this._leftParenthesisToken;
    }

    public get rightParenthesisToken(): Token | undefined {
        return this._rightParenthesisToken;
    }

    public get argumentListSpan(): Span | undefined {
        let result: Span | undefined;

        if (this._leftParenthesisToken) {
            result = this._leftParenthesisToken.span;

            if (this._rightParenthesisToken) {
                result = result.union(this._rightParenthesisToken.span);
            } else if (this._argumentExpressions.length > 0 || this._commaTokens.length > 0) {
                for (let i = this._argumentExpressions.length - 1; 0 <= i; --i) {
                    let arg = this._argumentExpressions[i];
                    if (!!arg) {
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

    public getSpan(): Span {
        return this.fullNameSpan
            .union(this.argumentListSpan);
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, this._rightParenthesisToken ? ContainsBehavior.strict : ContainsBehavior.extended);
    }

    public accept(visitor: Visitor): void {
        visitor.visitFunctionCall(this);
    }

    public toString(): string {
        return this.getStringFromArguments(this.argumentExpressions.map(arg => arg?.toString() ?? ''));
    }

    public formatCore(options: ITleFormatOptions, currentIndent: number): string {
        // Format a function call expression

        const fullNameLC = this.fullName.toLowerCase();
        switch (fullNameLC) {
            case 'concat':
                // Coalesce adjacent string arguments
                return FunctionCallValue.coalesceConcatArguments(this.argumentExpressions, options, currentIndent);

            case 'variables':
            case 'parameters':
                // Use ${name} format for variables/parameters call
                if (this.argumentExpressions.length === 1) {
                    const arg1 = this.argumentExpressions[0];
                    if (arg1 instanceof StringValue) {
                        return `\${${arg1.unquotedValue}}`;
                    }
                }
        }

        let multiline = !!options.multiline;
        const tabSize = options.multiline?.tabSize ?? 0;
        // If there are no arguments or a single simple-valued argument, put expression on single line
        if (this.argumentExpressions.length === 0 //asdf testpoint
            || (this.argumentExpressions.length === 1 &&
                (
                    this.argumentExpressions[0] instanceof StringValue
                    || this.argumentExpressions[0] instanceof NumberValue
                )
            )
        ) {
            multiline = false;
        }

        // Start with the function name
        let result = this.fullName;

        // Left paren
        if (!!this._leftParenthesisToken) {
            result += multiline ? `(\n${' '.repeat(currentIndent + tabSize)}` : '(';
        }

        // Arguments
        for (let i = 0; i < this._argumentExpressions.length; ++i) {
            const argExpr = this._argumentExpressions[i];

            if (i > 0) {
                // tslint:disable-next-line: no-non-null-assertion
                result += multiline ? `,\n${' '.repeat(currentIndent + tabSize)}` : ', ';
            }
            result += argExpr ? argExpr.formatCore(options, currentIndent + tabSize) : ' ';
        }

        // Right paren
        if (!!this._rightParenthesisToken) {
            result += `)`;
        }

        return result;
    }

    private getStringFromArguments(expressionStrings: string[]): string {
        let result = this.fullName;

        if (!!this._leftParenthesisToken) {
            result += "(";
        }

        result += expressionStrings.join(', ');

        if (!!this._rightParenthesisToken) {
            result += ")";
        }

        return result;
    }

    /**
     * Coalesces any adjacent string expressions and returns the simplified concat
     * expression
     */
    private static coalesceConcatArguments(expressions: (Value | undefined)[], options: ITleFormatOptions, currentIndent: number): string {
        if (expressions.length < 2) {
            return expressions[0]?.formatCore(options, currentIndent) ?? '';
        }

        // Coalesce adjacent string literals
        const coalescedExpressions: string[] = [];
        const expressionsLength = expressions.length;
        for (let i = 0; i < expressionsLength; ++i) {
            let currentExpression = expressions[i]?.formatCore(options, currentIndent) ?? '';

            const prevCoalescedExpression = coalescedExpressions[coalescedExpressions.length - 1];
            if (prevCoalescedExpression) {
                // Merge with last coalesced expression if it and the current one are both strings
                if (isString(prevCoalescedExpression) && isString(currentExpression)) {
                    // If both sides are strings, we'll make the concatenation a string by adding single quotes

                    // Don't coalesce if the left-hand string contains a property index, because the property name would
                    //   get the rhs string appended to it
                    // Example: "'${vmProperties}.property'"
                    const previousContainsPropertyIndex = prevCoalescedExpression.match(/[\]})]\.[a-zA-Z0-9]/);
                    if (!previousContainsPropertyIndex) {
                        // Merge previous and current expressions into a single-quoted string
                        coalescedExpressions[coalescedExpressions.length - 1] =
                            `'${Utilities.removeSingleQuotes(prevCoalescedExpression)}${Utilities.removeSingleQuotes(currentExpression)}'`;
                        continue;
                    }
                }
            }

            // Push the current expression unchanged
            coalescedExpressions.push(currentExpression);
        }

        if (coalescedExpressions.length < 2) {
            // Just a single expression left, return it without a concat
            return coalescedExpressions[0];
        }

        // Merge all coalesced expressions using concat
        //asdf multi-line
        return `concat(${coalescedExpressions.join(', ')})`;

        function isString(expression: string): boolean {
            if (Utilities.isSingleQuoted(expression)) {
                return true;
            }

            // We assume for this algorithm's sake that ${varOrParam} is a string (although it may not be, it usually is).  We're not after
            //   exactness, just ease of reading for the user.
            if (expression.startsWith('${')) {
                return true;
            }

            return false;
        }
    }
}

/**
 * A TLE value representing a property access (source.property).
 */
export class PropertyAccess extends ParentValue {

    //asdf multiple lines if needed
    // We need to allow creating a property access expression whether the property name
    //   was correctly given or not, so we can have proper intellisense/etc.
    // I.e., we require the period, but after that might be empty or an error.
    constructor(private _source: Value, private _periodToken: Token, private _nameToken: Token | undefined) {
        super();

        assert(_source);
        assert(_periodToken);

        assert(!this._source.parent, "Parent already assigned");
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

        let propertyAccessSource: PropertyAccess | undefined = asPropertyAccessValue(this._source);
        while (propertyAccessSource && propertyAccessSource.nameToken) {
            result.push(propertyAccessSource.nameToken.stringValue);
            propertyAccessSource = asPropertyAccessValue(propertyAccessSource.source);
        }

        return result;
    }

    /**
     * Get the root source value of this PropertyAccess as a FunctionValue.
     */
    public get functionSource(): FunctionCallValue | undefined {
        let currentSource: Value = this._source;
        while (currentSource instanceof PropertyAccess) {
            const propertyAccess: PropertyAccess | undefined = asPropertyAccessValue(currentSource);
            assert(propertyAccess);
            // tslint:disable-next-line:no-non-null-assertion // Asserted
            currentSource = propertyAccess!.source;
        }
        return asFunctionCallValue(currentSource);
    }

    public get periodToken(): Token {
        return this._periodToken;
    }

    public get nameToken(): Token | undefined {
        return this._nameToken;
    }

    public getSpan(): Span {
        let result = this._source.getSpan();

        if (!!this._nameToken) {
            result = result.union(this._nameToken.span);
        } else {
            result = result.union(this._periodToken.span);
        }

        return result;
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, ContainsBehavior.extended);
    }

    public accept(visitor: Visitor): void {
        visitor.visitPropertyAccess(this);
    }

    public toString(): string {
        let result = `${this._source.toString()}.`;
        if (!!this._nameToken) {
            result += this._nameToken.stringValue;
        }
        return result;
    }

    public formatCore(options: ITleFormatOptions, currentIndent: number): string {
        let result = `${this._source.formatCore(options, currentIndent)}.`;
        if (!!this._nameToken) {
            result += this._nameToken.stringValue;
        }
        return result;
    }
}

/**
 * A set of functions that pertain to getting highlight character indexes for a TLE string.
 */
export class BraceHighlighter {
    public static getHighlightCharacterIndexes(context: TemplatePositionContext): number[] {
        assert(context);

        let highlightCharacterIndexes: number[] = [];

        if (context.tleInfo) {
            let tleParseResult = context.tleInfo.tleParseResult;
            let tleCharacterIndex = context.tleInfo.tleCharacterIndex;

            if (!!tleParseResult.leftSquareBracketToken && tleParseResult.leftSquareBracketToken.span.startIndex === tleCharacterIndex) {
                BraceHighlighter.addTLEBracketHighlights(highlightCharacterIndexes, tleParseResult);
            } else {
                let tleValue: Value | undefined = tleParseResult.getValueAtCharacterIndex(tleCharacterIndex);
                if (tleValue instanceof FunctionCallValue) {
                    if (!!tleValue.leftParenthesisToken && tleValue.leftParenthesisToken.span.startIndex === tleCharacterIndex) {
                        BraceHighlighter.addTLEFunctionHighlights(highlightCharacterIndexes, tleValue);
                    }
                } else if (tleValue instanceof ArrayAccessValue) {
                    if (tleValue.leftSquareBracketToken.span.startIndex === tleCharacterIndex) {
                        BraceHighlighter.addTLEArrayHighlights(highlightCharacterIndexes, tleValue);
                    }
                }
            }

            let leftOfTLECharacterIndex = tleCharacterIndex - 1;
            if (!!tleParseResult.rightSquareBracketToken
                && tleParseResult.rightSquareBracketToken.span.startIndex === leftOfTLECharacterIndex
            ) {
                BraceHighlighter.addTLEBracketHighlights(highlightCharacterIndexes, tleParseResult);
            } else if (0 <= leftOfTLECharacterIndex) {
                let tleValue: Value | undefined = tleParseResult.getValueAtCharacterIndex(leftOfTLECharacterIndex);
                if (tleValue instanceof FunctionCallValue) {
                    if (!!tleValue.rightParenthesisToken && tleValue.rightParenthesisToken.span.startIndex === leftOfTLECharacterIndex) {
                        BraceHighlighter.addTLEFunctionHighlights(highlightCharacterIndexes, tleValue);
                    }
                } else if (tleValue instanceof ArrayAccessValue) {
                    if (!!tleValue.rightSquareBracketToken && tleValue.rightSquareBracketToken.span.startIndex === leftOfTLECharacterIndex) {
                        BraceHighlighter.addTLEArrayHighlights(highlightCharacterIndexes, tleValue);
                    }
                }
            }
        }

        return highlightCharacterIndexes;
    }

    private static addTLEBracketHighlights(highlightCharacterIndexes: number[], tleParseResult: TleParseResult): void {
        assert(tleParseResult);
        assert(tleParseResult.leftSquareBracketToken);

        // tslint:disable-next-line:no-non-null-assertion // Asserted above
        highlightCharacterIndexes.push(tleParseResult.leftSquareBracketToken!.span.startIndex);
        if (!!tleParseResult.rightSquareBracketToken) {
            highlightCharacterIndexes.push(tleParseResult.rightSquareBracketToken.span.startIndex);
        }
    }

    private static addTLEFunctionHighlights(highlightCharacterIndexes: number[], tleFunction: FunctionCallValue): void {
        assert(tleFunction);
        assert(tleFunction.leftParenthesisToken);

        // tslint:disable-next-line:no-non-null-assertion // Asserted
        highlightCharacterIndexes.push(tleFunction.leftParenthesisToken!
            .span.startIndex);
        if (!!tleFunction.rightParenthesisToken) {
            highlightCharacterIndexes.push(tleFunction.rightParenthesisToken.span.startIndex);
        }
    }

    private static addTLEArrayHighlights(highlightCharacterIndexes: number[], tleArrayAccess: ArrayAccessValue): void {
        assert(tleArrayAccess);
        assert(tleArrayAccess.leftSquareBracketToken);

        highlightCharacterIndexes.push(tleArrayAccess.leftSquareBracketToken.span.startIndex);
        if (!!tleArrayAccess.rightSquareBracketToken) {
            highlightCharacterIndexes.push(tleArrayAccess.rightSquareBracketToken.span.startIndex);
        }
    }
}

/**
 * A generic visitor base class for TLE values.
 */
export abstract class Visitor {
    public visitArrayAccess(tleArrayAccess: ArrayAccessValue | undefined): void {
        if (tleArrayAccess) {
            assert(tleArrayAccess.source);
            tleArrayAccess.source.accept(this);
            if (tleArrayAccess.indexValue) {
                tleArrayAccess.indexValue.accept(this);
            }
        }
    }

    public visitFunctionCall(tleFunction: FunctionCallValue | undefined): void {
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

    public visitPropertyAccess(tlePropertyAccess: PropertyAccess | undefined): void {
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
    constructor(private _activeParameterIndex: number, private _functionMetadata: IFunctionMetadata) {
    }

    public get activeParameterIndex(): number {
        return this._activeParameterIndex;
    }

    public get functionMetadata(): IFunctionMetadata {
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
    public static parse(quotedStringValue: string): TleParseResult {
        // Handles any JSON string, not just those that are actually TLE expressions beginning with bracket
        assert(quotedStringValue, "TLE strings cannot be undefined.");
        assert(1 <= quotedStringValue.length, "TLE strings must be at least 1 character.");
        assert(Utilities.isQuoteCharacter(quotedStringValue[0]), "The first character in the TLE string to parse must be a quote character.");

        let leftSquareBracketToken: Token | undefined;
        let expression: Value | undefined;
        let rightSquareBracketToken: Token | undefined;
        let errors: Issue[] = [];

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
                    <Token | undefined>tokenizer.current
                    && tokenizer.current.getType() !== TokenType.Literal
                    && tokenizer.current.getType() !== TokenType.RightSquareBracket
                ) {
                    errors.push(new Issue(tokenizer.current.span, "Expected a literal value.", IssueKind.tleSyntax));
                    tokenizer.next();
                }

                expression = Parser.parseExpression(tokenizer, errors);

                while (<Token | undefined>tokenizer.current) {
                    if (tokenizer.current.getType() === TokenType.RightSquareBracket) {
                        rightSquareBracketToken = tokenizer.current;
                        tokenizer.next();
                        break;
                    } else {
                        errors.push(new Issue(tokenizer.current.span, "Expected the end of the string.", IssueKind.tleSyntax));
                        tokenizer.next();
                    }
                }

                if (!!rightSquareBracketToken) {
                    while (<Token | undefined>tokenizer.current) {
                        errors.push(new Issue(tokenizer.current.span, "Nothing should exist after the closing ']' except for whitespace.", IssueKind.tleSyntax));
                        tokenizer.next();
                    }
                } else {
                    errors.push(new Issue(new Span(quotedStringValue.length - 1, 1), "Expected a right square bracket (']').", IssueKind.tleSyntax));
                }

                if (!expression) {
                    let errorSpan: Span = leftSquareBracketToken.span;
                    if (!!rightSquareBracketToken) {
                        errorSpan = errorSpan.union(rightSquareBracketToken.span);
                    }
                    errors.push(new Issue(errorSpan, "Expected a function or property expression.", IssueKind.tleSyntax));
                }
            }
        }

        return new TleParseResult(leftSquareBracketToken, expression, rightSquareBracketToken, errors);
    }

    private static parseExpression(tokenizer: Tokenizer, errors: Issue[]): Value | undefined {
        let expression: Value;
        if (tokenizer.current) {
            let rootExpression: Value | undefined; // Initial expression

            let token = tokenizer.current;
            let tokenType = token.getType();
            if (tokenType === TokenType.Literal) {
                rootExpression = Parser.parseFunctionCall(tokenizer, errors);
            } else if (tokenType === TokenType.QuotedString) {
                if (!token.stringValue.endsWith(token.stringValue[0])) {
                    errors.push(new Issue(token.span, "A constant string is missing an end quote.", IssueKind.tleSyntax));
                }
                rootExpression = new StringValue(token);
                tokenizer.next();
            } else if (tokenType === TokenType.Number) {
                rootExpression = new NumberValue(token);
                tokenizer.next();
            } else if (tokenType !== TokenType.RightSquareBracket && tokenType !== TokenType.Comma) {
                errors.push(new Issue(token.span, "Template language expressions must start with a function.", IssueKind.tleSyntax));
                tokenizer.next();
            }

            if (!rootExpression) {
                return undefined;
            }

            expression = rootExpression;
        } else {
            return undefined;
        }

        // Check for property or array accesses off of the root expression
        while (<Token | undefined>tokenizer.current) {
            if (tokenizer.current.getType() === TokenType.Period) {
                let periodToken = tokenizer.current;
                tokenizer.next();

                let propertyNameToken: Token | undefined;
                let errorSpan: Span | undefined;

                if (<Token | undefined>tokenizer.current) {
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

                if (!propertyNameToken) {
                    assert(errorSpan);
                    // tslint:disable-next-line: no-non-null-assertion // Asserted
                    errors.push(new Issue(errorSpan!, "Expected a literal value.", IssueKind.tleSyntax));
                }

                // We go ahead and create a property access expression whether the property name
                //   was correctly given or not, so we can have proper intellisense/etc.
                expression = new PropertyAccess(expression, periodToken, propertyNameToken);
            } else if (tokenizer.current.getType() === TokenType.LeftSquareBracket) {
                let leftSquareBracketToken: Token = tokenizer.current;
                tokenizer.next();

                let indexValue: Value | undefined = Parser.parseExpression(tokenizer, errors);

                let rightSquareBracketToken: Token | undefined;
                if (<Token | undefined>tokenizer.current && tokenizer.current.getType() === TokenType.RightSquareBracket) {
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
    private static parseFunctionCall(tokenizer: Tokenizer, errors: Issue[]): FunctionCallValue {
        assert(tokenizer);
        assert(tokenizer.current, "tokenizer must have a current token.");
        // tslint:disable-next-line:no-non-null-assertion // Asserted
        assert.deepEqual(TokenType.Literal, tokenizer.current!.getType(), "tokenizer's current token must be a literal.");
        assert(errors);

        let namespaceToken: Token | undefined;
        let nameToken: Token | undefined;
        let periodToken: Token | undefined;

        // tslint:disable-next-line:no-non-null-assertion // Asserted
        let firstToken: Token = tokenizer.current!;
        tokenizer.next();

        // Check for <namespace>.<functionname>
        // tslint:disable-next-line: strict-boolean-expressions
        if (tokenizer.current && tokenizer.current.getType() === TokenType.Period) {
            // It's a user-defined function because it has a namespace before the function name
            periodToken = tokenizer.current;
            namespaceToken = firstToken;
            tokenizer.next();

            // Get the function name following the period
            if (tokenizer.hasCurrent() && tokenizer.current.getType() === TokenType.Literal) {
                nameToken = tokenizer.current;
                tokenizer.next();
            } else {
                errors.push(new Issue(periodToken.span, "Expected user-defined function name.", IssueKind.tleSyntax));
            }
        } else {
            nameToken = firstToken;
        }

        let leftParenthesisToken: Token | undefined;
        let rightParenthesisToken: Token | undefined;
        let commaTokens: Token[] = [];
        let argumentExpressions: (Value | undefined)[] = [];

        // tslint:disable-next-line: strict-boolean-expressions
        if (tokenizer.current) {
            // tslint:disable-next-line: strict-boolean-expressions // False positive
            while (tokenizer.current) {
                if (tokenizer.current.getType() === TokenType.LeftParenthesis) {
                    leftParenthesisToken = tokenizer.current;
                    tokenizer.next();
                    break;
                } else if (tokenizer.current.getType() === TokenType.RightSquareBracket) {
                    // tslint:disable-next-line: strict-boolean-expressions
                    errors.push(new Issue(getFullNameSpan(), "Missing function argument list.", IssueKind.tleSyntax));
                    break;
                } else {
                    errors.push(new Issue(tokenizer.current.span, "Expected the end of the string.", IssueKind.tleSyntax));
                    tokenizer.next();
                }
            }
        } else {
            errors.push(new Issue(getFullNameSpan(), "Missing function argument list.", IssueKind.tleSyntax));
        }

        if (tokenizer.hasCurrent()) {
            let expectingArgument: boolean = true;

            // tslint:disable-next-line: strict-boolean-expressions
            while (tokenizer.current) {
                if (tokenizer.current.getType() === TokenType.RightParenthesis || tokenizer.current.getType() === TokenType.RightSquareBracket) {
                    break;
                } else if (expectingArgument) {
                    let expression = Parser.parseExpression(tokenizer, errors);
                    if (!expression && tokenizer.hasCurrent() && tokenizer.current.getType() === TokenType.Comma) {
                        errors.push(new Issue(tokenizer.current.span, "Expected a constant string, function, or property expression.", IssueKind.tleSyntax));
                    }
                    argumentExpressions.push(expression);
                    expectingArgument = false;
                } else if (tokenizer.current.getType() === TokenType.Comma) {
                    expectingArgument = true;
                    commaTokens.push(tokenizer.current);
                    tokenizer.next();
                } else {
                    errors.push(new Issue(tokenizer.current.span, "Expected a comma (',').", IssueKind.tleSyntax));
                    tokenizer.next();
                }
            }

            if (Parser.isMissingArgument(expectingArgument, leftParenthesisToken, argumentExpressions.length, tokenizer)) {
                argumentExpressions.push(undefined);
                let errorSpan: Span;
                // tslint:disable-next-line: strict-boolean-expressions
                if (tokenizer.current) {
                    errorSpan = tokenizer.current.span;
                } else {
                    assert(0 < commaTokens.length);

                    errorSpan = commaTokens[commaTokens.length - 1].span;
                }
                errors.push(new Issue(errorSpan, "Expected a constant string, function, or property expression.", IssueKind.tleSyntax));
            }
        } else if (!!leftParenthesisToken) {
            errors.push(new Issue(leftParenthesisToken.span, "Expected a right parenthesis (')').", IssueKind.tleSyntax));
        }

        // tslint:disable-next-line: strict-boolean-expressions
        if (tokenizer.current) {
            switch (tokenizer.current.getType()) {
                case TokenType.RightParenthesis:
                    rightParenthesisToken = tokenizer.current;
                    tokenizer.next();
                    break;

                case TokenType.RightSquareBracket:
                    if (!!leftParenthesisToken) {
                        errors.push(new Issue(tokenizer.current.span, "Expected a right parenthesis (')').", IssueKind.tleSyntax));
                    }
                    break;
            }
        }

        assert(namespaceToken || nameToken, "Should have had a namespace or a name");
        return new FunctionCallValue(namespaceToken, periodToken, nameToken, leftParenthesisToken, commaTokens, argumentExpressions, rightParenthesisToken);

        function getFullNameSpan(): Span {
            if (!nameToken) {
                assert(namespaceToken);
                // tslint:disable-next-line: no-non-null-assertion
                return namespaceToken!.span;
            } else {
                // tslint:disable-next-line: strict-boolean-expressions
                return nameToken.span.union(namespaceToken && namespaceToken.span);
            }
        }
    }

    private static isMissingArgument(
        expectingArgument: boolean,
        leftParenthesisToken: Token | undefined,
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
export class TleParseResult {
    constructor(
        private _leftSquareBracketToken: Token | undefined,
        private _expression: Value | undefined,
        private _rightSquareBracketToken: Token | undefined,
        private _errors: Issue[]
    ) {
        assert(_errors);
    }

    public get leftSquareBracketToken(): Token | undefined {
        return this._leftSquareBracketToken;
    }

    public get rightSquareBracketToken(): Token | undefined {
        return this._rightSquareBracketToken;
    }

    public get expression(): Value | undefined {
        return this._expression;
    }

    public get errors(): Issue[] {
        return this._errors;
    }

    public getValueAtCharacterIndex(characterIndex: number): Value | undefined {
        let result: Value | undefined;

        let current: Value | undefined = this._expression;
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
    private _current: Token | undefined;
    // This offset (+1) is because we trimmed off the initial quote character.
    private _currentTokenStartIndex: number = 1;

    private constructor(private _basicTokenizer: basic.Tokenizer, private _text: string) {
    }

    public static fromString(stringValue: string): Tokenizer {
        assert(stringValue);
        assert(1 <= stringValue.length);
        assert(Utilities.isQuoteCharacter(stringValue[0]));

        const initialQuoteCharacter: string = stringValue[0];
        const trimmedLength: number = stringValue.length - (stringValue.endsWith(initialQuoteCharacter) ? 2 : 1);
        const trimmedString: string = stringValue.substr(1, trimmedLength);

        const tt = new Tokenizer(new basic.Tokenizer(trimmedString), stringValue);
        return tt;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return __debugMarkRangeInString(this._text, this._currentTokenStartIndex, this._current ? this._current.toString().length : 0);
    }

    public hasStarted(): boolean {
        return this._basicTokenizer.hasStarted();
    }

    public hasCurrent(): boolean {
        return !!this._current;
    }

    public get current(): Token | undefined {
        return this._current;
    }

    private nextBasicToken(): void {
        this._basicTokenizer.moveNext();
    }

    private get currentBasicToken(): basic.Token | undefined {
        return this._basicTokenizer.current();
    }

    public readToken(): Token | undefined {
        if (this.hasStarted() === false) {
            this.nextBasicToken();
        } else if (this.current) {
            this._currentTokenStartIndex += this.current.length;
        }

        this._current = undefined;
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
        const result = !!this.readToken();
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
    private _span: Span;
    private _stringValue: string;

    public constructor(tokenType: TokenType, startIndex: number, stringValue: string) {
        assert(typeof tokenType === "number");
        assert(typeof stringValue === "string");

        this._type = tokenType;
        this._span = new Span(startIndex, stringValue.length);
        this._stringValue = stringValue;
    }

    public getType(): TokenType {
        return this._type;
    }

    public get span(): Span {
        return this._span;
    }

    public get length(): number {
        return this._span.length;
    }

    public get stringValue(): string {
        return this._stringValue;
    }

    public static createLeftParenthesis(startIndex: number): Token {
        return new Token(TokenType.LeftParenthesis, startIndex, "(");
    }

    public static createRightParenthesis(startIndex: number): Token {
        return new Token(TokenType.RightParenthesis, startIndex, ")");
    }

    public static createLeftSquareBracket(startIndex: number): Token {
        return new Token(TokenType.LeftSquareBracket, startIndex, "[");
    }

    public static createRightSquareBracket(startIndex: number): Token {
        return new Token(TokenType.RightSquareBracket, startIndex, "]");
    }

    public static createComma(startIndex: number): Token {
        return new Token(TokenType.Comma, startIndex, ",");
    }

    public static createPeriod(startIndex: number): Token {
        return new Token(TokenType.Period, startIndex, ".");
    }

    public static createWhitespace(startIndex: number, stringValue: string): Token {
        assert(stringValue);
        assert(1 <= stringValue.length);

        return new Token(TokenType.Whitespace, startIndex, stringValue);
    }

    public static createQuotedString(startIndex: number, stringValue: string): Token {
        nonNullValue(stringValue, "stringValue");
        assert(1 <= stringValue.length);
        assert(Utilities.isQuoteCharacter(stringValue[0]));

        return new Token(TokenType.QuotedString, startIndex, stringValue);
    }

    public static createNumber(startIndex: number, stringValue: string): Token {
        nonNullValue(stringValue, "stringValue");
        assert(1 <= stringValue.length);
        assert(stringValue[0] === "-" || Utilities.isDigit(stringValue[0]));

        return new Token(TokenType.Number, startIndex, stringValue);
    }

    public static createLiteral(startIndex: number, stringValue: string): Token {
        nonNullValue(stringValue, "stringValue");
        assert(1 <= stringValue.length);

        return new Token(TokenType.Literal, startIndex, stringValue);
    }

    public static createEmptyLiteral(startIndex: number): Token {
        return new Token(TokenType.Literal, startIndex, "");
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
export function readQuotedTLEString(iterator: Iterator<basic.Token>): basic.Token[] {
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
