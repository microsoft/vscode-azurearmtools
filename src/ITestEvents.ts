// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { delay } from "../test/support/delay";

export interface ITestEvents {
    waitForEvent<T>(event: string, timeout?: number): Promise<{ [key: string]: unknown } | undefined>;
    triggerEvent<T>(event: string, data?: { [key: string]: unknown }): void;
}

export class NoopTestEvents implements ITestEvents {
    public async waitForEvent<T>(_event: string): Promise<{ [key: string]: unknown } | undefined> {
        await delay(1);
        return undefined;
    }

    public triggerEvent(_event: string, _data?: { [key: string]: unknown }): void {
        // Nothing
    }
}
