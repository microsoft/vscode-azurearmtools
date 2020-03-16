// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { EOL } from "os";
import { CachedValue } from "../CachedValue";
import * as Completion from "../Completion";
import { __debugMarkPositionInString } from "../debugMarkStrings";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { assert } from '../fixed_assert';
import { HoverInfo } from "../Hover";
import * as Json from "../JSON";
import * as language from "../Language";
import { createParameterFromTemplateParameter } from "../parameterFileGeneration";
import { IReferenceSite } from "../PositionContext";
import { nonNullValue } from "../util/nonNull";
import { DeploymentParameters } from "./DeploymentParameters";

//asdf refactor out a base class

//asdf
// /**
//  * Information about a reference site (function call, parameter reference, etc.)
//  */
// export interface IReferenceSite {
//     /**
//      * Where the reference occurs in the template
//      */
//     referenceSpan: Language.Span;

//     /**
//      * The definition that the reference refers to
//      */
//     definition: INamedDefinition;
// }

/**
 * Represents a position inside the snapshot of a deployment parameter file, plus all related information
 * that can be parsed and analyzed about it from that position.
 */
export class ParametersPositionContext {
    private _deploymentParameters: DeploymentParameters;
    private _deploymentTemplate: DeploymentTemplate | undefined;
    private _givenDocumentPosition?: language.Position;
    private _documentPosition: CachedValue<language.Position> = new CachedValue<language.Position>();
    private _givenDocumentCharacterIndex?: number;
    private _documentCharacterIndex: CachedValue<number> = new CachedValue<number>();
    private _jsonToken: CachedValue<Json.Token | undefined> = new CachedValue<Json.Token>();
    private _jsonValue: CachedValue<Json.Value | undefined> = new CachedValue<Json.Value | undefined>();

    private constructor(deploymentParameters: DeploymentParameters, deploymentTemplate: DeploymentTemplate | undefined) {
        this._deploymentParameters = deploymentParameters;
        this._deploymentTemplate = deploymentTemplate;
    }

