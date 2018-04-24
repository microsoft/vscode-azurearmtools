// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

export class Duration {
    private _milliseconds: number;

    public get totalMilliseconds(): number {
        return this._milliseconds;
    }

    public get totalSeconds(): number {
        return this.totalMilliseconds / 1000;
    }

    public plus(rhs: Duration): Duration {
        assert(rhs !== null, "rhs cannot be null");
        assert(rhs !== undefined, "rhs cannot be undefined");

        return Duration.milliseconds(this._milliseconds + rhs._milliseconds);
    }

    public dividedBy(divisor: number): Duration {
        assert(divisor !== null, "divisor cannot be null");
        assert(divisor !== undefined, "divisor cannot be undefined");
        assert.notEqual(0, divisor, "divisor cannot be 0");

        return Duration.milliseconds(this._milliseconds / divisor);
    }

    public lessThanOrEqualTo(rhs: Duration): boolean {
        return rhs ? this.totalMilliseconds <= rhs.totalMilliseconds : false;
    }

    public toString(): string {
        let ms = this.totalMilliseconds;
        return String(ms) + " millisecond" + (ms !== 1 ? "s" : "");
    }

    public static zero: Duration = Duration.milliseconds(0);

    public static milliseconds(milliseconds: number): Duration {
        let result = new Duration();
        result._milliseconds = milliseconds;
        return result;
    }

    public static seconds(seconds: number): Duration {
        return Duration.milliseconds(seconds * 1000);
    }
}
