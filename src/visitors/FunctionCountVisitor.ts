// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from "../fixed_assert";
import { FunctionCallValue, TleVisitor, Value } from "../language/expressions/TLE";
import { Histogram } from "../util/Histogram";

/**
 * A TLE visitor that counts the function usages in a TLE value.
 */
export class FunctionCountVisitor extends TleVisitor {
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
        const args = tleFunction.argumentExpressions || [];
        const argsCount = args.length;
        const functionName = tleFunction.fullName;
        const functionNameWithArgs = `${functionName}(${argsCount})`;
        this._functionCounts.add(functionName);
        this._functionCounts.add(functionNameWithArgs);
        super.visitFunctionCall(tleFunction);
    }
    public static visit(tleValue: Value | undefined): FunctionCountVisitor {
        const visitor = new FunctionCountVisitor();
        if (tleValue) {
            tleValue.accept(visitor);
        }
        return visitor;
    }
}
