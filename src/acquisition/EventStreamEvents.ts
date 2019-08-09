/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecException } from 'child_process';
import { EventType } from './EventType';
import { IEvent } from './IEvent';

// tslint:disable max-classes-per-file

export class DotnetAcquisitionStarted implements IEvent {
    public readonly eventType: EventType = EventType.DotnetAcquisitionStart;

    constructor(public readonly version: string) {
    }
}

export abstract class DotnetAcquisitionError implements IEvent {
    public readonly eventType: EventType = EventType.DotnetAcquisitionError;

    constructor(public readonly version: string) {
    }

    public abstract getErrorMessage(): string;
}

export class DotnetAcquisitionUnexpectedError extends DotnetAcquisitionError {
    constructor(private readonly error: unknown, version: string) {
        super(version);
    }

    public getErrorMessage(): string {
        if (this.error) {
            let error = <{ toString?(): string }>this.error;
            return !!error.toString ? error.toString() : String(this.error);
        }

        return '';
    }
}

export class DotnetAcquisitionInstallError extends DotnetAcquisitionError {
    constructor(private readonly error: ExecException, version: string) {
        super(version);
    }

    public getErrorMessage(): string {
        return `Exit code: ${this.error.code}
Message: ${this.error.message}`;
    }
}

export class DotnetAcquisitionScriptError extends DotnetAcquisitionError {
    constructor(private readonly error: string, version: string) {
        super(version);
    }

    public getErrorMessage(): string {
        return this.error;
    }
}

export class DotnetAcquisitionCompleted implements IEvent {
    public readonly eventType: EventType = EventType.DotnetAcquisitionCompleted;

    constructor(public readonly version: string, public readonly dotnetPath: string) {
    }
}
