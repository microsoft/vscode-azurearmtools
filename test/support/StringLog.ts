// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ITestLog } from "./ITestLog";

export class StringLog implements ITestLog {
    private _data: string[] = [];

    public writeLine(message: string): void {
        this._data.push(message);
    }

    public writeLineIfLogCreated(message: string): void {
        this.writeLine(message);
    }

    public toString(): string {
        return this._data.join(' \n');
    }
}
