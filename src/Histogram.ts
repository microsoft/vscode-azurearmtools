// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export class Histogram {
    private _nullCounts: number = 0;
    private _undefinedCounts: number = 0;
    private _counts: { [key: string]: number } = {};

    public get keys(): string[] {
        let result: string[] = Object.getOwnPropertyNames(this._counts);
        if (this._nullCounts > 0) {
            result.push(null);
        }
        if (this._undefinedCounts > 0) {
            result.push(undefined);
        }
        return result;
    }

    public add(key: string | Histogram, count: number = 1): void {
        if (key === null) {
            this._nullCounts += count;
        }
        else if (key === undefined) {
            this._undefinedCounts += count;
        }
        else if (typeof key === "string") {
            if (!this._counts[key]) {
                this._counts[key] = count;
            }
            else {
                this._counts[key] += count;
            }
        }
        else {
            for (let rhsKey of key.keys) {
                this.add(rhsKey, key.getCount(rhsKey));
            }
        }
    }

    public getCount(key: string): number {
        let result: number;
        if (key === null) {
            result = this._nullCounts;
        }
        else if (key === undefined) {
            result = this._undefinedCounts;
        }
        else if (key in this._counts) {
            result = this._counts[key];
        }
        else {
            result = 0;
        }
        return result;
    }
}
