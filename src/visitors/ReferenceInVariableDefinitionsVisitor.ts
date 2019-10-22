// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { DeploymentTemplate } from "../DeploymentTemplate";
import { assert } from '../fixed_assert';
import * as Json from "../JSON";
import * as language from "../Language";
import * as TLE from "../TLE";

/**
 * Finds all spans that represent a call to "reference()" inside of a variable definition
 */
// CONSIDER: This should be generalized
export class ReferenceInVariableDefinitionsVisitor extends Json.Visitor {
    private _referenceSpans: language.Span[] = [];

    constructor(private _deploymentTemplate: DeploymentTemplate) {
        super();

        assert(_deploymentTemplate);
    }

    public get referenceSpans(): language.Span[] {
        return this._referenceSpans;
    }

    public visitStringValue(value: Json.StringValue): void {
        assert(value, "Cannot visit a null or undefined Json.StringValue.");

        const tleParseResult: TLE.ParseResult = this._deploymentTemplate.getTLEParseResultFromJsonStringValue(value);
        if (tleParseResult.expression) {
            const tleVisitor = new ReferenceInVariableDefinitionTLEVisitor();
            tleParseResult.expression.accept(tleVisitor);

            const jsonValueStartIndex: number = value.startIndex;
            for (const tleReferenceSpan of tleVisitor.referenceSpans) {
                this._referenceSpans.push(tleReferenceSpan.translate(jsonValueStartIndex));
            }
        }
    }
}

class ReferenceInVariableDefinitionTLEVisitor extends TLE.Visitor {
    private _referenceSpans: language.Span[] = [];

    public get referenceSpans(): language.Span[] {
        return this._referenceSpans;
    }

    public visitFunctionCall(functionValue: TLE.FunctionCallValue | null): void {
        if (functionValue && functionValue.doesNameMatch("", "reference")) {
            this._referenceSpans.push(functionValue.nameToken.span);
        }

        super.visitFunctionCall(functionValue);
    }
}
