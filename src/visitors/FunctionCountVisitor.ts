// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from "../fixed_assert";
import { Histogram } from "../Histogram";
import { FunctionCallValue, Value, Visitor } from "../TLE";

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
    public visitFunctionCall(tleFunction: FunctionCallValue): void {
        assert(tleFunction.argumentExpressions);
        // Log count for both "func" and "func(<args-count>)"

        // tslint:disable-next-line: strict-boolean-expressions
        let args = tleFunction.argumentExpressions || [];
        let argsCount = args.length;
        let functionName = tleFunction.fullName;
        let functionNameWithArgs = `${functionName}(${argsCount})`;
        this._functionCounts.add(functionName);
        this._functionCounts.add(functionNameWithArgs);
        super.visitFunctionCall(tleFunction);
    }
    public static visit(tleValue: Value | null): FunctionCountVisitor {
        let visitor = new FunctionCountVisitor();
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