    public static fromDocumentLineAndColumnIndexes(deploymentParameters: DeploymentParameters, documentLineIndex: number, documentColumnIndex: number, deploymentTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        nonNullValue(deploymentParameters, "deploymentParameters");
        nonNullValue(documentLineIndex, "documentLineIndex");
        assert(documentLineIndex >= 0, "documentLineIndex cannot be negative");
        assert(documentLineIndex < deploymentParameters.lineCount, `documentLineIndex (${documentLineIndex}) cannot be greater than or equal to the deployment template's line count (${deploymentParameters.lineCount})`);
        nonNullValue(documentColumnIndex, "documentColumnIndex");
        assert(documentColumnIndex >= 0, "documentColumnIndex cannot be negative");
        assert(documentColumnIndex <= deploymentParameters.getMaxColumnIndex(documentLineIndex), `documentColumnIndex (${documentColumnIndex}) cannot be greater than the line's maximum index (${deploymentParameters.getMaxColumnIndex(documentLineIndex)})`);

        let context = new ParametersPositionContext(deploymentParameters, deploymentTemplate);
        context._givenDocumentPosition = new language.Position(documentLineIndex, documentColumnIndex);
        return context;

    }
    public static fromDocumentCharacterIndex(deploymentParameters: DeploymentParameters, documentCharacterIndex: number, deploymentTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        nonNullValue(deploymentParameters, "deploymentParameters");
        nonNullValue(documentCharacterIndex, "documentCharacterIndex");
        assert(documentCharacterIndex >= 0, "documentCharacterIndex cannot be negative");
        assert(documentCharacterIndex <= deploymentParameters.maxCharacterIndex, `documentCharacterIndex (${documentCharacterIndex}) cannot be greater than the maximum character index (${deploymentParameters.maxCharacterIndex})`);

        let context = new ParametersPositionContext(deploymentParameters, deploymentTemplate);
        context._givenDocumentCharacterIndex = documentCharacterIndex;
        return context;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        let docText: string = this._deploymentParameters.documentText;
        return __debugMarkPositionInString(docText, this.documentCharacterIndex, "<CURSOR>");
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugFullDisplay(): string {
        let docText: string = this._deploymentParameters.documentText;
        return __debugMarkPositionInString(docText, this.documentCharacterIndex, "<CURSOR>", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }

    public get documentPosition(): language.Position {
        return this._documentPosition.getOrCacheValue(() => {
            if (this._givenDocumentPosition) {
                return this._givenDocumentPosition;
            } else {
                return this._deploymentParameters.getDocumentPosition(this.documentCharacterIndex);
            }
        });
    }

    public get documentLineIndex(): number {
        return this.documentPosition.line;
    }

    public get documentColumnIndex(): number {
        return this.documentPosition.column;
    }

    public get documentCharacterIndex(): number {
        return this._documentCharacterIndex.getOrCacheValue(() => {
            if (typeof this._givenDocumentCharacterIndex === "number") {
                return this._givenDocumentCharacterIndex;
            } else {
                return this._deploymentParameters.getDocumentCharacterIndex(this.documentLineIndex, this.documentColumnIndex);
            }
        });
    }

    // NOTE: Includes character after end index asdf ??
    public get jsonToken(): Json.Token | undefined {
        return this._jsonToken.getOrCacheValue(() => {
            return this._deploymentParameters.getJSONTokenAtDocumentCharacterIndex(this.documentCharacterIndex);
        });
    }

    // NOTE: Includes character after end index
    public get jsonValue(): Json.Value | undefined {
        return this._jsonValue.getOrCacheValue(() => {
            return this._deploymentParameters.getJSONValueAtDocumentCharacterIndex(this.documentCharacterIndex, language.Contains.extended);
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
    public getReferenceSiteInfo(): IReferenceSite | undefined {
        //asdf
        // const tleInfo = this.tleInfo;
        // if (tleInfo) {
        //     const scope = tleInfo.scope;
        //     const tleCharacterIndex = tleInfo.tleCharacterIndex;

        //     const tleFuncCall: TLE.FunctionCallValue | undefined = TLE.asFunctionCallValue(tleInfo.tleValue);
        //     if (tleFuncCall) {
        //         if (tleFuncCall.namespaceToken && tleFuncCall.namespaceToken.span.contains(tleCharacterIndex)) {
        //             // Inside the namespace of a user-function reference
        //             const ns = tleFuncCall.namespaceToken.stringValue;
        //             const nsDefinition = scope.getFunctionNamespaceDefinition(ns);
        //             if (nsDefinition) {
        //                 const referenceSpan: language.Span = tleFuncCall.namespaceToken.span.translate(this.jsonTokenStartIndex);
        //                 return { definition: nsDefinition, referenceSpan };
        //             }
        //         } else if (tleFuncCall.nameToken && tleFuncCall.nameToken.span.contains(tleCharacterIndex)) {
        //             if (tleFuncCall.namespaceToken) {
        //                 // Inside the name of a user-function reference
        //                 const ns = tleFuncCall.namespaceToken.stringValue;
        //                 const name = tleFuncCall.nameToken.stringValue;
        //                 const nsDefinition = scope.getFunctionNamespaceDefinition(ns);
        //                 const userFunctiondefinition = scope.getUserFunctionDefinition(ns, name);
        //                 if (nsDefinition && userFunctiondefinition) {
        //                     const referenceSpan: language.Span = tleFuncCall.nameToken.span.translate(this.jsonTokenStartIndex);
        //                     return { definition: userFunctiondefinition, referenceSpan };
        //                 }
        //             } else {
        //                 // Inside a reference to a built-in function
        //                 const functionMetadata: BuiltinFunctionMetadata | undefined = AzureRMAssets.getFunctionMetadataFromName(tleFuncCall.nameToken.stringValue);
        //                 if (functionMetadata) {
        //                     const referenceSpan: language.Span = tleFuncCall.nameToken.span.translate(this.jsonTokenStartIndex);
        //                     return { definition: functionMetadata, referenceSpan };
        //                 }
        //             }
        //         }
        //     }

        //     const tleStringValue: TLE.StringValue | undefined = TLE.asStringValue(tleInfo.tleValue);
        //     if (tleStringValue instanceof TLE.StringValue) {
        //         if (tleStringValue.isParametersArgument()) {
        //             // Inside the 'xxx' of a parameters('xxx') reference
        //             const parameterDefinition: IParameterDefinition | undefined = scope.getParameterDefinition(tleStringValue.toString());
        //             if (parameterDefinition) {
        //                 const referenceSpan: language.Span = tleStringValue.getSpan().translate(this.jsonTokenStartIndex);
        //                 return { definition: parameterDefinition, referenceSpan };
        //             }
        //         } else if (tleStringValue.isVariablesArgument()) {
        //             const variableDefinition: IVariableDefinition | undefined = scope.getVariableDefinition(tleStringValue.toString());
        //             if (variableDefinition) {
        //                 // Inside the 'xxx' of a variables('xxx') reference
        //                 const referenceSpan: language.Span = tleStringValue.getSpan().translate(this.jsonTokenStartIndex);
        //                 return { definition: variableDefinition, referenceSpan };
        //             }
        //         }
        //     }
        // }

        return undefined;
    }

    //asdf
    public getHoverInfo(): HoverInfo | undefined {
        const reference: IReferenceSite | undefined = this.getReferenceSiteInfo();
        if (reference) {
            const span = reference.referenceSpan;
            const definition = reference.definition;
            return new HoverInfo(definition.usageInfo, span);
        }

        return undefined;
    }

    /**
     * Get completion items for our position in the document
     */
    public getCompletionItems(): Completion.Item[] {
        let completions: Completion.Item[] = [];

        if (this.canAddPropertyHere) {
            completions.push(... this.getCompletionsForMissingParameters());
            completions.push(this.getCompletionForNewParameter());
        }

        return completions;
    }

    private getCompletionForNewParameter(): Completion.Item {
        // tslint:disable-next-line:prefer-template
        //const paramOnly = createParameterFromTemplateParameter(this._deploymentTemplate, param);
        // asdf const replacement = `,${EOL}${paramOnly}`;
        //const replacement = paramOnly;
        const detail = "Insert new parameter and value";
        const snippet =
            // tslint:disable-next-line:prefer-template
            `"\${1:parameter1}": {` + EOL
            + `\t"value": "\${2:value}"` + EOL
            + `}` + EOL;
        const documentation = "documentation";

        return new Completion.Item(
            "New parameter value",
            snippet,
            this.emptySpanAtDocumentCharacterIndex,
            Completion.CompletionKind.NewPropertyValue,
            detail,
            documentation);
    }

    /**
     * Get completion items for our position in the document
     */
    private getCompletionsForMissingParameters(): Completion.Item[] {
        const completions: Completion.Item[] = [];
        if (this._deploymentTemplate) {
            const paramsInParameterFile: string[] = this._deploymentParameters.parameterValues.map(
                pv => pv.nameValue.unquotedValue.toLowerCase());

            // For each parameter in the template
            for (let param of this._deploymentTemplate.topLevelScope.parameterDefinitions) {
                // Is this already in the parameter file?
                const paramNameLC = param.nameValue.unquotedValue.toLowerCase();
                if (paramsInParameterFile.includes(paramNameLC)) {
                    continue;
                }

                // tslint:disable-next-line:prefer-template
                const isRequired = !param.defaultValue;
                const label = `${param.nameValue.quotedValue} ${isRequired ? "(required)" : "(optional)"}`;
                const paramText = createParameterFromTemplateParameter(this._deploymentTemplate, param);
                const replacement = paramText;
                const documentation = `Insert a value for parameter '${param.nameValue.unquotedValue}' from the template file"`;
                const detail = paramText;

                completions.push(
                    new Completion.Item(
                        label,
                        replacement,
                        this.emptySpanAtDocumentCharacterIndex,
                        Completion.CompletionKind.PropertyValue,
                        detail,
                        documentation));
            }
        }

        return completions;
    }

    // True if inside the "parameters" object, but not inside any properties
    // within it.
    public get canAddPropertyHere(): boolean {
        if (!this._deploymentParameters.parametersObjectValue) {
            // No "parameters" section
            return false;
        }

        const enclosingJsonValue = this._deploymentParameters.jsonParseResult.getValueAtCharacterIndex(
            this.documentCharacterIndex,
            language.Contains.enclosed);

        if (enclosingJsonValue !== this._deploymentParameters.parametersObjectValue) {
            // Directly-enclosing JSON value/object at the cursor is not the "parameters" object
            // (either it's outside it, or it's within a subvalue like an existing parameter)
            return false;
        }

        // Check if we're inside a comment
        if (!!this._deploymentParameters.jsonParseResult.getCommentTokenAtDocumentIndex(
            this.documentCharacterIndex,
            language.Contains.enclosed)
        ) {
            return false;
        }

        return true;
    }
}
