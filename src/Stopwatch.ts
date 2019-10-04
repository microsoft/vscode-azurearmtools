// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { Duration } from "./Duration";

export class Stopwatch {
    private _startTimeMilliseconds: number | undefined;
    private _stopTimeMilliseconds: number | undefined;

    public start(): void {
        assert(this._startTimeMilliseconds === undefined);
        assert(this._stopTimeMilliseconds === undefined);

        this._startTimeMilliseconds = Date.now();
    }

    public stop(): void {
        assert(this._startTimeMilliseconds !== undefined);
        assert(this._stopTimeMilliseconds === undefined);

        this._stopTimeMilliseconds = Date.now();
    }

    public get startTime(): Date {
        assert(this._startTimeMilliseconds !== undefined);

        // tslint:disable-next-line: no-non-null-assertion // Asserted
        return new Date(this._startTimeMilliseconds!);
    }

    public get stopTime(): Date {
        assert(this._stopTimeMilliseconds !== undefined);

        // tslint:disable-next-line: no-non-null-assertion // Asserted
        return new Date(this._startTimeMilliseconds!);
    }

    public get duration(): Duration {
        assert(this._startTimeMilliseconds !== undefined);

        let endTimeMilliseconds: number = this._stopTimeMilliseconds !== undefined ? this._stopTimeMilliseconds : Date.now();
        // tslint:disable-next-line: no-non-null-assertion // Asserted
        return Duration.milliseconds(endTimeMilliseconds - this._startTimeMilliseconds!);
    }
}
