// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import { Duration } from "./Duration";

export class Stopwatch {
    private _startTimeMilliseconds: number;
    private _stopTimeMilliseconds: number;

    public start(): void {
        assert(!this._startTimeMilliseconds);
        assert(!this._stopTimeMilliseconds);

        this._startTimeMilliseconds = Date.now();
    }

    public stop(): void {
        assert(this._startTimeMilliseconds);
        assert(!this._stopTimeMilliseconds);

        this._stopTimeMilliseconds = Date.now();
    }

    public get startTime(): Date {
        assert(this._startTimeMilliseconds);

        return new Date(this._startTimeMilliseconds);
    }

    public get stopTime(): Date {
        assert(this._stopTimeMilliseconds);

        return new Date(this._startTimeMilliseconds);
    }

    public get duration(): Duration {
        assert(this._startTimeMilliseconds);

        let endTimeMilliseconds: number = this._stopTimeMilliseconds ? this._stopTimeMilliseconds : Date.now();
        return Duration.milliseconds(endTimeMilliseconds - this._startTimeMilliseconds);
    }
}
