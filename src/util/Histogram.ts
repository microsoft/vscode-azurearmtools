// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export class Histogram {
    private _nullCounts: number = 0;
    private _undefinedCounts: number = 0;
    private _counts: { [key: string]: number } = {};

    public get keys(): (string | undefined | null)[] {
        const result: (string | undefined | null)[] = Object.getOwnPropertyNames(this._counts);
        if (this._nullCounts > 0) {
            result.push(null);
        }
        if (this._undefinedCounts > 0) {
            result.push(undefined);
        }
        return result;
    }

    public add(key: string | Histogram | undefined | null, count: number = 1): Histogram {
        if (key === null) {
            this._nullCounts += count;
        } else if (key === undefined) {
            this._undefinedCounts += count;
        } else if (typeof key === "string") {
            // tslint:disable-next-line: strict-boolean-expressions
            if (!this._counts[key]) {
                this._counts[key] = count;
            } else {
                this._counts[key] += count;
            }
        } else {
            for (const rhsKey of key.keys) {
                this.add(rhsKey, key.getCount(rhsKey));
            }
        }

        return this;
    }

    public getCount(key: string | undefined | null): number {
        let result: number;
        if (key === null) {
            result = this._nullCounts;
        } else if (key === undefined) {
            result = this._undefinedCounts;
        } else if (key in this._counts) {
            result = this._counts[key];
        } else {
            result = 0;
        }
        return result;
    }
}
