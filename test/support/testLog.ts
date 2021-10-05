// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: prefer-template

import * as fse from "fs-extra";

export const alwaysEchoTestLog: boolean = /^(true|1)?$/i.test(process.env.ALWAYS_ECHO_TEST_LOG ?? '');

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

function writeToLogCore(message: string, ...args: object[]): string {
    message = message.
        message = new Date().toLocaleDateString() + ": " + message;

    if (testLogOutputFile) {
        fse.appendFileSync(testLogOutputFile, message);
    }

    return message;
}

export function writeToWarning(message: string): void {
    message = writeToLogCore("** WARNING:" + message);
    console.warn(message);
}

export function writeToError(message: string): void {
    message = writeToLogCore("** ERROR:" + message);
    console.error(message);
}

export function writeToLog(message: string): void {
    message = writeToLogCore(message);
    console.log(message);
}

export let testLog: ITestLog = new UninitializedLog();

let testLogOutputFile: string | undefined;
export function setTestLogOutputFile(filePath: string): void {
    testLogOutputFile = filePath;
    writeToLog(`Writing logs to ${testLogOutputFile}`);
}

export function createTestLog(): void {
    testLog = new StringTestLog();
}

export function deleteTestLog(): void {
    testLog = new UninitializedLog();
}

export class StringTestLog implements ITestLog {
    private _data: string[] = [];

    public writeLine(message: string | undefined): void {
        message = message === undefined ? '(undefined)' : message;
        this._data.push(message);

        if (alwaysEchoTestLog) {
            console.warn(`testLog: ${message}`);
        }
    }

    public toString(): string {
        return this._data.join(' \n');
    }
}
