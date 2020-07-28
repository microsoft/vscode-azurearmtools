// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { ITestLog } from "./ITestLog";
import { StringLog } from "./StringLog";

class UninitializedLog implements ITestLog {
    public writeLine(message: string): void {
        assert.fail("createTestLog has not been called.");
    }

    public toString(): string {
        assert.fail("createTestLog has not been called.");
    }

    public writeLineIfLogCreated(message: string): void {
        // Log not created, don't write
    }
}

export let testLog: ITestLog = new UninitializedLog();

export function createTestLog(): void {
    testLog = new StringLog();
}

export function deleteTestLog(): void {
    testLog = new UninitializedLog();
}
