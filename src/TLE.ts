// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// TLE = Template Language Expression

// tslint:disable:no-unnecessary-class // Grandfathered in
// tslint:disable:switch-default // Grandfathered in
// tslint:disable:max-classes-per-file // Grandfathered in

import * as assert from "assert";

import * as assets from "./AzureRMAssets";
import * as basic from "./Tokenizer";
import * as Json from "./JSON";
import * as language from "./Language";
import * as Reference from "./Reference";
import * as Utilities from "./Utilities";

import { DeploymentTemplate } from "./DeploymentTemplate";
import { Histogram } from "./Histogram";
import { PositionContext } from "./PositionContext";

export function asStringValue(value: Value): StringValue {
    return value instanceof StringValue ? value : null;
}

export function asNumberValue(value: Value): NumberValue {
    return value instanceof NumberValue ? value : null;
}

export function asArrayAccessValue(value: Value): ArrayAccessValue {
    return value instanceof ArrayAccessValue ? value : null;
}

export function asFunctionValue(value: Value): FunctionValue {
    return value instanceof FunctionValue ? value : null;
}

export function asPropertyAccessValue(value: Value): PropertyAccess {
    return value instanceof PropertyAccess ? value : null;
}

/**
 * The Value class is the generic base class that all other TLE values inherit from.
 */
export abstract class Value {
    private _parent: ParentValue;

    public get parent(): ParentValue {
        return this._parent;
    }

    public set parent(parent: ParentValue) {
        this._parent = parent;
    }

    public abstract getSpan(): language.Span;

    public abstract contains(characterIndex: number): boolean;

    public abstract toString(): string;

    public abstract accept(visitor: Visitor): void;
}

export abstract class ParentValue extends Value {
}

/**
 * A TLE value representing a string.
 */
