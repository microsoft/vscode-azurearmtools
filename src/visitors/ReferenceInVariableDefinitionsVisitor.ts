// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { DeploymentTemplate } from "../documents/templates/DeploymentTemplate";
import { assert } from '../fixed_assert';
import * as TLE from "../language/expressions/TLE";
import * as Json from "../language/json/JSON";
import { Span } from "../language/Span";

/**
 * Finds all spans that represent a call to "reference()" inside of a variable definition
 */
// CONSIDER: This should be generalized
export class ReferenceInVariableDefinitionsVisitor extends Json.Visitor {
    private _referenceSpans: Span[] = [];

    constructor(private _deploymentTemplate: DeploymentTemplate) {
        super();

        assert(_deploymentTemplate);
    }

    public get referenceSpans(): Span[] {
        return this._referenceSpans;
    }

    public visitStringValue(value: Json.StringValue): void {
        assert(value, "Cannot visit a null or undefined Json.StringValue.");

        const tleParseResult: TLE.TleParseResult = this._deploymentTemplate.getTLEParseResultFromJsonStringValue(value);
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
    private _referenceSpans: Span[] = [];

    public get referenceSpans(): Span[] {
        return this._referenceSpans;
    }

    public visitFunctionCall(functionValue: TLE.FunctionCallValue | undefined): void {
        if (functionValue && functionValue.nameToken && functionValue.doesNameMatch("", "reference")) {
            this._referenceSpans.push(functionValue.nameToken.span);
        }

        super.visitFunctionCall(functionValue);
    }
}
