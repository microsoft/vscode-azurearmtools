// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export function removeApiVersions(json: string): string {
    // e.g. "apiVersion": "2016-10-01",
    return json.replace(/"apiVersion":\s*"[^"]+"/g, '"apiVersion": "xxxx-xx-xx"');
}
