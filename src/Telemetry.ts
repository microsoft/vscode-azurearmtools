// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable max-classes-per-file // Grandfathered in

import * as appInsights from "applicationinsights";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

import { reporter } from "./VSCodeTelReporter";
import * as utilities from "./Utilities";

/**
 * An interface that describes the type of properties that can be assigned to a telemetry Event.
 */
export interface Properties {
    [key: string]: string | number;
}

/**
 * A telemetry event that can be sent to a telemetry endpoint.
 */
export class Event implements Properties {
    public eventName: string;

    [key: string]: string | number;
}

/**
 * Convert a telemetry event to a string.
 */
function toString(event: Event): string {
    let result = `"eventName": "${event.eventName}"`;

    for (let propertyName in event) {
        if (propertyName !== "eventName") {
            result += `, "${propertyName}": `;

            const propertyValue = event[propertyName];
            if (typeof propertyValue === "string") {
                result += `"${propertyValue}"`;
            }
            else {
                result += propertyValue;
            }
        }
    }

    return result;
}

/**
 * A target where telemetry events can be sent to.
 */
export abstract class Endpoint {
    public abstract log(event: Event): void;

    public close(): void {
        // Nothing to do
    }
}

/**
 * A telemetry Endpoint decorator that applies the provided properties to each Event that is
 * logged.
 */
export class PropertySetter extends Endpoint {
    constructor(private _propertiesToSet: Properties, private _innerEndpoint: Endpoint) {
        super();
    }

    public log(event: Event): void {
        let newEvent = event;

        if (this._propertiesToSet) {
            newEvent = utilities.clone(event);
            for (let propertyName in this._propertiesToSet) {
                newEvent[propertyName] = this._propertiesToSet[propertyName];
            }
        }

        this._innerEndpoint.log(newEvent);
    }
}

/**
 * A telemetry endpoint that will send telemetry events to an Application Insights instance in
 * Azure.
 */
export class ApplicationInsights extends Endpoint {
    private _client: Client;

    constructor(private _options?: { instrumentationKey: string, uploadImmediately?: boolean }) {
        super();

        appInsights.setup(_options.instrumentationKey)
            .setAutoCollectRequests(false)
            .setAutoCollectPerformance(false)
            .setAutoCollectExceptions(false)
            .start();

        this._client = appInsights.client;
    }

    public log(event: Event): void {
        let properties: { [key: string]: string };
        let measurements: { [key: string]: number };

        for (let propertyName in event) {
            if (propertyName !== "eventName") {
                let propertyValue = event[propertyName];
                if (typeof propertyValue === "string") {
                    if (!properties) {
                        properties = {};
                    }
                    properties[propertyName] = propertyValue;
                }
                else if (typeof propertyValue === "number") {
                    if (!measurements) {
                        measurements = {};
                    }
                    measurements[propertyName] = propertyValue;
                }
            }
        }

        this._client.trackEvent(event.eventName, properties, measurements);

        if (this._options.uploadImmediately) {
            this._client.sendPendingData();
        }
    }
}

export class VSCode extends Endpoint {
    public log(event: Event): void {
        if (reporter) {
            let properties: { [key: string]: string };
            let measurements: { [key: string]: number };

            for (let propertyName in event) {
                if (propertyName !== "eventName") {
                    let propertyValue = event[propertyName];
                    if (typeof propertyValue === "string") {
                        if (!properties) {
                            properties = {};
                        }
                        properties[propertyName] = propertyValue;
                    }
                    else if (typeof propertyValue === "number") {
                        if (!measurements) {
                            measurements = {};
                        }
                        measurements[propertyName] = propertyValue;
                    }
                }
            }

            reporter.sendTelemetryEvent(event.eventName, properties, measurements);
        }
    }
}

/**
 * A telemetry endpoint that will send telemetry events to the console.
 */
export class Console extends Endpoint {
    private _sessionEventNumber = 0;

    public log(event: Event): void {
        let eventNumber = ++this._sessionEventNumber;
        // tslint:disable-next-line:no-console
        console.log(`AzureRM (${eventNumber}): ${toString(event)}`);
    }
}

/**
 * A telemetry endpoint that will send telemetry events to a file.
 */
export class FileTelemetry extends Endpoint {
    private _writeStream: fs.WriteStream;
    private _pendingWrites: string[] = [];
    private _closed: boolean = false;

    constructor(private _filePath: string, private _propertiesToIgnore: string[] = []) {
        super();

        function createDirectory(directoryPath: string, callback?: () => void) {
            fs.mkdir(directoryPath, function (error) {
                // 34 => Error: ENOENT, no such file or directory ‘parent/child’)
                if (error && error.errno === 34) {
                    createDirectory(path.dirname(directoryPath));
                }

                createDirectory(directoryPath);
            });

            if (callback) {
                callback();
            }
        }

        createDirectory(path.dirname(_filePath), () => {
            if (!this._closed) {
                this._writeStream = fs.createWriteStream(_filePath);

                if (this._pendingWrites) {
                    if (this._pendingWrites.length > 0) {
                        for (let toWrite of this._pendingWrites) {
                            this._writeStream.write(toWrite);
                        }
                    }
                    this._pendingWrites = null;
                }
            }
        });
    }

    public log(event: Event): void {
        let line = toString(event) + "\n";
        if (this._writeStream) {
            this._writeStream.write(line);
        }
        else {
            this._pendingWrites.push(line);
        }
    }

    public close(): void {
        if (this._writeStream) {
            this._writeStream.close();
            this._writeStream = null;
        }

        this._closed = true;
    }
}

/**
 * A list of telemetry endpoints. When the list's log(Event) function is called, it will call
 * log(Event) on all of the Endpoints that it contains.
 */
export class List extends Endpoint {
    private _endpoints: Endpoint[] = [];

    public add(endpoint: Endpoint): void {
        this._endpoints.push(endpoint);
    }

    public log(event: Event): void {
        for (let endpoint of this._endpoints) {
            endpoint.log(event);
        }
    }

    public close(): void {
        for (let endpoint of this._endpoints) {
            endpoint.close();
        }
    }
}
