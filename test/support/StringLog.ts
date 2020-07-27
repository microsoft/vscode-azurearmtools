// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export class StringLog {
    private _data: string[] = [];

    public writeLine(message: string): void {
        this._data.push(message);
    }

    public toString(): string {
        return this._data.join(' \n');
    }
}
