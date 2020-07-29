// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ITestLog } from "./ITestLog";

const alwaysEchoTestLog: boolean = /^(true|1)?$/i.test(process.env.ALWAYS_ECHO_TEST_LOG ?? '');

export class StringTestLog implements ITestLog {
    private _data: string[] = [];

    public writeLine(message: string): void {
        this._data.push(message);
        if (alwaysEchoTestLog) {
            console.log(`testLog: ${message}`);
        }
    }

    public writeLineIfLogCreated(message: string): void {
        this.writeLine(message);
    }

    public toString(): string {
        return this._data.join(' \n');
    }
}