export class StringValue extends Value {
    constructor(private _token: Token) {
        super();

        assert.notEqual(null, _token);
        assert.deepEqual(TokenType.QuotedString, _token.getType());
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

    private get lastCharacter(): string {
        return this.toString()[this.length - 1];
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

    public isParametersArgument(): boolean {
        return this.isFunctionArgument("parameters");
    }

    public isVariablesArgument(): boolean {
        return this.isFunctionArgument("variables");
    }

    private isFunctionArgument(functionName: string): boolean {
        const parent: Value = this.parent;
        return parent &&
            parent instanceof FunctionValue &&
            parent.nameToken.stringValue === functionName &&
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

        assert.notEqual(null, _token);
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
    constructor(private _source: Value, private _leftSquareBracketToken: Token, private _index: Value, private _rightSquareBracketToken: Token) {
        super();

        assert(_source);
        assert.notEqual(null, _leftSquareBracketToken);
        assert.deepEqual(TokenType.LeftSquareBracket, _leftSquareBracketToken.getType());
        assert(undefined !== _index);
        assert(undefined !== _rightSquareBracketToken);
        assert(_rightSquareBracketToken === null || _rightSquareBracketToken.getType() === TokenType.RightSquareBracket);

        if (this._source) {
            this._source.parent = this;
        }

        if (this._index) {
            this._index.parent = this;
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
    public get index(): Value {
        return this._index;
    }

    /**
     * The token for the right square bracket. This can be null if the array access doesn't have a
     * closing right square bracket.
     */
    public get rightSquareBracketToken(): Token {
        return this._rightSquareBracketToken;
    }

    /**
     * The span that contains this entire array access expression.
     */
    public getSpan(): language.Span {
        let result = this._source.getSpan();

        if (this._rightSquareBracketToken) {
            result = result.union(this._rightSquareBracketToken.span);
        }
        else if (this._index) {
            result = result.union(this._index.getSpan());
        }
        else {
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
        let result: string = this._source.toString() + "[";
        if (this._index !== null) {
            result += this._index.toString();
        }
        if (this._rightSquareBracketToken !== null) {
            result += "]";
        }
        return result;
    }
}

/**
 * A TLE value that represents a function expression.
 */
export class FunctionValue extends ParentValue {
    constructor(private _nameToken: Token, private _leftParenthesisToken: Token, private _commaTokens: Token[], private _argumentExpressions: Value[], private _rightParenthesisToken: Token) {
        super();

        assert.notEqual(null, _nameToken);
        assert.notEqual(null, _commaTokens);
        assert.notEqual(null, _argumentExpressions);

        for (const argumentExpression of this._argumentExpressions) {
            if (argumentExpression) {
                argumentExpression.parent = this;
            }
        }
    }

    /**
     * The token for the function's name.
     */
    public get nameToken(): Token {
        return this._nameToken;
    }

    public get commaTokens(): Token[] {
        return this._commaTokens;
    }

    public get argumentExpressions(): Value[] {
        return this._argumentExpressions;
    }

    public get leftParenthesisToken(): Token {
        return this._leftParenthesisToken;
    }

    public get rightParenthesisToken(): Token {
        return this._rightParenthesisToken;
    }

    public get argumentListSpan(): language.Span {
        let result: language.Span = null;

        if (this._leftParenthesisToken) {
            result = this._leftParenthesisToken.span;

            if (this._rightParenthesisToken) {
                result = result.union(this._rightParenthesisToken.span);
            }
            else if (this._argumentExpressions.length > 0 || this._commaTokens.length > 0) {
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
        return this._nameToken.span.union(this.argumentListSpan);
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, !this._rightParenthesisToken);
    }

    public accept(visitor: Visitor): void {
        visitor.visitFunction(this);
    }

    public toString(): string {
        let result = this._nameToken.stringValue;
        if (this._leftParenthesisToken !== null) {
            result += "(";
        }

        for (let i = 0; i < this._argumentExpressions.length; ++i) {
            if (i > 0) {
                result += ", ";
            }
            result += this._argumentExpressions[i].toString();
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
    constructor(private _source: Value, private _periodToken: Token, private _nameToken: Token) {
        super();

        assert.notEqual(null, _source);
        assert.notEqual(null, _periodToken);

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

        const propertyAccesses: PropertyAccess[] = [];

        let propertyAccessSource: PropertyAccess = asPropertyAccessValue(this._source);
        while (propertyAccessSource) {
            result.push(propertyAccessSource.nameToken.stringValue);
            propertyAccessSource = asPropertyAccessValue(propertyAccessSource.source);
        }

        return result;
    }

    /**
     * Get the root source value of this PropertyAccess as a FunctionValue.
     */
    public get functionSource(): FunctionValue {
        let currentSource: Value = this._source;
        while (currentSource && currentSource instanceof PropertyAccess) {
            currentSource = asPropertyAccessValue(currentSource).source;
        }
        return asFunctionValue(currentSource);
    }

    public get periodToken(): Token {
        return this._periodToken;
    }

    public get nameToken(): Token {
        return this._nameToken;
    }

    public getSpan(): language.Span {
        let result = this._source.getSpan();

        if (this._nameToken !== null) {
            result = result.union(this._nameToken.span);
        }
        else {
            result = result.union(this._periodToken.span);
        }

        return result;
    }

    public contains(characterIndex: number): boolean {
        return this.getSpan().contains(characterIndex, true)
    }

    public accept(visitor: Visitor): void {
        visitor.visitPropertyAccess(this);
    }

    public toString(): string {
        let result = this._source.toString() + ".";
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
    public static getHighlightCharacterIndexes(context: PositionContext) {
        assert(context);

        let highlightCharacterIndexes: number[] = [];

        let tleParseResult = context.tleParseResult;
        if (tleParseResult) {
            let tleCharacterIndex = context.tleCharacterIndex;

            if (tleParseResult.leftSquareBracketToken !== null && tleParseResult.leftSquareBracketToken.span.startIndex === tleCharacterIndex) {
                BraceHighlighter.addTLEBracketHighlights(highlightCharacterIndexes, tleParseResult);
            }
            else {
                let tleValue: Value = tleParseResult.getValueAtCharacterIndex(tleCharacterIndex);
                if (tleValue instanceof FunctionValue) {
                    if (tleValue.leftParenthesisToken !== null && tleValue.leftParenthesisToken.span.startIndex === tleCharacterIndex) {
                        BraceHighlighter.addTLEFunctionHighlights(highlightCharacterIndexes, tleValue);
                    }
                }
                else if (tleValue instanceof ArrayAccessValue) {
                    if (tleValue.leftSquareBracketToken !== null && tleValue.leftSquareBracketToken.span.startIndex === tleCharacterIndex) {
                        BraceHighlighter.addTLEArrayHighlights(highlightCharacterIndexes, tleValue);
                    }
                }
            }

            let leftOfTLECharacterIndex = tleCharacterIndex - 1;
            if (tleParseResult.rightSquareBracketToken !== null && tleParseResult.rightSquareBracketToken.span.startIndex === leftOfTLECharacterIndex) {
                BraceHighlighter.addTLEBracketHighlights(highlightCharacterIndexes, tleParseResult);
            }
            else if (0 <= leftOfTLECharacterIndex) {
                let tleValue: Value = tleParseResult.getValueAtCharacterIndex(leftOfTLECharacterIndex);
                if (tleValue instanceof FunctionValue) {
                    if (tleValue.rightParenthesisToken !== null && tleValue.rightParenthesisToken.span.startIndex === leftOfTLECharacterIndex) {
                        BraceHighlighter.addTLEFunctionHighlights(highlightCharacterIndexes, tleValue);
                    }
                }
                else if (tleValue instanceof ArrayAccessValue) {
                    if (tleValue.rightSquareBracketToken !== null && tleValue.rightSquareBracketToken.span.startIndex === leftOfTLECharacterIndex) {
                        BraceHighlighter.addTLEArrayHighlights(highlightCharacterIndexes, tleValue);
                    }
                }
            }
        }

        return highlightCharacterIndexes;
    }

    private static addTLEBracketHighlights(highlightCharacterIndexes: number[], tleParseResult: ParseResult): void {
        assert.notEqual(null, highlightCharacterIndexes);
        assert.notEqual(null, tleParseResult);
        assert.notEqual(null, tleParseResult.leftSquareBracketToken);

        highlightCharacterIndexes.push(tleParseResult.leftSquareBracketToken.span.startIndex);
        if (tleParseResult.rightSquareBracketToken !== null) {
            highlightCharacterIndexes.push(tleParseResult.rightSquareBracketToken.span.startIndex);
        }
    }

    private static addTLEFunctionHighlights(highlightCharacterIndexes: number[], tleFunction: FunctionValue): void {
        assert.notEqual(null, highlightCharacterIndexes);
        assert.notEqual(null, tleFunction);
        assert.notEqual(null, tleFunction.leftParenthesisToken);

        highlightCharacterIndexes.push(tleFunction.leftParenthesisToken.span.startIndex);
        if (tleFunction.rightParenthesisToken !== null) {
            highlightCharacterIndexes.push(tleFunction.rightParenthesisToken.span.startIndex);
        }
    }

    private static addTLEArrayHighlights(highlightCharacterIndexes: number[], tleArrayAccess: ArrayAccessValue): void {
        assert.notEqual(null, highlightCharacterIndexes);
        assert.notEqual(null, tleArrayAccess);
        assert.notEqual(null, tleArrayAccess.leftSquareBracketToken);

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
    public visitArrayAccess(tleArrayAccess: ArrayAccessValue): void {
        if (tleArrayAccess) {
            if (tleArrayAccess.source) {
                tleArrayAccess.source.accept(this);
            }
            if (tleArrayAccess.index) {
                tleArrayAccess.index.accept(this);
            }
        }
    }

    public visitFunction(tleFunction: FunctionValue): void {
        if (tleFunction && tleFunction.argumentExpressions) {
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

    public visitPropertyAccess(tlePropertyAccess: PropertyAccess): void {
        if (tlePropertyAccess && tlePropertyAccess.source) {
            tlePropertyAccess.source.accept(this);
        }
    }

    public visitString(tleString: StringValue): void {
        // Nothing to do
    }
}

/**
 * A TLE visitor that counts the function usages in a TLE value.
 */
export class FunctionCountVisitor extends Visitor {
    private _functionCounts: Histogram = new Histogram();

    /**
     * Get the histogram of function usages.
     */
    public get functionCounts(): Histogram {
        return this._functionCounts;
    }

    public visitFunction(tleFunction: FunctionValue): void {
        this._functionCounts.add(tleFunction.nameToken.stringValue);

        super.visitFunction(tleFunction);
    }

    public static visit(tleValue: Value): FunctionCountVisitor {
        let visitor = new FunctionCountVisitor();
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}

/**
 * A TLE visitor that finds references to undefined parameters or variables.
 */
export class UndefinedParameterAndVariableVisitor extends Visitor {
    private _errors: language.Issue[] = [];

    constructor(private _deploymentTemplate: DeploymentTemplate) {
        super();

        assert(_deploymentTemplate !== null, "_deploymentTemplate cannot be null");
        assert(_deploymentTemplate !== undefined, "_deploymentTemplate cannot be undefined");
    }

    public get errors(): language.Issue[] {
        return this._errors;
    }

    public visitString(tleString: StringValue): void {
        assert(tleString, "Cannot visit a null or undefined StringValue");

        const quotedStringValue: string = tleString.token.stringValue;

        if (tleString.isParametersArgument() && !this._deploymentTemplate.getParameterDefinition(quotedStringValue)) {
            this._errors.push(new language.Issue(tleString.token.span, `Undefined parameter reference: ${quotedStringValue}`));
        }

        if (tleString.isVariablesArgument() && !this._deploymentTemplate.getVariableDefinition(quotedStringValue)) {
            this._errors.push(new language.Issue(tleString.token.span, `Undefined variable reference: ${quotedStringValue}`));
        }
    }

    public static visit(tleValue: Value, deploymentTemplate: DeploymentTemplate): UndefinedParameterAndVariableVisitor {
        const visitor = new UndefinedParameterAndVariableVisitor(deploymentTemplate);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}

/**
 * A TLE visitor that finds references to undefined functions.
 */
export class UnrecognizedFunctionVisitor extends Visitor {
    private _errors: language.Issue[] = [];

    constructor(private _tleFunctions: assets.FunctionsMetadata) {
        super();
    }

    public get errors(): language.Issue[] {
        return this._errors;
    }

    public visitFunction(tleFunction: FunctionValue): void {
        const functionName: string = tleFunction.nameToken.stringValue;
        const functionMetadata: assets.FunctionMetadata = this._tleFunctions.findbyName(functionName);
        if (!functionMetadata) {
            this._errors.push(new language.Issue(tleFunction.nameToken.span, `Unrecognized function name '${functionName}'.`));
        }

        super.visitFunction(tleFunction);
    }

    public static visit(tleValue: Value, tleFunctions: assets.FunctionsMetadata): UnrecognizedFunctionVisitor {
        let visitor = new UnrecognizedFunctionVisitor(tleFunctions);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}

/**
 * A TLE visitor that creates errors if an incorrect number of arguments are used when calling a
 * TLE function.
 */
export class IncorrectFunctionArgumentCountVisitor extends Visitor {
    private _errors: language.Issue[] = [];

    constructor(private _tleFunctions: assets.FunctionsMetadata) {
        super();
    }

    public get errors(): language.Issue[] {
        return this._errors;
    }

    public visitFunction(tleFunction: FunctionValue): void {
        const parsedFunctionName: string = tleFunction.nameToken.stringValue;
        let functionMetadata: assets.FunctionMetadata = this._tleFunctions.findbyName(parsedFunctionName);
        if (functionMetadata) {
            const actualFunctionName: string = functionMetadata.name;

            const minimumArguments: number = functionMetadata.minimumArguments;
            assert(minimumArguments !== null && minimumArguments !== undefined, `TLE function metadata for '${actualFunctionName}' has a null or undefined minimum argument value.`);

            const maximumArguments: number = functionMetadata.maximumArguments;
            const functionCallArgumentCount: number = tleFunction.argumentExpressions ? tleFunction.argumentExpressions.length : 0;

            if (minimumArguments === maximumArguments) {
                if (functionCallArgumentCount !== minimumArguments) {
                    this._errors.push(new language.Issue(tleFunction.getSpan(), `The function '${actualFunctionName}' takes ${minimumArguments} ${this.getArgumentsString(minimumArguments)}.`))
                }
            }
            else if (maximumArguments === null || maximumArguments === undefined) {
                if (functionCallArgumentCount < minimumArguments) {
                    this._errors.push(new language.Issue(tleFunction.getSpan(), `The function '${actualFunctionName}' takes at least ${minimumArguments} ${this.getArgumentsString(minimumArguments)}.`))
                }
            }
            else {
                assert(minimumArguments < maximumArguments);
                if (functionCallArgumentCount < minimumArguments || maximumArguments < functionCallArgumentCount) {
                    this._errors.push(new language.Issue(tleFunction.getSpan(), `The function '${actualFunctionName}' takes between ${minimumArguments} and ${maximumArguments} ${this.getArgumentsString(maximumArguments)}.`))
                }
            }
        }

        super.visitFunction(tleFunction);
    }

    private getArgumentsString(argumentCount: number): string {
        return `argument${argumentCount === 1 ? "" : "s"}`;
    }

    public static visit(tleValue: Value, tleFunctions: assets.FunctionsMetadata): IncorrectFunctionArgumentCountVisitor {
        const visitor = new IncorrectFunctionArgumentCountVisitor(tleFunctions);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}

/**
 * A TLE visitor that finds references to variable properties that haven't been defined.
 */
export class UndefinedVariablePropertyVisitor extends Visitor {
    private _errors: language.Issue[] = [];

    constructor(private _deploymentTemplate: DeploymentTemplate) {
        super();
    }

    public get errors(): language.Issue[] {
        return this._errors;
    }

    public visitPropertyAccess(tlePropertyAccess: PropertyAccess): void {
        if (tlePropertyAccess.nameToken) {
            const functionSource: FunctionValue = tlePropertyAccess.functionSource;
            if (functionSource) {

                const variableProperty: Json.Property = this._deploymentTemplate.getVariableDefinitionFromFunction(functionSource);
                if (variableProperty) {

                    const variableDefinition: Json.ObjectValue = Json.asObjectValue(variableProperty.value);
                    const sourcesNameStack: string[] = tlePropertyAccess.sourcesNameStack;
                    if (variableDefinition) {
                        const sourcePropertyDefinition: Json.ObjectValue = Json.asObjectValue(variableDefinition.getPropertyValueFromStack(sourcesNameStack));
                        if (sourcePropertyDefinition && !sourcePropertyDefinition.hasProperty(tlePropertyAccess.nameToken.stringValue)) {
                            this.addIssue(tlePropertyAccess);
                        }
                    }
                    else if (sourcesNameStack.length === 0) {
                        this.addIssue(tlePropertyAccess);
                    }
                }
            }
        }

        super.visitPropertyAccess(tlePropertyAccess);
    }

    private addIssue(tlePropertyAccess: PropertyAccess): void {
        const propertyName: string = tlePropertyAccess.nameToken.stringValue;
        const sourceString: string = tlePropertyAccess.source.toString();
        this._errors.push(new language.Issue(tlePropertyAccess.nameToken.span, `Property "${propertyName}" is not a defined property of "${sourceString}".`));
    }

    public static visit(tleValue: Value, deploymentTemplate: DeploymentTemplate): UndefinedVariablePropertyVisitor {
        const visitor = new UndefinedVariablePropertyVisitor(deploymentTemplate);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}

/**
 * A TLE visitor that searches a TLE value tree looking for references to the provided parameter or
 * variable.
 */
export class FindReferencesVisitor extends Visitor {
    private _references: Reference.List;
    private _lowerCasedName: string;

    constructor(private _kind: Reference.ReferenceKind, private _name: string) {
        super();

        this._references = new Reference.List(_kind);
        this._lowerCasedName = Utilities.unquote(_name).toLowerCase();
    }

    public get references(): Reference.List {
        return this._references;
    }

    public visitString(tleString: StringValue): void {
        if (tleString && Utilities.unquote(tleString.toString()).toLowerCase() === this._lowerCasedName) {
            switch (this._kind) {
                case Reference.ReferenceKind.Parameter:
                    if (tleString.isParametersArgument()) {
                        this._references.add(tleString.unquotedSpan);
                    }
                    break;

                case Reference.ReferenceKind.Variable:
                    if (tleString.isVariablesArgument()) {
                        this._references.add(tleString.unquotedSpan);
                    }
                    break;

                default:
                    assert.fail(`Unrecognized ReferenceKind: ${this._kind}`);
                    break;
            }
        }
    }

    public static visit(tleValue: Value, referenceType: Reference.ReferenceKind, referenceName: string): FindReferencesVisitor {
        const visitor = new FindReferencesVisitor(referenceType, referenceName);
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
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
 * A parser for TLE strings.
 */
export class Parser {
    public static parse(stringValue: string): ParseResult {
        assert.notEqual(null, stringValue, "TLE strings cannot be null.");
        assert(1 <= stringValue.length, "TLE strings must be at least 1 character.");
        assert(Utilities.isQuoteCharacter(stringValue[0]), "The first character in a TLE string must be a quote character.");

        let leftSquareBracketToken: Token = null;
        let expression: Value = null;
        let rightSquareBracketToken: Token = null;
        let errors: language.Issue[] = [];

        if (3 <= stringValue.length && stringValue.substr(1, 2) === "[[") {
            expression = new StringValue(Token.createQuotedString(0, stringValue));
        }
        else {
            let tokenizer = Tokenizer.fromString(stringValue);
            tokenizer.next();

            if (!tokenizer.hasCurrent() || tokenizer.current.getType() !== TokenType.LeftSquareBracket) {
                expression = new StringValue(Token.createQuotedString(0, stringValue));
            }
            else {
                leftSquareBracketToken = tokenizer.current;
                tokenizer.next();

                while (tokenizer.hasCurrent() && tokenizer.current.getType() !== TokenType.Literal && tokenizer.current.getType() !== TokenType.RightSquareBracket) {
                    errors.push(new language.Issue(tokenizer.current.span, "Expected a literal value."));
                    tokenizer.next();
                }

                expression = Parser.parseExpression(tokenizer, errors);

                while (tokenizer.hasCurrent()) {
                    if (tokenizer.current.getType() === TokenType.RightSquareBracket) {
                        rightSquareBracketToken = tokenizer.current;
                        tokenizer.next();
                        break;
                    }
                    else {
                        errors.push(new language.Issue(tokenizer.current.span, "Expected the end of the string."));
                        tokenizer.next();
                    }
                }

                if (rightSquareBracketToken !== null) {
                    while (tokenizer.hasCurrent()) {
                        errors.push(new language.Issue(tokenizer.current.span, "Nothing should exist after the closing ']' except for whitespace."));
                        tokenizer.next();
                    }
                }
                else {
                    errors.push(new language.Issue(new language.Span(stringValue.length - 1, 1), "Expected a right square bracket (']')."));
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

        return new ParseResult(leftSquareBracketToken, expression, rightSquareBracketToken, errors);
    }

    private static parseExpression(tokenizer: Tokenizer, errors: language.Issue[]): Value {
        let expression: Value = null;

        if (tokenizer.hasCurrent()) {
            let token = tokenizer.current;
            let tokenType = token.getType();
            if (tokenType === TokenType.Literal) {
                expression = Parser.parseFunction(tokenizer, errors);
            }
            else if (tokenType === TokenType.QuotedString) {
                if (!token.stringValue.endsWith(token.stringValue[0])) {
                    errors.push(new language.Issue(token.span, "A constant string is missing an end quote."));
                }
                expression = new StringValue(token);
                tokenizer.next();
            }
            else if (tokenType === TokenType.Number) {
                expression = new NumberValue(token);
                tokenizer.next();
            }
            else if (tokenType !== TokenType.RightSquareBracket && tokenType !== TokenType.Comma) {
                errors.push(new language.Issue(token.span, "Template language expressions must start with a function."));
                tokenizer.next();
            }
        }

        if (expression !== null) {
            while (tokenizer.hasCurrent()) {
                if (tokenizer.current.getType() === TokenType.Period) {
                    let periodToken = tokenizer.current;
                    tokenizer.next();

                    let propertyNameToken: Token = null;
                    let errorSpan: language.Span = null;

                    if (tokenizer.hasCurrent()) {
                        if (tokenizer.current.getType() === TokenType.Literal) {
                            propertyNameToken = tokenizer.current;
                            tokenizer.next();
                        }
                        else {
                            errorSpan = tokenizer.current.span;

                            let tokenType = tokenizer.current.getType();
                            if (tokenType !== TokenType.RightParenthesis && tokenType !== TokenType.RightSquareBracket && tokenType !== TokenType.Comma) {
                                tokenizer.next();
                            }
                        }
                    }
                    else {
                        errorSpan = periodToken.span;
                    }

                    if (propertyNameToken === null) {
                        assert.notEqual(null, errorSpan);
                        errors.push(new language.Issue(errorSpan, "Expected a literal value."));
                    }

                    expression = new PropertyAccess(expression, periodToken, propertyNameToken);
                }
                else if (tokenizer.current.getType() === TokenType.LeftSquareBracket) {
                    let leftSquareBracketToken: Token = tokenizer.current;
                    tokenizer.next();

                    let index: Value = Parser.parseExpression(tokenizer, errors);

                    let rightSquareBracketToken: Token = null;
                    if (tokenizer.hasCurrent() && tokenizer.current.getType() === TokenType.RightSquareBracket) {
                        rightSquareBracketToken = tokenizer.current;
                        tokenizer.next();
                    }

                    expression = new ArrayAccessValue(expression, leftSquareBracketToken, index, rightSquareBracketToken);
                }
                else {
                    break;
                }
            }
        }

        return expression;
    }

    private static parseFunction(tokenizer: Tokenizer, errors: language.Issue[]): FunctionValue {
        assert.notEqual(null, tokenizer);
        assert(tokenizer.hasCurrent(), "tokenizer must have a current token.");
        assert.deepEqual(TokenType.Literal, tokenizer.current.getType(), "tokenizer's current token must be a literal.");
        assert.notEqual(null, errors);

        let nameToken = tokenizer.current;
        tokenizer.next();

        let leftParenthesisToken: Token = null;
        let rightParenthesisToken: Token = null;
        let commaTokens: Token[] = [];
        let argumentExpressions: Value[] = [];

        if (tokenizer.hasCurrent()) {
            while (tokenizer.hasCurrent()) {
                if (tokenizer.current.getType() === TokenType.LeftParenthesis) {
                    leftParenthesisToken = tokenizer.current;
                    tokenizer.next();
                    break;
                }
                else if (tokenizer.current.getType() === TokenType.RightSquareBracket) {
                    errors.push(new language.Issue(nameToken.span, "Missing function argument list."));
                    break;
                }
                else {
                    errors.push(new language.Issue(tokenizer.current.span, "Expected the end of the string."));
                    tokenizer.next();
                }
            }
        }
        else {
            errors.push(new language.Issue(nameToken.span, "Missing function argument list."));
        }

        if (tokenizer.hasCurrent()) {
            let expectingArgument: boolean = true;

            while (tokenizer.hasCurrent()) {
                if (tokenizer.current.getType() === TokenType.RightParenthesis || tokenizer.current.getType() === TokenType.RightSquareBracket) {
                    break;
                }
                else if (expectingArgument) {
                    let expression = Parser.parseExpression(tokenizer, errors);
                    if (expression === null && tokenizer.hasCurrent() && tokenizer.current.getType() === TokenType.Comma) {
                        errors.push(new language.Issue(tokenizer.current.span, "Expected a constant string, function, or property expression."));
                    }
                    argumentExpressions.push(expression);
                    expectingArgument = false;
                }
                else if (tokenizer.current.getType() === TokenType.Comma) {
                    expectingArgument = true;
                    commaTokens.push(tokenizer.current);
                    tokenizer.next();
                }
                else {
                    errors.push(new language.Issue(tokenizer.current.span, "Expected a comma (',')."));
                    tokenizer.next();
                }
            }

            if (Parser.isMissingArgument(expectingArgument, leftParenthesisToken, argumentExpressions.length, tokenizer)) {
                argumentExpressions.push(null);
                let errorSpan: language.Span;
                if (tokenizer.hasCurrent()) {
                    errorSpan = tokenizer.current.span;
                }
                else {
                    assert(0 < commaTokens.length);

                    errorSpan = commaTokens[commaTokens.length - 1].span;
                }
                errors.push(new language.Issue(errorSpan, "Expected a constant string, function, or property expression."));
            }
        }
        else if (leftParenthesisToken !== null) {
            errors.push(new language.Issue(leftParenthesisToken.span, "Expected a right parenthesis (')')."));
        }

        if (tokenizer.hasCurrent()) {
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

        return new FunctionValue(nameToken, leftParenthesisToken, commaTokens, argumentExpressions, rightParenthesisToken);
    }

    private static isMissingArgument(expectingArgument: boolean, leftParenthesisToken: Token, existingArguments: number, tokenizer: Tokenizer): boolean {
        let result = false;

        if (expectingArgument && leftParenthesisToken !== null && 0 < existingArguments) {
            if (!tokenizer.hasCurrent()) {
                result = true;
            }
            else {
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
    constructor(private _leftSquareBracketToken: Token, private _expression: Value, private _rightSquareBracketToken: Token, private _errors: language.Issue[]) {
        assert.notEqual(null, _errors);
    }

    public get leftSquareBracketToken(): Token {
        return this._leftSquareBracketToken;
    }

    public get rightSquareBracketToken(): Token {
        return this._rightSquareBracketToken;
    }

    public get expression(): Value {
        return this._expression;
    }

    public get errors(): language.Issue[] {
        return this._errors;
    }

    public getValueAtCharacterIndex(characterIndex: number): Value {
        let result: Value = null;

        let current: Value = this._expression;
        if (current && current.contains(characterIndex)) {
            while (!result) {
                const currentValue: Value = current;
                if (currentValue instanceof FunctionValue) {
                    if (currentValue.argumentExpressions) {
                        for (const argumentExpression of currentValue.argumentExpressions) {
                            if (argumentExpression && argumentExpression.contains(characterIndex)) {
                                current = argumentExpression;
                                break;
                            }
                        }
                    }

                    // If the characterIndex was not in any of the argument expressions, then
                    // it must be somewhere inside this function expression.
                    if (current === currentValue) {
                        result = current;
                    }
                }
                else if (currentValue instanceof ArrayAccessValue) {
                    if (currentValue.source && currentValue.source.contains(characterIndex)) {
                        current = currentValue.source;
                    }
                    else if (currentValue.index && currentValue.index.contains(characterIndex)) {
                        current = currentValue.index;
                    }
                    else {
                        result = current;
                    }
                }
                else if (currentValue instanceof PropertyAccess) {
                    if (currentValue.source.contains(characterIndex)) {
                        current = currentValue.source;
                    }
                    else {
                        result = current;
                    }
                }
                else {
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

    private _current: Token;
    // This offset (+1) is because we trimmed off the initial quote character.
    private _currentTokenStartIndex: number = 1;

    public static fromString(stringValue: string): Tokenizer {
        assert.notEqual(null, stringValue);
        assert(1 <= stringValue.length);
        assert(Utilities.isQuoteCharacter(stringValue[0]));

        const initialQuoteCharacter: string = stringValue[0];
        const trimmedLength: number = stringValue.length - (stringValue.endsWith(initialQuoteCharacter) ? 2 : 1);
        const trimmedString: string = stringValue.substr(1, trimmedLength);

        const tt = new Tokenizer();
        tt._basicTokenizer = new basic.Tokenizer(trimmedString);
        return tt;
    }

    public hasStarted(): boolean {
        return this._basicTokenizer.hasStarted();
    }

    public hasCurrent(): boolean {
        return this._current !== null;
    }

    public get current(): Token {
        return this._current;
    }

    private nextBasicToken(): void {
        this._basicTokenizer.moveNext();
    }

    private get currentBasicToken(): basic.Token {
        return this._basicTokenizer.current();
    }

    public readToken(): Token {
        if (this.hasStarted() === false) {
            this.nextBasicToken();
        }
        else if (this.hasCurrent()) {
            this._currentTokenStartIndex += this.current.length;
        }

        this._current = null;
        if (this.currentBasicToken) {
            switch (this.currentBasicToken.getType()) {
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
                    this._current = Token.createWhitespace(this._currentTokenStartIndex, Utilities.getCombinedText(Json.readWhitespace(this._basicTokenizer)));
                    break;

                case basic.TokenType.SingleQuote:
                case basic.TokenType.DoubleQuote:
                    this._current = Token.createQuotedString(this._currentTokenStartIndex, Utilities.getCombinedText(Json.readQuotedString(this._basicTokenizer)));
                    break;

                case basic.TokenType.Dash:
                case basic.TokenType.Digits:
                    this._current = Token.createNumber(this._currentTokenStartIndex, Utilities.getCombinedText(Json.readNumber(this._basicTokenizer)));
                    break;

                default:
                    const literalTokens: basic.Token[] = [this.currentBasicToken];
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

    private skipWhitespace() {
        while (this.hasCurrent() && this._current.getType() === TokenType.Whitespace) {
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
        assert.notEqual(null, tokenType);
        assert.notEqual(null, stringValue);

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

    public static createLeftParenthesis(startIndex: number) {
        return Token.create(TokenType.LeftParenthesis, startIndex, "(");
    }

    public static createRightParenthesis(startIndex: number): Token {
        return Token.create(TokenType.RightParenthesis, startIndex, ")");
    }

    public static createLeftSquareBracket(startIndex: number) {
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
        assert.notEqual(null, stringValue);
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
