// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:promise-function-async // Grandfathered in

import * as assert from "assert";
import * as http from "http";
import * as https from "https";

export function httpGet(url: string): Promise<string> {
    assert(url, "Cannot make a HTTP request for a null, undefined, or empty url.");

    if (!url.startsWith("http")) {
        // tslint:disable-next-line:no-http-string
        url = `http://${url}`;
    }

    return new Promise<string>((resolve, reject): void => {
        try {
            let request: http.ClientRequest;

            function callback(response: http.IncomingMessage): void {
                if (typeof response.statusCode === "number" && 300 <= response.statusCode && response.statusCode < 400 && response.headers.location) {
                    resolve(httpGet(response.headers.location.toString()));
                } else if (typeof response.statusCode === "number" && 200 <= response.statusCode && response.statusCode < 400) {
                    let responseContent: string = "";
                    let encoding: BufferEncoding | undefined;

                    response.on("data", (dataChunk: string | Buffer) => {
                        const buffer: Buffer = dataChunk instanceof Buffer ? dataChunk : Buffer.from(dataChunk);
                        let byteOrderMarkLength: number = 0;
                        if (!encoding) {
                            if (dataChunk[0] === 0xFF &&
                                dataChunk[1] === 0xFE) {
                                byteOrderMarkLength = 2;
                                encoding = "utf16le";
                            } else {
                                if (dataChunk[0] === 0xEF &&
                                    dataChunk[1] === 0xBB &&
                                    dataChunk[2] === 0xBF) {
                                    byteOrderMarkLength = 3;
                                }
                                encoding = "utf8";
                            }
                        }
                        responseContent += buffer.slice(byteOrderMarkLength).toString(encoding);
                    }).on("end", () => {
                        resolve(responseContent);
                    });
                } else {
                    reject({
                        method: response.method,
                        requestUrl: url,
                        statusCode: response.statusCode,
                        statusMessage: response.statusMessage
                    });
                }
            }

            if (url.startsWith("https")) {
                request = https.get(url, callback);
            } else if (url.startsWith("http")) {
                request = http.get(url, callback);
            } else {
                reject(`Unsupported url schema: '${url}`);
                return;
            }

            request.on("error", (e) => {
                reject(e);
            });
        } catch (err) {
            reject(err);
        }
    });
}
