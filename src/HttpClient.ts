// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import * as http from "http";
import * as https from "https";

export class HttpClient {
    public static get(url: string): Promise<string> {
        assert(url, "Cannot make a HTTP request for a null, undefined, or empty url.");

        if (!url.startsWith("http")) {
            url = `http://${url}`;
        }

        return new Promise<string>((resolve, reject) => {
            let request: http.ClientRequest;

            function callback(response: http.IncomingMessage): void {
                if (300 <= response.statusCode && response.statusCode < 400 && response.headers["location"]) {
                    resolve(HttpClient.get(response.headers["location"].toString()));
                }
                else if (200 <= response.statusCode && response.statusCode < 400) {
                    let responseContent: string = "";
                    let encoding: string;

                    response.on("data", (dataChunk: string|Buffer) => {
                        const buffer: Buffer = dataChunk instanceof Buffer? dataChunk: new Buffer(dataChunk);
                        let byteOrderMarkLength: number = 0;
                        if (!encoding) {
                            if (dataChunk[0] == 0xFF &&
                                dataChunk[1] == 0xFE) {
                                byteOrderMarkLength = 2;
                                encoding = "utf16le";
                            }
                            else {
                                if (dataChunk[0] == 0xEF &&
                                    dataChunk[1] == 0xBB &&
                                    dataChunk[2] == 0xBF) {
                                    byteOrderMarkLength = 3;
                                }
                                encoding = "utf8";
                            }
                        }
                        responseContent += buffer.slice(byteOrderMarkLength).toString(encoding);
                    }).on("end", () => {
                        resolve(responseContent);
                    });
                }
                else {
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
            }
            else if (url.startsWith("http")) {
                request = http.get(url, callback);
            }
            else {
                reject(`Unsupported url schema: '${url}`);
            }

            request.on("error", (e) => {
                reject(e);
            });
        });
    }
}