// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

const alwaysEchoTestLog: boolean = /^(true|1)?$/i.test(process.env.ALWAYS_ECHO_TEST_LOG ?? '');

export interface ITestLog {
    writeLine(message: string | undefined): void;
    toString(): string;
}

class UninitializedLog implements ITestLog {
    public writeLine(message: string | undefined): void {
        createTestLog();
        testLog.writeLine(message);
    }

    public toString(): string {
        return "";
    }
}

export let testLog: ITestLog = new UninitializedLog();

export function createTestLog(): void {
    testLog = new StringTestLog();
}

export function deleteTestLog(): void {
    testLog = new UninitializedLog();
}

export class StringTestLog implements ITestLog {
    private _data: string[] = [];

    public writeLine(message: string | undefined): void {
        this._data.push(message === undefined ? '(undefined)' : message);
        if (alwaysEchoTestLog) {
            console.log(`testLog: ${message}`);
        }
    }

    public writeLineIfLogCreated(message: string | undefined): void {
        this.writeLine(message);
    }

    public toString(): string {
        return this._data.join(' \n');
    }
}
