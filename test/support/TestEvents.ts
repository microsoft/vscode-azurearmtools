// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { EventEmitter } from "vscode";
import { ITestEvents } from "../../src/ITestEvents";
import { defaultTimeout, getEventPromise } from "./getEventPromise";

export class TestEvents implements ITestEvents {
    private _emitters: Map<string, EventEmitter<{ [key: string]: unknown }>> = new Map<string, EventEmitter<{ [key: string]: unknown }>>();

    public async waitForEvent(event: string, timeout: number = defaultTimeout): Promise<{ [key: string]: unknown }> {
        console.log(`Waiting for event: ${event}...`);
        return await getEventPromise(
            event,
            (resolve, reject) => {
                const emitter = new EventEmitter<{ [key: string]: unknown }>();
                this._emitters.set(event, emitter);

                emitter.event(data => {
                    console.log(`Waiting finished for event: ${event}`);
                    resolve(data);
                    this._emitters.delete(event);
                    emitter.dispose();
                });
            },
            timeout
        );
    }

    public triggerEvent(event: string, data: { [key: string]: unknown } = {}): void {
        let emitter = this._emitters.get(event);
        if (emitter) {
            console.log(`Event triggered: ${event}: ${JSON.stringify(data, null, 2)}`);
            emitter.fire(data);
        } else {
            console.log(`Unrecognized event, ignored: ${event}: ${JSON.stringify(data, null, 2)}`);
        }
    }
}
